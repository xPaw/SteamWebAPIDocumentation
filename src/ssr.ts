// @ts-expect-error Node module, not available in browser types
import fs from 'node:fs/promises';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import interfacesJson from '../api.json';
import App from './App.vue';
import type { ApiServices } from './interfaces';

// @ts-expect-error
const interfaces = interfacesJson as ApiServices;

const defaultTitle = 'Steam Web API Documentation';
const defaultDescription =
	'An automatically generated list of Steam Web API interfaces, methods and parameters. Allows you to craft requests in the browser.';
const defaultCanonical = 'https://steamapi.xpaw.me/';

function getDescription(interfaceName: string): string {
	const methods = interfaces[interfaceName];
	const methodNames = Object.keys(methods);
	const prefix = `Documentation and API tester for ${interfaceName}. Methods: `;
	const maxLength = 160;

	let listed = '';

	for (let i = 0; i < methodNames.length; i++) {
		const separator = i > 0 ? ', ' : '';
		const remaining = methodNames.length - i;
		const moreText = `, and ${remaining} more.`;
		const next = `${separator}${methodNames[i]}`;

		if (prefix.length + listed.length + next.length + moreText.length > maxLength) {
			if (listed) {
				return `${prefix}${listed}, and ${remaining} more.`;
			}

			return `${prefix}${remaining} methods.`;
		}

		listed += next;
	}

	return `${prefix}${listed}.`;
}

function renderPage(template: string, ssrHtml: string, title: string, description: string, canonical: string): string {
	return template
		.replaceAll('%PAGE_TITLE%', title)
		.replaceAll('%PAGE_DESCRIPTION%', description)
		.replaceAll('%PAGE_CANONICAL%', canonical)
		.replace('<div id="app"></div>', `<div id="app">${ssrHtml}</div>`);
}

async function renderAll() {
	const outdir = 'build/';
	const templateHtml = await fs.readFile(`${outdir}index.html`, 'utf8');
	const writes: Promise<void>[] = [];

	// Render home page
	const homeSsr = await renderToString(createSSRApp(App));
	writes.push(
		fs.writeFile(
			`${outdir}index.html`,
			renderPage(templateHtml, homeSsr, defaultTitle, defaultDescription, defaultCanonical),
		),
	);

	// Render each interface page
	for (const interfaceName of Object.keys(interfaces)) {
		const app = createSSRApp(App, { initialInterface: interfaceName });
		const ssrHtml = await renderToString(app);

		writes.push(
			fs.writeFile(
				`${outdir}${interfaceName}.html`,
				renderPage(
					templateHtml,
					ssrHtml,
					`${interfaceName} – Steam Web API Documentation`,
					getDescription(interfaceName),
					`${defaultCanonical}${interfaceName}`,
				),
			),
		);
	}

	await Promise.all(writes);
	console.log(`SSR: generated ${writes.length} pages`);
}

renderAll();
