import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import htmlPlugin from '@chialab/esbuild-plugin-html';
import * as esbuild from 'esbuild';
import * as vuePlugin from 'esbuild-plugin-vue3';

const isDev = process.argv.includes('--dev');
const outdir = 'build/';

// Copy static assets from public/ to build/
await fs.rm(outdir, { recursive: true, force: true });
await fs.cp('public/', outdir, { recursive: true });

// Esbuild
/** @type {esbuild.BuildOptions} */
const esbuildOptions = {
	entryPoints: isDev ? ['src/index.html'] : ['src/index.html', 'src/ssr.ts'],
	minify: true,
	bundle: true,
	sourcemap: false,
	chunkNames: '[name]-[hash]',
	outdir,
	logLevel: 'info',
	plugins: [
		htmlPlugin({
			minifyOptions: {
				minifySvg: false,
			},
		}),
		vuePlugin.default(),
	],
	external: ['node:fs/promises'],
	define: {
		'process.env.NODE_ENV': JSON.stringify('production'),
	},
};

if (isDev) {
	esbuildOptions.minify = false;
	esbuildOptions.sourcemap = true;
	esbuildOptions.chunkNames = undefined;
	esbuildOptions.banner = {
		js: `window.DEV_MODE = true;new EventSource("/esbuild").addEventListener("change", () => location.reload());`,
	};
}

const context = await esbuild.context(esbuildOptions);

if (isDev) {
	await context.watch();
	await context.serve({
		host: 'localhost',
		servedir: outdir,
		fallback: `${outdir}index.html`,
	});
} else {
	console.log('Building');

	await context.rebuild();
	await context.dispose();

	console.log('Running SSR...');
	const ssr = spawn('node', [`${outdir}ssr.js`], { stdio: 'inherit' });

	ssr.on('close', async (code) => {
		if (code !== 0) {
			console.error(`SSR exited with code ${code}`);
			return;
		}

		await fs.unlink(`${outdir}ssr.js`);
	});
}
