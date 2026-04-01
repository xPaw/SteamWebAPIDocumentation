// @ts-expect-error Node module, not available in browser types
import { execSync } from 'node:child_process';
// @ts-expect-error Node module, not available in browser types
import fs from 'node:fs/promises';
import { createHead, transformHtmlTemplate } from '@unhead/vue/server';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import App from './App.vue';
import { defaultCanonical } from './head';
import { interfaces } from './interfaces';

async function renderPage(templateHtml: string, initialInterface: string) {
	const app = createSSRApp(App, initialInterface ? { initialInterface } : {});
	const head = createHead();
	app.use(head);

	const ssrHtml = await renderToString(app);

	return transformHtmlTemplate(head, templateHtml.replace('<div id="app"></div>', `<div id="app">${ssrHtml}</div>`));
}

function formatDate(timestamp: number): string {
	return new Date(timestamp * 1000).toISOString().replace('.000Z', 'Z');
}

function getLastModifiedDates(): Record<string, number> {
	const dates: Record<string, number> = {};

	// CI environments typically do shallow clones, which makes git blame
	// attribute all lines to a single commit. Unshallow if needed.
	try {
		execSync('git rev-parse --is-shallow-repository', { encoding: 'utf8' }).trim() === 'true' &&
			execSync('git -c gc.auto=0 fetch --unshallow', { encoding: 'utf8' });
	} catch {}

	const blame = execSync('git blame --porcelain -- api.json', {
		encoding: 'utf8',
		maxBuffer: 50 * 1024 * 1024,
	}) as string;

	let currentKey = '';
	let timestamp = 0;

	for (const line of blame.split('\n')) {
		if (line.startsWith('committer-time ')) {
			timestamp = Number.parseInt(line.slice(15), 10);
		} else if (line.startsWith('\t')) {
			const content = line.slice(1);

			// Detect top-level key: exactly 4 spaces indent, then "KeyName": {
			const keyMatch = content.match(/^ {4}"([^"]+)": \{$/);
			if (keyMatch) {
				currentKey = keyMatch[1];
			}

			if (currentKey && (!dates[currentKey] || timestamp > dates[currentKey])) {
				dates[currentKey] = timestamp;
			}
		}
	}

	return dates;
}

async function renderAll() {
	const outdir = 'build/';
	const templateHtml = await fs.readFile(`${outdir}index.html`, 'utf8');
	const writes: Promise<void>[] = [];

	const interfaceNames = Object.keys(interfaces);

	// Render home page
	writes.push(renderPage(templateHtml, '').then((html) => fs.writeFile(`${outdir}index.html`, html)));

	// Render each interface page
	for (const interfaceName of interfaceNames) {
		writes.push(
			renderPage(templateHtml, interfaceName).then((html) => fs.writeFile(`${outdir}${interfaceName}.html`, html)),
		);
	}

	// Generate sitemap.xml with lastmod dates from git blame
	const lastModDates = getLastModifiedDates();
	const homeLastMod = Math.max(...Object.values(lastModDates));
	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${defaultCanonical}</loc><lastmod>${formatDate(homeLastMod)}</lastmod></url>
${interfaceNames.map((name) => `<url><loc>${defaultCanonical}${name}</loc><lastmod>${formatDate(lastModDates[name] ?? homeLastMod)}</lastmod></url>`).join('\n')}
</urlset>`;
	writes.push(fs.writeFile(`${outdir}sitemap.xml`, sitemap));

	await Promise.all(writes);
	console.log(`SSR: generated ${writes.length} pages`);
}

renderAll();
