export interface SidebarGroupData {
	name: string
	icon: string
	open: boolean
	methods: ApiServices
}

export interface ApiServices {
	[x: string]: ApiInterface
}

export interface ApiInterface {
	[x: string]: ApiMethod
}

export interface ApiMethod {
	_type: "protobufs" | "publisher_only" | "undocumented" | null
	httpmethod: "GET" | "POST" | null
	version: number
	description?: string
	highlight?: string
	parameters: ApiMethodParameter[]
	isFavorite: boolean
	hasArrays: boolean
}

export interface ApiMethodParameter {
	_value?: string
	_counter?: number
	manuallyToggled?: boolean

	name: string
	type?: string
	description?: string
	optional: boolean
	extra?: ApiMethodParameter[]
}

export async function getInterfaces() {
	const apiFetch = await fetch('api.json', {
		method: 'GET',
		credentials: 'include',
		mode: 'no-cors',
	});
	const interfaces: ApiServices = await apiFetch.json();

	return interfaces;
}
