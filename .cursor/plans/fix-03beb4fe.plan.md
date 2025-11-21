<!-- 03beb4fe-9d96-4739-b2e5-079ec41a925b a109c5fd-52ea-444a-b2c2-3de3c6f81f9a -->
# Fix Rune Store Modules

## Step 1 – Rename rune stores to `.svelte.ts`

- Move each rune-using store (`uiStore.ts`, `analysisStore.ts`, `sculptureStore.ts`, `appSettingsStore.ts`, `recordingStore.ts`, `settings.ts`) to a matching `.svelte.ts` filename so the Svelte compiler enables runes.

## Step 2 – Update import specifiers

- Adjust every import that references those stores (panels, controls, scenes, onboarding, audio, etc.) to include the new `.svelte` suffix so Vite resolves the renamed files.

## Step 3 – Verify runtime

- Re-run the dev server (or reload) to ensure the `rune_outside_svelte` error disappears and panels/onboarding/sculpture flows still read/write the shared state correctly.

### To-dos

- [ ] Rename rune stores to .svelte.ts
- [ ] Update all import specifiers to new files
- [ ] Restart dev server and ensure rune error gone