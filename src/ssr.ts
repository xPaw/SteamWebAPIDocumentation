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

	// Generate sitemap.xml
	const sitemapUrls = [defaultCanonical, ...interfaceNames.map((name) => `${defaultCanonical}${name}`)];
	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((url) => `<url><loc>${url}</loc></url>`).join('\n')}
</urlset>`;
	writes.push(fs.writeFile(`${outdir}sitemap.xml`, sitemap));

	await Promise.all(writes);
	console.log(`SSR: generated ${writes.length} pages`);
}

renderAll();
