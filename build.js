const esbuild = require('esbuild');
const vuePlugin = require('esbuild-vue');
const fs = require('fs');
const path = require('path');

esbuild.build({
	entryPoints: ['src/index.ts'],
	bundle: true,
	sourcemap: true,
	outfile: 'public/documentation.js',
	plugins: [vuePlugin()],
	define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
});

fs.copyFileSync(path.resolve(__dirname, 'api.json'), path.resolve(__dirname, 'public', 'api.json'));

console.log('OK');
