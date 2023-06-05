import type { SidebarGroupData, ApiServices, ApiInterface, ApiMethod, ApiMethodParameter } from './interfaces';

import { defineComponent } from 'vue'
import Fuse from 'fuse.js'
import { getInterfaces } from './interfaces';
import CopyIcon from './Icons/CopyIcon.vue';
import FilledStarIcon from './Icons/FilledStarIcon.vue';
import EmptyStarIcon from './Icons/EmptyStarIcon.vue';
import ExecuteIcon from './Icons/ExecuteIcon.vue';
import SuccessIcon from './Icons/SuccessIcon.vue';

interface FuseSearchType {
	interface: string
	method: string
}

const MAIN_TITLE = 'Steam Web API Documentation'
const saveLocalStorage = (key: string, state: string) => localStorage.setItem(key, state);
const loadLocalStorage = (key: string) => localStorage.getItem(key);
const removeLocalStorage = (key: string) => localStorage.removeItem(key);

export default defineComponent({
	components: {SuccessIcon, ExecuteIcon, EmptyStarIcon, FilledStarIcon, CopyIcon},
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
			accessTokenVisible: false,
			currentFilter: '',
			currentInterface: '',
			interfaces: {} as ApiServices,
			fuzzy: {} as Fuse<FuseSearchType>,
			groupsMap: new Map<string, number>(),
			groupsData: new Map<number, SidebarGroupData>([
				// Order of apps here defines the order in the sidebar
				[0, {name: 'Steam', icon: 'steam.jpg', open: true, methods: {}}],
				[730, {name: 'CS:GO', icon: 'csgo.jpg', open: true, methods: {}}],
				[570, {name: 'Dota 2', icon: 'dota.jpg', open: true, methods: {}}],
				[440, {name: 'Team Fortress 2', icon: 'tf.jpg', open: true, methods: {}}],
				[620, {name: 'Portal 2', icon: 'portal2.jpg', open: true, methods: {}}],
				[1046930, {name: 'Dota Underlords', icon: 'underlords.jpg', open: true, methods: {}}],
				[583950, {name: 'Artifact Classic', icon: 'artifact.jpg', open: true, methods: {}}],
				[1269260, {name: 'Artifact Foundry', icon: 'artifact.jpg', open: true, methods: {}}],

				// Beta apps
				[205790, {name: 'Dota 2 Test', icon: 'dota.jpg', open: false, methods: {}}],
				[247040, {name: 'Dota 2 Experimental', icon: 'dota.jpg', open: false, methods: {}}],
				[2305270, {name: 'Dota 2 Staging', icon: 'dota.jpg', open: false, methods: {}}],
				[1024290, {name: 'Dota Underlods Beta', icon: 'underlords.jpg', open: false, methods: {}}],
			]),
		}
	},
	watch: {
		"userData.format"(value: string): void {
			saveLocalStorage('format', value);
		},
		"userData.webapi_key"(value: string): void {
			if (this.isFieldValid('webapi_key')) saveLocalStorage('webapi_key', value);
			else removeLocalStorage('webapi_key');
		},
		"userData.access_token"(value: string): void {
			if (this.isFieldValid('access_token')) saveLocalStorage('access_token', value);
			else removeLocalStorage('access_token');
		},
		"userData.steamid"(value: string): void {
			if (this.isFieldValid('steamid')) {
				saveLocalStorage('steamid', value);

				this.fillSteamidParameter();
			} else removeLocalStorage('steamid');
		},
		currentInterface(newInterface: string): void {
			if (newInterface) document.title = `${newInterface} – ${MAIN_TITLE}`;
			else document.title = MAIN_TITLE;

			if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
		},
		currentFilter(newFilter: string, oldFilter: string): void {
			if (!newFilter) this.$nextTick(this.scrollInterfaceIntoView);
			else {
				this.currentInterface = '';

				if (!oldFilter) document.querySelector('.sidebar')!.scrollTop = 0;
			}
		}
	},
	mounted(): void {
		getInterfaces().then((interfaces) => {
			const flattenedMethods: FuseSearchType[] = [];

			try {
				this.userData.webapi_key = loadLocalStorage('webapi_key') ?? '';
				this.userData.access_token = loadLocalStorage('access_token') ?? '';
				this.userData.steamid = loadLocalStorage('steamid') ?? '';
				this.userData.format = loadLocalStorage('format') ?? '';

				const favoriteStrings = JSON.parse(loadLocalStorage('favorites') ?? '[]');

				for (const favorite of favoriteStrings) {
					const [favoriteInterface, favoriteMethod] = favorite.split('/', 2);

					if (Object.hasOwn(interfaces, favoriteInterface) &&
						Object.hasOwn(interfaces[favoriteInterface], favoriteMethod)) {
						interfaces[favoriteInterface][favoriteMethod].isFavorite = true;

						this.userData.favorites.add(favorite);
					}
				}
			} catch (e) {
				console.error(e);
			}

			for (const interfaceName in interfaces) {
				for (const methodName in interfaces[interfaceName]) {
					const method = interfaces[interfaceName][methodName];

					for (const parameter of method.parameters) {
						parameter._value = '';

						if (parameter.type === 'bool') parameter.manuallyToggled = false;
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
				}
			}

			this.interfaces = interfaces;

			this.setInterface();

			window.addEventListener('hashchange', () => {
				this.setInterface();
			}, false);

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

			document.getElementById('loading')!.remove();
		});
	},
	computed: {
		sidebarInterfaces(): Map<number, SidebarGroupData> {
			const interfaces = this.filteredInterfaces;

			if (this.currentFilter) {
				return new Map<number, SidebarGroupData>([
					[0, {
						name: 'Search results',
						icon: '',
						open: true,
						methods: interfaces,
					}]
				]);
			}

			const groups = new Map(this.groupsData);

			for (const interfaceName in interfaces) {
				const appid = this.groupsMap.get(interfaceName) ?? 0;
				let group = groups.get(appid);

				if (!group) {
					groups.set(appid, {
						name: `App ${appid}`,
						icon: 'steam.jpg',
						open: false,
						methods: {}
					});
					group = groups.get(appid);
				}

				group!.methods[interfaceName] = interfaces[interfaceName];
			}

			return groups;
		},
		filteredInterfaces(): ApiServices {
			if (!this.currentFilter) return this.interfaces;

			const matches = this.fuzzy.search(this.currentFilter.replace('/', '|'));
			const matchedInterfaces: ApiServices = {};

			for (const searchResult of matches) {
				const match = searchResult.item;

				if (!matchedInterfaces[match.interface]) matchedInterfaces[match.interface] = {};

				matchedInterfaces[match.interface][match.method] = this.interfaces[match.interface][match.method];
			}

			return matchedInterfaces;
		},
		currentInterfaceMethods(): ApiInterface {
			return this.interfaces[this.currentInterface];
		},
		uriDelimeterBeforeKey() {
			return this.hasValidAccessToken || this.hasValidWebApiKey ? '?' : '';
		},
	},
	methods: {
		setInterface(): void {
			let currentInterface = location.hash;
			const [currentInterfaceHash] = currentInterface;
			let currentMethod = '';

			if (currentInterfaceHash === '#') {
				const [currentInterfaceFirst, currentInterfaceSecond] = currentInterface.substring(1)
					.split('/', 2);
				currentInterface = currentInterfaceFirst;

				if (currentInterfaceFirst) currentMethod = currentInterfaceSecond;
			}

			if (!this.interfaces.hasOwnProperty(currentInterface)) {
				currentInterface = '';
				currentMethod = '';
			} else if (!this.interfaces[currentInterface].hasOwnProperty(currentMethod)) currentMethod = '';

			const interfaceChanged = this.currentInterface !== currentInterface;

			this.currentInterface = currentInterface;

			if (interfaceChanged) {
				// Have to scroll manually because location.hash doesn't exist in DOM as target yet
				this.$nextTick(() => {
					const element = document.getElementById(`${currentInterface}/${currentMethod}`);

					if (element) element.scrollIntoView({block: "start"});
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
			const regExp = /^[0-9a-f]{32}$/i
			switch (field) {
				case 'access_token':
					this.hasValidAccessToken = regExp.test(this.userData[field]);
					return this.hasValidAccessToken;
				case 'webapi_key':
					this.hasValidWebApiKey = regExp.test(this.userData[field]);
					return this.hasValidWebApiKey;
				case 'steamid':
					return /^[0-9]{17}$/.test(this.userData[field]);
			}

			return false;
		},
		renderUri(methodName: string, method: ApiMethod): string {
			let host = 'https://api.steampowered.com/';

			if (method._type === 'publisher_only') host = 'https://partner.steam-api.com/';

			return `${host}${this.currentInterface}/${methodName}/v${method.version}/`;
		},
		renderApiKey(): string {
			const parameters = new URLSearchParams();

			if (this.hasValidAccessToken) parameters.set('access_token', this.userData.access_token);
			else if (this.hasValidWebApiKey) parameters.set('key', this.userData.webapi_key);

			return parameters.toString();
		},
		renderParameters(method: ApiMethod): string {
			const parameters = new URLSearchParams();

			if (this.userData.format !== 'json') parameters.set('format', this.userData.format);

			for (const parameter of method.parameters) {
				if (!parameter._value && !parameter.manuallyToggled) continue;

				parameters.set(parameter.name, <string>parameter._value ?? '');
			}

			const str = parameters.toString();

			if (str.length === 0) return '';

			if (this.uriDelimeterBeforeKey) return `&${str}`;

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
				if (!(field instanceof HTMLInputElement)) continue;

				if (!field.value && !field.disabled && field.tagName === "INPUT") {
					field.disabled = true;

					setTimeout(() => field.disabled = false, 0);
				}
			}
		},
		addParamArray(method: ApiMethod, parameter: ApiMethodParameter): void {
			if (!parameter._counter) parameter._counter = 1;
			else parameter._counter++;

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

			if (element instanceof HTMLElement) element.scrollIntoView();
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
		favoriteMethod(method: ApiMethod, methodName: string): void {
			const name = `${this.currentInterface}/${methodName}`;

			method.isFavorite = !method.isFavorite;

			if (method.isFavorite) this.userData.favorites.add(name);
			else this.userData.favorites.delete(name);

			saveLocalStorage('favorites', JSON.stringify([...this.userData.favorites]));
		},
		navigateSidebar(direction: number): void {
			const keys = Object.keys(this.filteredInterfaces);

			const size = keys.length;
			const index = keys.indexOf(this.currentInterface) + direction;

			this.currentInterface = keys[((index % size) + size) % size];
			this.scrollInterfaceIntoView();
		},
		focusApikey(): void {
			location.hash = '';

			this.currentInterface = '';
			this.currentFilter = '';

			this.$nextTick(() => {
				const element = document.getElementById(this.hasValidAccessToken ? 'form-access-token' : 'form-api-key');

				if (element) element.focus();
			});
		}
	},
});
