import type { SidebarGroupData, ApiServices, ApiInterface, ApiMethod, ApiMethodParameter } from './interfaces';

import { ref, defineComponent } from 'vue'
import Fuse, { type FuseResultMatch, type FuseSortFunctionArg, type IFuseOptions } from 'fuse.js'
import { getInterfaces } from './interfaces';
import ApiParameter from './ApiParameter.vue';

interface FuseSearchType {
	interface: string
	method: string
}

const inputSearch = ref<HTMLInputElement | null>(null);
const inputApiKey = ref<HTMLInputElement | null>(null);
const inputAccessToken = ref<HTMLInputElement | null>(null);

export default defineComponent({
	components: {
		ApiParameter,
	},
	data() {
		return {
			userData: {
				webapi_key: '',
				access_token: '',
				steamid: '',
				format: 'json',
				favorites: new Set<string>(),
			},
			keyInputType: 'password',
			hasValidWebApiKey: false,
			hasValidAccessToken: false,
			accessTokenExpiration: 0,
			accessTokenSteamId: null,
			accessTokenAudience: [],
			accessTokenVisible: false,
			currentFilter: '',
			currentInterface: '',
			interfaces: {} as ApiServices,
			fuzzy: new Object as Fuse<FuseSearchType>,
			groupsMap: new Map<string, number>(),
			groupsData: new Map<number, SidebarGroupData>([
				// Order of apps here defines the order in the sidebar
				[0, { name: 'Steam', icon: 'steam.jpg', open: true, methods: {} }],
				[730, { name: 'CS:GO', icon: 'csgo.jpg', open: true, methods: {} }],
				[570, { name: 'Dota 2', icon: 'dota.jpg', open: true, methods: {} }],
				[440, { name: 'Team Fortress 2', icon: 'tf.jpg', open: true, methods: {} }],
				[620, { name: 'Portal 2', icon: 'portal2.jpg', open: true, methods: {} }],
				[1046930, { name: 'Dota Underlords', icon: 'underlords.jpg', open: true, methods: {} }],
				[583950, { name: 'Artifact Classic', icon: 'artifact.jpg', open: true, methods: {} }],
				[1269260, { name: 'Artifact Foundry', icon: 'artifact.jpg', open: true, methods: {} }],

				// Beta apps
				[205790, { name: 'Dota 2 Test', icon: 'dota.jpg', open: false, methods: {} }],
				[247040, { name: 'Dota 2 Experimental', icon: 'dota.jpg', open: false, methods: {} }],
				[2305270, { name: 'Dota 2 Staging', icon: 'dota.jpg', open: false, methods: {} }],
				[1024290, { name: 'Dota Underlods Beta', icon: 'underlords.jpg', open: false, methods: {} }],
			]),
		}
	},
	setup() {
		return {
			inputSearch,
			inputApiKey,
			inputAccessToken,
		};
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
			try {
				if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) {
					const jwt = value.split('.');
					const token = JSON.parse(atob(jwt[1]));

					this.accessTokenExpiration = token.exp * 1000;
					this.accessTokenAudience = token.aud;
					this.accessTokenSteamId = token.sub;

					if (token.sub && !this.userData.steamid) {
						this.userData.steamid = token.sub;
					}
				} else {
					throw new Error("Invalid token format (or empty)");
				}
			}
			catch (e) {
				console.log((e as Error).message);
				this.accessTokenExpiration = 0;
				this.accessTokenSteamId = null;
				this.accessTokenAudience = [];
			}

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

			if (document.scrollingElement) {
				document.scrollingElement.scrollTop = 0;
			}
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
		getInterfaces().then((interfaces) => {
			const flattenedMethods: FuseSearchType[] = [];

			try {
				this.userData.format = localStorage.getItem('format') || 'json';
				this.userData.steamid = localStorage.getItem('steamid') || '';
				this.userData.webapi_key = localStorage.getItem('webapi_key') || '';
				this.userData.access_token = localStorage.getItem('access_token') || '';

				const favoriteStrings = JSON.parse(localStorage.getItem('favorites') || '[]');

				for (const favorite of favoriteStrings) {
					const [favoriteInterface, favoriteMethod] = favorite.split('/', 2);

					if (Object.hasOwn(interfaces, favoriteInterface) &&
						Object.hasOwn(interfaces[favoriteInterface], favoriteMethod)) {
						interfaces[favoriteInterface][favoriteMethod].isFavorite = true;

						this.userData.favorites.add(favorite);
					}
				}
			}
			catch (e) {
				console.error(e);
			}

			for (const interfaceName in interfaces) {
				for (const methodName in interfaces[interfaceName]) {
					const method = interfaces[interfaceName][methodName];

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

				const interfaceAppid = interfaceName.match(/_(?<appid>[0-9]+)$/);

				if (interfaceAppid) {
					const appid = parseInt(interfaceAppid.groups!.appid, 10);

					this.groupsMap.set(interfaceName, appid);

					let group = this.groupsData.get(appid);

					if (!group) {
						this.groupsData.set(appid, {
							name: `App ${appid}`,
							icon: 'steam.jpg',
							open: false,
							methods: {}
						});
					}
				}
			}

			this.interfaces = interfaces;

			this.setInterface();

			window.addEventListener('hashchange', () => {
				this.setInterface();
			}, false);

			const fuseOptions: IFuseOptions<FuseSearchType> = {
				shouldSort: true,
				useExtendedSearch: true,
				includeMatches: true,
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

			this.bindGlobalKeybind();

			document.getElementById('loading')!.remove();
		});
	},
	computed: {
		sidebarInterfaces(): Map<number, SidebarGroupData> {
			const interfaces = this.filteredInterfaces;

			if (this.currentFilter) {
				return new Map<number, SidebarGroupData>([
					[-1, {
						name: 'Search results',
						icon: '',
						open: true,
						methods: interfaces,
					}]
				]);
			}

			const groups = new Map(this.groupsData);

			for (const interfaceName in interfaces) {
				const appid = this.groupsMap.get(interfaceName) || 0;
				const group = groups.get(appid)!;
				group.methods[interfaceName] = interfaces[interfaceName];
			}

			return groups;
		},
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

				let highlight: string | undefined;
				for (const m of searchResult.matches!) {
					if (m.key === 'method' && m.indices[0][1] > 0) {
						highlight = this.highlightMatches(m);
						break;
					}
				}

				const method = this.interfaces[match.interface][match.method];
				method.highlight = highlight;
				matchedInterfaces[match.interface][match.method] = method;
			}

			return matchedInterfaces;
		},
		currentInterfaceMethods(): ApiInterface {
			return this.interfaces[this.currentInterface];
		},
		uriDelimeterBeforeKey() {
			return this.hasValidAccessToken || this.hasValidWebApiKey ? '?' : '';
		},
		formatAccessTokenExpirationDate(): string {
			const formatter = new Intl.DateTimeFormat('en-US', {
				hourCycle: 'h23',
				dateStyle: 'medium',
				timeStyle: 'short',
			});

			return formatter.format(this.accessTokenExpiration);
		}
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

			const interfaceChanged = this.currentInterface !== currentInterface;

			this.currentInterface = currentInterface;

			if (interfaceChanged) {
				// Have to scroll manually because location.hash doesn't exist in DOM as target yet
				this.$nextTick(() => {
					const element = document.getElementById(`${currentInterface}/${currentMethod}`);

					if (element) {
						element.scrollIntoView({
							block: "start"
						});
					}
				});
			}
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
					this.hasValidAccessToken = this.accessTokenExpiration > Date.now();
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

			let hasArrays = false;
			const inputJson = {} as any;

			for (const parameter of method.parameters) {
				if (parameter.extra) {
					const arr = this.getInnerParameters(parameter);

					if (Object.keys(arr).length > 0) {
						hasArrays = true;

						if (parameter.type?.endsWith('[]')) {
							const paramName = parameter.name.substring(0, parameter.name.length - 3);

							if (!Object.hasOwn(inputJson, paramName)) {
								inputJson[paramName] = [];
							}

							inputJson[paramName].push(arr);
						} else {
							inputJson[parameter.name] = arr;
						}
					} else if (parameter._value) {
						parameters.set(parameter.name, parameter._value);
					}

					continue;
				}

				if (!parameter._value && !parameter.manuallyToggled) {
					continue;
				}

				parameters.set(parameter.name, parameter._value);
			}

			if (hasArrays) {
				method.hasArrays = true;
				parameters.set('input_json', JSON.stringify(inputJson));
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
		getInnerParameters(parameterParent: ApiMethodParameter) {
			const arr = {} as any;

			for (const parameter of parameterParent.extra!) {
				if (parameter.extra) {
					const result = this.getInnerParameters(parameter);

					if (Object.keys(result).length > 0) {
						if (parameter.type?.endsWith('[]')) {
							const paramName = parameter.name.substring(0, parameter.name.length - 3);

							if (!Object.hasOwn(arr, paramName)) {
								arr[paramName] = [];
							}

							arr[paramName].push(result);
						} else {
							arr[parameter.name] = result;
						}
					}

					continue;
				}

				if (!parameter._value && !parameter.manuallyToggled) {
					continue;
				}

				if (parameter.type?.endsWith('[]')) {
					const paramName = parameter.name.substring(0, parameter.name.length - 3);

					if (!Object.hasOwn(arr, paramName)) {
						arr[paramName] = [];
					}

					arr[paramName].push(parameter._value || '');
				} else {
					arr[parameter.name] = parameter._value || '';
				}
			}

			return arr;
		},
		useThisMethod(event: SubmitEvent, method: ApiMethod): void {
			const form = event.target as HTMLFormElement;

			if (method.hasArrays) {
				event.preventDefault();

				if (method.httpmethod === 'POST') {
					alert('Executing POST requests with input_json is not yet supported.');
					return;
				}

				const url = [form.action, this.uriDelimeterBeforeKey, this.renderApiKey(), this.renderParameters(method)].join('');

				try {
					window.open(url, '_blank');
				}
				catch {
					alert('Failed to open window');
				}

				return;
			}

			if (method.httpmethod === 'POST' && !confirm(
				'Executing POST requests could be potentially disastrous.\n\n'
				+ 'Author is not responsible for any damage done.\n\n'
				+ 'Are you sure you want to continue?'
			)) {
				event.preventDefault();
			}

			for (const field of form.elements) {
				if (!(field instanceof HTMLInputElement)) {
					continue;
				}

				if (!field.value && !field.disabled && field.tagName === "INPUT") {
					field.disabled = true;

					setTimeout(() => field.disabled = false, 0);
				}
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
				type: parameter.type,
				optional: true,
			};

			if (parameter.extra) {
				newParameter.extra = [];

				for (const parameter2 of parameter.extra!) {
					newParameter.extra.push({
						name: parameter2.name,
						type: parameter2.type,
						optional: true,
					});
				}
			}

			const parameterIndex = method.parameters.findIndex(param => param.name === parameter.name);
			method.parameters.splice(parameterIndex + parameter._counter, 0, newParameter);
		},
		scrollInterfaceIntoView(): void {
			const element = document.querySelector(`.interface-list a[href="#${this.currentInterface}"]`);

			if (element instanceof HTMLElement) {
				element.scrollIntoView();
			}
		},
		copyUrl(event: MouseEvent): void {
			const button = event.target as Element;
			const element = button.closest('.input-group')!.querySelector('.form-control')!;

			navigator.clipboard.writeText(element.textContent || '').then(() => {
				button.classList.add('bg-success');

				setTimeout(() => button.classList.remove('bg-success'), 500);
			}, () => {
				// write fail
			});
		},
		favoriteMethod(method: ApiMethod, methodName: string): void {
			const name = `${this.currentInterface}/${methodName}`;

			method.isFavorite = !method.isFavorite;

			if (method.isFavorite) {
				this.userData.favorites.add(name);
			} else {
				this.userData.favorites.delete(name);
			}

			localStorage.setItem('favorites', JSON.stringify([...this.userData.favorites]));
		},
		navigateSidebar(direction: number): void {
			const keys = Object.keys(this.filteredInterfaces);

			const size = keys.length;
			const index = keys.indexOf(this.currentInterface) + direction;

			this.currentInterface = keys[((index % size) + size) % size];
			this.scrollInterfaceIntoView();
		},
		focusApiKey(): void {
			location.hash = '';

			this.currentInterface = '';
			this.currentFilter = '';

			this.$nextTick(() => {
				const element = this.hasValidAccessToken ? this.inputAccessToken : this.inputApiKey;

				if (element) {
					element.focus();
				}
			});
		},
		onSearchInput(e: InputEvent) {
			requestAnimationFrame(() => {
				this.currentFilter = (e.target as HTMLInputElement).value;
			});
		},
		highlightMatches(match: FuseResultMatch) {
			let lastIndex = 0;
			const result: string[] = [];
			const sortedMatches = match.indices.toSorted((a, b) => a[0] - b[0]);
			const value = match.value!;

			for (let [start, end] of sortedMatches) {
				if (end <= lastIndex) {
					continue;
				}

				if (start < lastIndex) {
					start = lastIndex;
				}

				if (lastIndex < start) {
					result.push(value.slice(lastIndex, start));
				}

				end++;

				result.push('<b>', value.slice(start, end), '</b>');

				lastIndex = end;
			}

			if (lastIndex !== value.length) {
				result.push(value.slice(lastIndex));
			}

			return result.join('');
		},
		bindGlobalKeybind() {
			document.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.ctrlKey || e.metaKey) {
					return;
				}

				const target = e.target as HTMLElement;

				if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
					return;
				}

				if (e.key === '/' || e.key === 's') {
					e.preventDefault();
					this.inputSearch?.focus();
				}
			});
		}
	},
});
