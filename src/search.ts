import type { ApiServices } from './interfaces';

export interface SearchResult {
	interface: string;
	method: string;
	highlight: string;
	score: number;
}

interface ScoreResult {
	score: number;
	indices: number[];
}

/**
 * A high-performance fuzzy search implementation for API methods
 *
 * Design Goals:
 * 1. Performance: Optimized for handling thousands of methods with minimal latency
 * 2. Relevance:
 *    - Method names weighted higher than interface names
 *    - Results sorted by calculated relevance score
 *    - Exact substring matches prioritized over subsequence matches
 *    - Start-of-word matches given higher scores
 * 3. Match Types:
 *    - Substring matching (e.g. "tag" finds "GetTagList")
 *    - Subsequence matching (e.g. "getcurrent" finds "GetNumberOfCurrentPlayers")
 * 4. Usability Features:
 *    - Matched portions highlighted with <b> tags
 *    - Interface names with numeric IDs receive lower scores
 *    - Adaptive thresholds based on query length
 * 5. Implementation:
 *    - Prefix and trigram indexes for efficient candidate selection
 *    - Pre-cached lowercase versions of strings for performance
 *    - No regex usage for critical path operations
 *    - Clean, maintainable code structure
 *    - Limited to top 100 most relevant results
 */
export class ApiSearcher {
	private methodsList: {
		interface: string;
		method: string;
		interfaceLower: string;
		methodLower: string;
		hasAppIdSuffix: boolean;
	}[] = [];
	private prefixMap: Map<string, number[]> = new Map();
	private trigrams: Map<string, number[]> = new Map();
	private interfacePrefixMap: Map<string, number[]> = new Map();
	private interfaceTrigrams: Map<string, number[]> = new Map();

	constructor(apiServices: ApiServices) {
		// Build flat list of methods with pre-cached lowercase versions
		for (const interfaceName in apiServices) {
			const apiInterface = apiServices[interfaceName];
			const interfaceLower = interfaceName.toLowerCase();

			// Pre-check if interface matches the app ID pattern
			const hasAppIdSuffix = /_(?<appid>[0-9]+)$/.test(interfaceName);

			for (const methodName in apiInterface) {
				const methodLower = methodName.toLowerCase();
				this.methodsList.push({
					interface: interfaceName,
					method: methodName,
					interfaceLower,
					methodLower,
					hasAppIdSuffix,
				});
			}
		}

		// Build indexes for both methods and interfaces
		this.methodsList.forEach((item, index) => {
			// Method indexes
			this.indexString(item.methodLower, index, this.prefixMap, this.trigrams);

			// Interface indexes
			this.indexString(item.interfaceLower, index, this.interfacePrefixMap, this.interfaceTrigrams);
		});
	}

	private indexString(
		str: string,
		index: number,
		prefixMap: Map<string, number[]>,
		trigramMap: Map<string, number[]>,
	): void {
		// Add each prefix of the string to the map
		for (let i = 1; i <= Math.min(str.length, 4); i++) {
			const prefix = str.substring(0, i);
			let arr = prefixMap.get(prefix);
			if (!arr) {
				arr = [];
				prefixMap.set(prefix, arr);
			}
			arr.push(index);
		}

		// Add trigrams for substring matching acceleration
		if (str.length >= 3) {
			for (let i = 0; i <= str.length - 3; i++) {
				const trigram = str.substring(i, i + 3);
				let arr = trigramMap.get(trigram);
				if (!arr) {
					arr = [];
					trigramMap.set(trigram, arr);
				}
				arr.push(index);
			}
		}
	}

