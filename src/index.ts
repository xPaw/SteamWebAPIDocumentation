import Vue from 'vue'
import App from './App.vue';

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('serviceworker.js', { scope: './' });
}

new Vue({
	el: '#app',
	render: h => h(App),
});
