<template>
	<a :href="href" @click="onClick"><slot /></a>
</template>

<script lang="ts">
import { defineComponent, inject } from 'vue';
import { parseInterfaceFromUrl } from './url';

export default defineComponent({
	props: {
		href: {
			type: String,
			required: true,
		},
	},
	setup() {
		return {
			setInterface: inject<(iface: string, method: string | null) => void>('setInterface')!,
		};
	},
	methods: {
		onClick(e: MouseEvent) {
			if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
				return;
			}

			const url = new URL(this.href, location.origin);
			const [iface, method] = parseInterfaceFromUrl(url);

			if (url.pathname !== location.pathname || !method) {
				e.preventDefault();
			}

			this.setInterface(iface, method);
		},
	},
});
</script>