	public search(query: string): SearchResult[] {
		if (!query || query.length === 0) {
			return [];
		}

		const normalizedQuery = query.toLowerCase().replace(/\s/g, '');

		// Get method candidates
		const methodCandidates = this.getMethodCandidates(normalizedQuery);

		// Find matching interfaces
		const matchingInterfaces = this.getMatchingInterfaces(normalizedQuery);

		// Process candidates and build results
		const results: SearchResult[] = [];
		const processedItems = new Set<number>();

		// First process direct method matches
		for (const index of methodCandidates) {
			const item = this.methodsList[index];

			// Only process if it's an actual match
			if (!this.hasSubstringOrSubsequence(item.methodLower, normalizedQuery)) {
				continue;
			}

			processedItems.add(index);

			const methodResult = this.getScore(item.methodLower, normalizedQuery, 3);
			let totalScore = methodResult.score;

			// Apply penalty for interfaces with app ID suffix
			if (item.hasAppIdSuffix) {
				totalScore *= 0.5;
			}

			// For very short queries, apply a stricter threshold
			const minScoreThreshold = normalizedQuery.length < 3 ? 0.7 : 0.3;

			// Apply stricter scoring for common terms
			if (totalScore > minScoreThreshold) {
				results.push({
					interface: item.interface,
					method: item.method,
					highlight:
						methodResult.indices.length > 0
							? this.highlightMethod(item.method, methodResult.indices)
							: item.method,
					score: totalScore,
				});
			}
		}

		// Then add methods from matching interfaces (if not already added)
		for (const interfaceName of matchingInterfaces) {
			// Find all methods belonging to this interface
			for (let i = 0; i < this.methodsList.length; i++) {
				if (this.methodsList[i].interfaceLower === interfaceName) {
					// Skip if already processed
					if (processedItems.has(i)) continue;

					const item = this.methodsList[i];
					processedItems.add(i);

					// Check if method itself also matches (for highlighting)
					const methodResult = this.hasSubstringOrSubsequence(item.methodLower, normalizedQuery)
						? this.getScore(item.methodLower, normalizedQuery, 3)
						: { score: 0, indices: [] };

					// Interface matches get a modest base score
					let interfaceScore = 0.5;

					// Apply penalty for interfaces with app ID suffix
					if (item.hasAppIdSuffix) {
						interfaceScore *= 0.9;
					}

					const totalScore = interfaceScore + methodResult.score;

					// For very short queries, we need a higher threshold for interface matches
					const minScoreThreshold = normalizedQuery.length < 3 ? 0.5 : 0.25;

					if (totalScore > minScoreThreshold) {
						results.push({
							interface: item.interface,
							method: item.method,
							highlight:
								methodResult.indices.length > 0
									? this.highlightMethod(item.method, methodResult.indices)
									: item.method,
							score: totalScore,
						});
					}
				}
			}
		}

		// Sort by score in descending order
		results.sort((a, b) => b.score - a.score);

		return results.slice(0, 100);
	}

	private getMethodCandidates(query: string): Set<number> {
		const candidateSet = new Set<number>();

		// Try prefix matching for methods (fastest)
		this.addCandidatesByPrefix(query, this.prefixMap, candidateSet);

		// Return early if we have enough candidates
		if (candidateSet.size >= 100) {
			return candidateSet;
		}

		// If query is long enough, try trigram matching
		if (query.length >= 3) {
			this.addCandidatesByTrigram(query, this.trigrams, candidateSet);

			// Return early if we have enough candidates
			if (candidateSet.size >= 100) {
				return candidateSet;
			}
		}

		// If still no candidates, include methods with first letter match
		if (candidateSet.size === 0 && query.length > 0) {
			const firstChar = query[0];
			for (let i = 0; i < this.methodsList.length; i++) {
				if (this.methodsList[i].methodLower.includes(firstChar)) {
					candidateSet.add(i);
				}
			}
		}

		return candidateSet;
	}

	private getMatchingInterfaces(query: string): Set<string> {
		const matchingInterfaces = new Set<string>();

		// Find matching interfaces using the candidate approach
		const candidateSet = new Set<number>();

		// Try prefix matching for interfaces
		this.addCandidatesByPrefix(query, this.interfacePrefixMap, candidateSet);

		// If needed, try trigram matching
		if (candidateSet.size < 50 && query.length >= 3) {
			this.addCandidatesByTrigram(query, this.interfaceTrigrams, candidateSet);
		}

		// Check candidates
		for (const index of candidateSet) {
			const interfaceName = this.methodsList[index].interfaceLower;
			if (this.hasSubstringOrSubsequence(interfaceName, query)) {
				matchingInterfaces.add(interfaceName);
			}
		}

		return matchingInterfaces;
	}

	private addCandidatesByPrefix(query: string, prefixMap: Map<string, number[]>, candidateSet: Set<number>): void {
		const prefix = query.substring(0, Math.min(query.length, 4));
		const indices = prefixMap.get(prefix);

		if (indices) {
			indices.forEach((index) => candidateSet.add(index));
		}
	}

