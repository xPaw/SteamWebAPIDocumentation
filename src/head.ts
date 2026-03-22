import { useHead, useSeoMeta } from '@unhead/vue';
import { computed, type Ref } from 'vue';
import interfacesJson from '../api.json';
import type { ApiServices } from './interfaces';

// @ts-expect-error
const interfaces = interfacesJson as ApiServices;

const defaultTitle = 'Steam Web API Documentation';
const defaultDescription =
	'An automatically generated list of Steam Web API interfaces, methods and parameters. Allows you to craft requests in the browser.';
const defaultCanonical = 'https://steamapi.xpaw.me/';

function getDescription(interfaceName: string): string {
	const methods = interfaces[interfaceName];
	const methodNames = Object.keys(methods);
	const prefix = `Documentation and API tester for ${interfaceName}. Methods: `;
	const maxLength = 160;

	let listed = '';

	for (let i = 0; i < methodNames.length; i++) {
		const separator = i > 0 ? ', ' : '';
		const remaining = methodNames.length - i;
		const moreText = `, and ${remaining} more.`;
		const next = `${separator}${methodNames[i]}`;

		if (prefix.length + listed.length + next.length + moreText.length > maxLength) {
			if (listed) {
				return `${prefix}${listed}, and ${remaining} more.`;
			}

			return `${prefix}${remaining} methods.`;
		}

		listed += next;
	}

	return `${prefix}${listed}.`;
}

export function usePageHead(currentInterface: Ref<string>) {
	const title = computed(() => {
		const iface = currentInterface.value;
		return iface ? `${iface} – ${defaultTitle}` : defaultTitle;
	});
	const description = computed(() => {
		const iface = currentInterface.value;
		return iface ? getDescription(iface) : defaultDescription;
	});
	const canonical = computed(() => {
		const iface = currentInterface.value;
		return iface ? `${defaultCanonical}${iface}` : defaultCanonical;
	});

	useSeoMeta({
		title,
		ogType: 'website',
		ogTitle: title,
		ogUrl: canonical,
		description,
		ogDescription: description,
		ogImage: 'https://steamapi.xpaw.me/512.png',
	});

	useHead({ link: [{ rel: 'canonical', href: canonical }] });
}
