import { createEventDispatcher } from 'svelte';

export * from '@threlte/core';

type DispatchDetail = Record<string, any>;

export function createRawEventDispatcher<T extends DispatchDetail = DispatchDetail>() {
	return createEventDispatcher<T>();
}
