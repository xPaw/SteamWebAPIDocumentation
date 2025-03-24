import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import App from './App.vue';

const app = createSSRApp(App);

renderToString(app).then((html) => {
	console.log(html)
})
