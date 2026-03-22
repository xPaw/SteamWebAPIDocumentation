import interfacesJson from '../api.json';

// @ts-expect-error JSON string fields are inferred as `string`, not the specific union types
export const interfaces: ApiServices = interfacesJson;

export interface SidebarGroupData {
	name: string;
	icon: string;
	open: boolean;
	methods: ApiServices;
}

export interface ApiServices {
	[x: string]: ApiInterface;
}

export interface ApiInterface {
	[x: string]: ApiMethod;
}

export interface ApiMethod {
	_type?: 'protobufs' | 'publisher_only' | 'undocumented';
	httpmethod?: 'GET' | 'POST';
	version: number;
	description?: string;
	highlight?: number[];
	parameters: ApiMethodParameter[];
	isFavorite?: boolean;
	hasArrays?: boolean;
}

export interface ApiMethodParameter {
	_value?: string;
	_counter?: number;
	manuallyToggled?: boolean;

	name: string;
	type?: string;
	description?: string;
	optional: boolean;
	extra?: ApiMethodParameter[];
	enum_values?: Record<number, string>;
}
