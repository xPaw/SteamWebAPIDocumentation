import type { PropType } from 'vue'
import type { ApiServices, ApiInterface, ApiMethod, ApiMethodParameter } from './interfaces';

import { defineComponent } from 'vue'
import Fuse from 'fuse.js'
import { getInterfaces } from './interfaces';

interface FuseSearchType {
	interface: string
	method: string
}

export default defineComponent({
	props: {
		interfaces: {
			type: Object as PropType<ApiServices>,
		}
	},
	data() {
		return {
			userData: {
				webapi_key: '',
				access_token: '',
				steamid: '',
				format: 'json',
			},
			keyInputType: 'password',
			hasValidWebApiKey: false,
			hasValidAccessToken: false,
			accessTokenVisible: false,
			currentFilter: '',
			currentInterface: '',
			skipInterfaceSet: false,
			interfaces: {},
			fuzzy: new Object as Fuse<FuseSearchType>,
		}
	},
	watch: {
		"userData.format"(value: string): void {
			localStorage.setItem('format', value);
		},
		"userData.webapi_key"(value: string): void {
			if (this.isFieldValid('webapi_key')) {
				localStorage.setItem('webapi_key', value);
			}
			else {
				localStorage.removeItem('webapi_key');
			}
		},
		"userData.access_token"(value: string): void {
			if (this.isFieldValid('access_token')) {
				localStorage.setItem('access_token', value);
			}
			else {
				localStorage.removeItem('access_token');
			}
		},
		"userData.steamid"(value: string): void {
			if (this.isFieldValid('steamid')) {
				localStorage.setItem('steamid', value);

				this.fillSteamidParameter();
			}
			else {
				localStorage.removeItem('steamid');
			}
		},
		currentInterface(newInterface: string): void {
			if (newInterface) {
				document.title = `${newInterface} – Steam Web API Documentation`;
			}
			else {
				document.title = `Steam Web API Documentation`;
			}

			if (this.skipInterfaceSet) {
				this.skipInterfaceSet = false;

				return;
			}

			history.replaceState('', '', '#' + newInterface);
		},
		currentFilter(newFilter: string, oldFilter: string): void {
			if (!newFilter) {
				this.$nextTick(this.scrollInterfaceIntoView);
			}
			else {
				this.currentInterface = '';

				if (!oldFilter) {
					document.querySelector('.sidebar')!.scrollTop = 0;
				}
			}
		}
	},
	mounted(): void {
		document.getElementById('loading')!.remove();

		getInterfaces().then((interfaces) => {
			this.interfaces = interfaces;

			this.userData.webapi_key = localStorage.getItem('webapi_key') || '';
			this.userData.access_token = localStorage.getItem('access_token') || '';
			this.userData.steamid = localStorage.getItem('steamid') || '';
			this.userData.format = localStorage.getItem('format') || 'json';

			this.setInterface();

			window.addEventListener('hashchange', () => {
				this.setInterface();
			}, false);

			const flattenedMethods: FuseSearchType[] = [];

			for (const interfaceName in this.interfaces) {
				for (const methodName in this.interfaces[interfaceName]) {
					const method = this.interfaces[interfaceName][methodName];

					for (const parameter of method.parameters) {
						parameter._value = '';

						if (parameter.type === 'bool') {
							parameter.manuallyToggled = false;
						}
					}

					flattenedMethods.push({
						interface: interfaceName,
						method: methodName,
					} as FuseSearchType);
				}
			}

			const fuseOptions: Fuse.IFuseOptions<FuseSearchType> = {
				shouldSort: true,
				useExtendedSearch: true,
				threshold: 0.3,
				keys: [{
					name: 'interface',
					weight: 0.3
				}, {
					name: 'method',
					weight: 0.7
				}]
			};
			this.fuzzy = new Fuse<FuseSearchType>(flattenedMethods, fuseOptions);
		});
	},
	computed: {
		filteredInterfaces(): ApiServices {
			if (!this.currentFilter) {
				return this.interfaces;
			}

			const matches = this.fuzzy.search(this.currentFilter.replace('/', '|'));
			const matchedInterfaces: ApiServices = {};

			for (const searchResult of matches) {
				const match = searchResult.item;

				if (!matchedInterfaces[match.interface]) {
					matchedInterfaces[match.interface] = {};
				}

				matchedInterfaces[match.interface][match.method] = this.interfaces[match.interface][match.method];
			}

			return matchedInterfaces;
		},
		currentInterfaceMethods(): ApiInterface {
			return this.filteredInterfaces[this.currentInterface];
		},
		uriDelimeterBeforeKey() {
			return this.hasValidAccessToken || this.hasValidWebApiKey ? '?' : '';
		},
	},
	methods: {
		setInterface(): void {
			let currentInterface = location.hash;
			let currentMethod = '';

			if (currentInterface[0] === '#') {
				const split = currentInterface.substring(1).split('/', 2);
				currentInterface = split[0];

				if (split[1]) {
					currentMethod = split[1];
				}
			}

			if (!this.interfaces.hasOwnProperty(currentInterface)) {
				currentInterface = '';
				currentMethod = '';
			}
			else if (!this.interfaces[currentInterface].hasOwnProperty(currentMethod)) {
				currentMethod = '';
			}

			this.setMethod(currentInterface, currentMethod);
			this.$nextTick(() => {
				this.skipInterfaceSet = false;
				this.scrollInterfaceIntoView();
			});
		},
		fillSteamidParameter(): void {
			if (!this.userData.steamid) {
				return;
			}

			for (const interfaceName in this.interfaces) {
				for (const methodName in this.interfaces[interfaceName]) {
					for (const parameter of this.interfaces[interfaceName][methodName].parameters) {
						if (!parameter._value && parameter.name.includes('steamid')) {
							parameter._value = this.userData.steamid;
						}
					}
				}
			}
		},
		isFieldValid(field: string): boolean {
			switch (field) {
				case 'access_token':
					this.hasValidAccessToken = /^[0-9a-f]{32}$/i.test(this.userData[field]);
					return this.hasValidAccessToken;

				case 'webapi_key':
					this.hasValidWebApiKey = /^[0-9a-f]{32}$/i.test(this.userData[field]);
					return this.hasValidWebApiKey;

				case 'steamid':
					return /^[0-9]{17}$/.test(this.userData[field]);
			}

			return false;
		},
		renderUri(methodName: string, method: ApiMethod): string {
			let host = 'https://api.steampowered.com/';

			if (method._type === 'publisher_only') {
				host = 'https://partner.steam-api.com/';
			}

			return `${host}${this.currentInterface}/${methodName}/v${method.version}/`;
		},
		renderApiKey(): string {
			const parameters = new URLSearchParams();

			if (this.hasValidAccessToken) {
				parameters.set('access_token', this.userData.access_token);
			}
			else if (this.hasValidWebApiKey) {
				parameters.set('key', this.userData.webapi_key);
			}

			return parameters.toString();
		},
		renderParameters(method: ApiMethod): string {
			const parameters = new URLSearchParams();

			if (this.userData.format !== 'json') {
				parameters.set('format', this.userData.format);
			}

			for (const parameter of method.parameters) {
				if (!parameter._value && !parameter.manuallyToggled) {
					continue;
				}

				parameters.set(parameter.name, parameter._value || '');
			}

			const str = parameters.toString();

			if (str.length === 0) {
				return '';
			}

			if (this.uriDelimeterBeforeKey) {
				return `&${str}`;
			}

			return `?${str}`;
		},
		useThisMethod(event: SubmitEvent, method: ApiMethod): void {
			if (method.httpmethod === 'POST' && !confirm(
				'Executing POST requests could be potentially disastrous.\n\n'
				+ 'Author is not responsible for any damage done.\n\n'
				+ 'Are you sure you want to continue?'
			)) {
				event.preventDefault();
			}

			for (const field of (event.target as HTMLFormElement).elements) {
				if (!(field instanceof HTMLInputElement)) {
					continue;
				}

				if (!field.value && !field.disabled && field.tagName === "INPUT") {
					field.disabled = true;

					setTimeout(() => field.disabled = false, 0);
				}
			}
		},
		setMethod(interfaceName: string, methodName: string): void {
			this.skipInterfaceSet = true;
			this.currentInterface = interfaceName;

			if (methodName) {
				this.$nextTick(() => {
					const element = document.getElementById(methodName);

					if (element) {
						element.scrollIntoView();
					}
				});
			}
		},
		addParamArray(method: ApiMethod, parameter: ApiMethodParameter): void {
			if (!parameter._counter) {
				parameter._counter = 1;
			}
			else {
				parameter._counter++;
			}

			const newParameter: ApiMethodParameter =
			{
				name: `${parameter.name.substring(0, parameter.name.length - 3)}[${parameter._counter}]`,
				optional: true,
			};

			const parameterIndex = method.parameters.findIndex(param => param.name === parameter.name);
			method.parameters.splice(parameterIndex + parameter._counter, 0, newParameter);
		},
		scrollInterfaceIntoView(): void {
			const element = document.querySelector(`.interface-list a[href="#${this.currentInterface}"]`);

			if (element) {
				element.scrollIntoView();
			}
		},
		copyUrl(event: MouseEvent): void {
			const element = (event.target as Element).closest('.input-group')!.querySelector('.form-control')!;
			const selection = window.getSelection()!;
			const range = document.createRange();
			range.selectNodeContents(element);
			selection.removeAllRanges();
			selection.addRange(range);
			document.execCommand('copy');
		},
		updateUrl(method: string): void {
			history.replaceState('', '', '#' + this.currentInterface + '/' + method);
		},
		navigateSidebar(direction: number): void {
			const keys = Object.keys(this.filteredInterfaces);

			const size = keys.length;
			const index = keys.indexOf(this.currentInterface) + direction;

			this.currentInterface = keys[((index % size) + size) % size];
			this.scrollInterfaceIntoView();
		},
		focusApikey(): void {
			this.currentInterface = '';
			this.currentFilter = '';

			this.$nextTick(() => {
				const element = document.getElementById(this.hasValidAccessToken ? 'form-access-token' : 'form-api-key');

				if (element) {
					element.focus();
				}
			});
		}
	},
});
