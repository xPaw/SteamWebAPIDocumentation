<template>
	<tr :class="`attribute level-${level}`">
		<td class="font-monospace">
			<template v-if="level > 0">↳ </template>
			<label class="form-control-label" :for="`param_${methodName}_${parameter.name}`">{{ parameter.name }}</label>
			<button type="button" class="btn btn-secondary add-param-array" v-if="parameter.name.endsWith( '[0]' ) && level === 0" @click="addParamArray(method, parameter)">+</button>
		</td>
		<td class="font-monospace p-0">
			<a v-if="level === 0 && parameter.name === 'key'" class="prefilled-key form-control border-0 rounded-0" href="#" @click.prevent="focusApiKey">
				<span v-if="apiKeyFilled" class="text-success">click to change</span>
				<span v-else class="text-warning">click to set</span>
			</a>
			<div class="form-check form-switch m-2" v-else-if="parameter.type === 'bool'">
				<input
					type="hidden"
					:name="level === 0 ? parameter.name : ''"
					:value="parameter._value"
					:disabled="!parameter.manuallyToggled"
				>
				<input
					type="checkbox"
					class="form-check-input"
					:id="`param_${methodName}_${parameter.name}`"
					v-model="parameter._value"
					:aria-label="parameter.name"
					@change="parameter.manuallyToggled = true"
				>
				<button class="btn btn-sm btn-danger py-0" type="button" v-if="parameter.manuallyToggled" @click="parameter.manuallyToggled = false; parameter._value = false;">&times;</button>
			</div>
			<input
				v-else
				class="form-control border-0 rounded-0"
				placeholder="…"
				:name="level === 0 ? parameter.name : ''"
				:id="`param_${methodName}_${parameter.name}`"
				v-model="parameter._value"
			>
		</td>
		<td>{{ parameter.type }}</td>
		<td v-if="parameter.optional">No</td>
		<td v-else>
			<svg aria-hidden="true" focusable="false" width="16" height="16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 8C119.033 8 8 119.033 8 256s111.033 248 248 248 248-111.033 248-248S392.967 8 256 8zm0 48c110.532 0 200 89.451 200 200 0 110.532-89.451 200-200 200-110.532 0-200-89.451-200-200 0-110.532 89.451-200 200-200m140.204 130.267l-22.536-22.718c-4.667-4.705-12.265-4.736-16.97-.068L215.346 303.697l-59.792-60.277c-4.667-4.705-12.265-4.736-16.97-.069l-22.719 22.536c-4.705 4.667-4.736 12.265-.068 16.971l90.781 91.516c4.667 4.705 12.265 4.736 16.97.068l172.589-171.204c4.704-4.668 4.734-12.266.067-16.971z"></path></svg>
			Yes
		</td>
		<td>{{ parameter.description }}</td>
	</tr>

	<ApiParameter
		v-if="parameter.extra"
		v-for="parameter2 in parameter.extra"
		:key="parameter2.name"
		:method="method"
		:parameter="parameter2"
		:methodName="methodName"
		:addParamArray="addParamArray"
		:level="level + 1"
	/>
</template>

<script setup lang="ts">
import type { ApiMethod, ApiMethodParameter } from './interfaces';

defineProps<{
	level: number,
	method: ApiMethod,
	parameter: ApiMethodParameter,
	methodName: String,
	focusApiKey: (payload: MouseEvent) => void,
	addParamArray: (method: ApiMethod, parameter: ApiMethodParameter) => void,
	apiKeyFilled: Boolean,

}>();
</script>