	private addCandidatesByTrigram(query: string, trigramMap: Map<string, number[]>, candidateSet: Set<number>): void {
		for (let i = 0; i <= query.length - 3; i++) {
			const trigram = query.substring(i, i + 3);
			const indices = trigramMap.get(trigram);

			if (indices) {
				indices.forEach((index) => candidateSet.add(index));
			}
		}
	}

	private hasSubstringOrSubsequence(text: string, query: string): boolean {
		// Quick substring check
		if (text.includes(query)) {
			return true;
		}

		// Quick subsequence check
		let j = 0;
		for (let i = 0; i < text.length && j < query.length; i++) {
			if (text[i] === query[j]) {
				j++;
			}
		}
		return j === query.length;
	}

	private getScore(text: string, query: string, weight: number): ScoreResult {
		// Substring match (highest score)
		const substringIndex = text.indexOf(query);
		if (substringIndex !== -1) {
			// Score based on position (earlier matches get higher scores)
			let positionScore = 1 - substringIndex / text.length;

			// Bonus for matches at start of words (camelCase detection)
			if (
				substringIndex === 0 ||
				(text[substringIndex - 1] >= 'a' &&
					text[substringIndex - 1] <= 'z' &&
					text[substringIndex] >= 'A' &&
					text[substringIndex] <= 'Z')
			) {
				positionScore += 0.5;
			}

			// Apply length-based adjustment for short queries
			const lengthFactor = Math.min(1, query.length / 5);

			const indices = Array.from({ length: query.length }, (_, i) => substringIndex + i);
			return {
				score: weight * (1.0 + positionScore * 0.5) * lengthFactor,
				indices,
			};
		}

		// Subsequence match - only compute if length is manageable and query isn't too short
		if (query.length >= 2 && query.length <= text.length) {
			return this.getSubsequenceScore(text, query, weight);
		}

		return { score: 0, indices: [] };
	}

	private getSubsequenceScore(text: string, query: string, weight: number): ScoreResult {
		let matchIndices: number[] = [];
		let i = 0;
		let j = 0;

		// Try to find a subsequence match
		while (i < text.length && j < query.length) {
			if (text[i] === query[j]) {
				matchIndices.push(i);
				j++;
			}
			i++;
		}

		// If we didn't match all query characters
		if (j < query.length) {
			return { score: 0, indices: [] };
		}

		// Calculate score based on matches and gaps
		const textLength = text.length;

		// Calculate gap penalties
		let gapPenalty = 0;
		for (let k = 1; k < matchIndices.length; k++) {
			const gap = matchIndices[k] - matchIndices[k - 1] - 1;
			gapPenalty += gap / textLength;
		}

		// Normalize gap penalty
		gapPenalty = matchIndices.length > 1 ? gapPenalty / (matchIndices.length - 1) : 0;

		// Position bonus (earlier matches are better)
		const positionBonus = 1 - matchIndices[0] / textLength;

		// Calculate density bonus (denser matches are better)
		const densityRange = matchIndices[matchIndices.length - 1] - matchIndices[0] + 1;
		const density = densityRange > 0 ? matchIndices.length / densityRange : 1;

		// Length factor (longer queries are better)
		const lengthFactor = Math.min(1, query.length / 5);

		const score = weight * 0.4 * (1 - gapPenalty) * (1 + 0.3 * positionBonus + 0.3 * density) * lengthFactor;

		return { score, indices: matchIndices };
	}

	private highlightMethod(text: string, indices: number[]): string {
		if (indices.length === 0) return text;

		// Group consecutive indices for proper highlighting spans
		const spans: { start: number; end: number }[] = [];
		let currentSpan: { start: number; end: number } | null = null;

		for (let i = 0; i < indices.length; i++) {
			const index = indices[i];

			if (currentSpan === null) {
				currentSpan = { start: index, end: index };
			} else if (index === currentSpan.end + 1) {
				currentSpan.end = index;
			} else {
				spans.push(currentSpan);
				currentSpan = { start: index, end: index };
			}
		}

		if (currentSpan !== null) {
			spans.push(currentSpan);
		}

		// Build the highlighted text
		let result = '';
		let lastIndex = 0;

		for (const span of spans) {
			// Add text before the span
			result += text.substring(lastIndex, span.start);

			// Add highlighted span
			result += '<b>' + text.substring(span.start, span.end + 1) + '</b>';

			lastIndex = span.end + 1;
		}

		// Add remaining text
		if (lastIndex < text.length) {
			result += text.substring(lastIndex);
		}

		return result;
	}
}
