import { defineComponent, h, type VNode } from 'vue';

export default defineComponent({
	props: {
		method: {
			type: String,
			default: '',
		},
		indices: {
			type: Array as () => number[],
			default: () => [],
		},
	},
	setup(props) {
		return () => highlightMethod(props.method, props.indices);
	},
});

function highlightMethod(text: string, indices: number[]) {
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

	// Build the highlighted text with VNodes
	const nodes: (VNode | string)[] = [];
	let lastIndex = 0;

	for (const span of spans) {
		// Add text before the span
		if (span.start > lastIndex) {
			nodes.push(text.substring(lastIndex, span.start));
		}

		// Add highlighted span
		nodes.push(h('b', {}, text.substring(span.start, span.end + 1)));

		lastIndex = span.end + 1;
	}

	// Add remaining text
	if (lastIndex < text.length) {
		nodes.push(text.substring(lastIndex));
	}

	return nodes;
}
