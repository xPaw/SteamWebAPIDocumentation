import { createHead } from '@unhead/vue/client';
import { createSSRApp } from 'vue';
import App from './App.vue';
import './style.css';
import { parseInterfaceFromUrl } from './url';

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
	navigator.serviceWorker.register('serviceworker.js', { scope: './' });
}

const [initialInterface] = parseInterfaceFromUrl();
const app = createSSRApp(App, { initialInterface });
app.use(createHead());
app.mount('#app');
