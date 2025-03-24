import { createSSRApp } from 'vue';
import App from './App.vue';

if ('serviceWorker' in navigator && !('DEV_MODE' in window)) {
	navigator.serviceWorker.register('serviceworker.js', { scope: './' });
}

createSSRApp(App).mount('#app');
