import * as esbuild from 'esbuild';
import * as vuePlugin from 'esbuild-plugin-vue3';
import * as fs from 'fs/promises';
import * as path from 'path';
import htmlPlugin from '@chialab/esbuild-plugin-html';

const isDev = process.argv.includes('--dev');

// Minify and copy api.json
const interfaces = JSON.parse(await fs.readFile(path.resolve('api.json')));

await fs.writeFile(path.resolve('public', 'api.json'), JSON.stringify(interfaces));

// Esbuild
const esbuildOptions = {
	entryPoints: ['src/index.html'],
	minify: true,
	bundle: true,
	sourcemap: false,
	chunkNames: '[name]-[hash]',
	outdir: 'public/',
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
	esbuildOptions.banner = {
		js: `window.DEV_MODE = true;new EventSource("/esbuild").addEventListener("change", () => location.reload());`
	};
}

const context = await esbuild.context(esbuildOptions);

if (isDev) {
	await context.watch();

	const { host, port } = await context.serve({
		host: 'localhost',
        servedir: 'public/',
    });

	console.log(`Serving at http://${host}:${port}`);
} else {
	console.log('Building');

	await context.rebuild();
	await context.dispose();
}
