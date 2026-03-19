import { createSSRApp } from 'vue';
import { parseInterfaceFromUrl } from './App';
import App from './App.vue';

if ('serviceWorker' in navigator && !('DEV_MODE' in window)) {
	navigator.serviceWorker.register('serviceworker.js', { scope: './' });
}

const [initialInterface] = parseInterfaceFromUrl();
createSSRApp(App, { initialInterface }).mount('#app');
