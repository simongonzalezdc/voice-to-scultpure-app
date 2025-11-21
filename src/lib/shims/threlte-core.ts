import { createEventDispatcher } from 'svelte';

// Use internal alias to avoid circular reference with vite alias
export * from '@threlte/core-original';

type DispatchDetail = Record<string, any>;

export function createRawEventDispatcher<T extends DispatchDetail = DispatchDetail>() {
	return createEventDispatcher<T>();
}
