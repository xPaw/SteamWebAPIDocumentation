import * as esbuild from 'esbuild';
import * as vuePlugin from 'esbuild-plugin-vue3';
import * as fs from 'fs/promises';
import * as path from 'path';

const isDev = process.argv.length > 2 && process.argv[2] === '--dev';

// Minify and copy api.json
const interfaces = JSON.parse(await fs.readFile(path.resolve('api.json')));

await fs.writeFile(path.resolve('public', 'api.json'), JSON.stringify(interfaces));

// Esbuild
const esbuildOptions = {
	entryPoints: ['src/documentation.ts', 'src/style.css'],
	minify: true,
	bundle: true,
	sourcemap: true,
	outdir: 'public/',
	plugins: [vuePlugin.default()],
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
