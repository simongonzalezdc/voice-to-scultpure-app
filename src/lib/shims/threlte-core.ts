import { createEventDispatcher } from 'svelte';

export * from '@threlte/core/dist/index.js';

type DispatchDetail = Record<string, any>;

export function createRawEventDispatcher<T extends DispatchDetail = DispatchDetail>() {
	const dispatch = createEventDispatcher<T>();

	return <K extends keyof T>(type: K, detail?: T[K]) => {
		dispatch(type, detail);
	};
}

