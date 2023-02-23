import { createApp } from 'vue'
import App from './App.vue';

if ('serviceWorker' in navigator && !('DEV_MODE' in window)) {
	navigator.serviceWorker.register('serviceworker.js', { scope: './' });
}

createApp(App).mount('#app');
