import * as esbuild from 'esbuild';
import * as vuePlugin from 'esbuild-plugin-vue3';
import htmlPlugin from '@chialab/esbuild-plugin-html';
import { exec } from 'child_process';
import fs from 'fs/promises';

const isDev = process.argv.includes('--dev');

// Esbuild
/** @type {esbuild.BuildOptions} */
const esbuildOptions = {
	entryPoints: ['src/index.html', 'src/ssr.ts'],
	minify: true,
	bundle: true,
	sourcemap: false,
	chunkNames: '[name]-[hash]',
	outdir: 'public/',
	logLevel: 'info',
	plugins: [
		htmlPlugin({
			minifyOptions: {
				minifySvg: false,
			},
		}),
		vuePlugin.default(),
	],
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
	},
};

if (isDev) {
	esbuildOptions.minify = false;
	esbuildOptions.sourcemap = true;
	esbuildOptions.chunkNames = undefined;
	esbuildOptions.banner = {
		js: `window.DEV_MODE = true;new EventSource("/esbuild").addEventListener("change", () => location.reload());`
	};
}

const context = await esbuild.context(esbuildOptions);

if (isDev) {
	await context.watch();
	await context.serve({
		host: 'localhost',
		servedir: 'public/',
	});
} else {
	console.log('Building');

	await context.rebuild();
	await context.dispose();

	console.log('Running SSR...');
	exec('node public/ssr.js', async (error, stdout, stderr) => {
		if (error) {
			console.error(`SSR Error: ${error}`);
			return;
		}

		const ssrHtml = stdout.trim();

		const indexPath = 'public/index.html';

		let indexHtml = await fs.readFile(indexPath, 'utf8');
		indexHtml = indexHtml.replace('<div id="app"></div>', `<div id="app">${ssrHtml}</div>`);

		await fs.writeFile(indexPath, indexHtml);
		await fs.unlink("public/ssr.js");

		console.log('SSR HTML injected successfully');
	});
}
