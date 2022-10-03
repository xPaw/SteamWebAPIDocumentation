const esbuild = require('esbuild');
const vuePlugin = require('esbuild-vue');
const fs = require('fs');
const path = require('path');

esbuild.build({
	entryPoints: ['src/index.ts'],
	minify: true,
	bundle: true,
	sourcemap: true,
	outfile: 'public/documentation.js',
	plugins: [vuePlugin()],
	define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
});

// Minify and copy api.json
const interfaces = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'api.json')));

fs.writeFileSync(path.resolve(__dirname, 'public', 'api.json'), JSON.stringify(interfaces) );

console.log('OK');
