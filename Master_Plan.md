## Unified Master Plan

### Phase 0 – Repo Guardrails & Theme Imports

- Initialize SvelteKit (skeleton TS) and install: `@sveltejs/kit`, `typescript`, `tailwindcss`, `@tailwindcss/vite`, `autoprefixer`, `three`, `@threlte/core`, `@threlte/extras`, `meyda`, `@mlc-ai/web-llm`, `opfs-tools`, `idb-keyval`, `jszip`, `audiobuffer-to-wav`.
- Import `DEV Docs/jewel-engine-theme-lowcontrast-garnet-topaz.css` inside `src/app.postcss`; mirror tokens in `tailwind.config.ts` via `theme.extend.colors` and utility classes `.bg-app`, `.surface-panel`, `.button-primary`, `.badge-*`.
- Configure `vite.config.ts` with COOP/COEP headers and project aliases; ensure dev server emits same headers.
- Add ESLint rules forbidding `export let` and `$:`; enforce Svelte 5 Runes (`let { prop } = $props()`, `$state`, `$derived`, `$effect`). Keep Prettier ASCII-only.
- Scaffold required directories: `src/lib/{types,audio,components,stores,engine,ai,rendering,storage,export}` plus `src/lib/workers` substructure.

### Phase 1 – Domain Types, Global State, Layout Skeleton

- `src/lib/types.ts`: define `UserProfile`, `SculptureDefinition`, `SculptureSurface`, `SculptureDeformation`, `AppSettings`, `AudioRingBuffer`, `AnalysisFrame`, helper types (`LathePoint`, `AIProviderConfig`) with strict TypeScript.
- Stores (`src/lib/stores/*.ts`):
  - `appSettingsStore`: `$state` defaults (cloud AI, high graphics, default mic); persist via `localStorage`, encrypt API keys.
  - `sculptureStore`: holds `currentSculpture`, `ghostSculpture`, geometry dirty flags.
  - `analysisStore`: mic level meters, latest `AnalysisFrame`, SAB availability.
  - `recordingStore`: state machine `idle → recording → processing → complete`.
  - `uiStore`: panel visibility, onboarding progress indicators.
- Layout: `src/routes/+layout.svelte` for global shell; `+page.svelte` hosts `MainScene`, `TransportControls`, `AIPanel`, `ParameterSliders`, `ProjectList`. Use theme utilities for styling.
- Runes compliance: components declare props via `let { prop } = $props()`, derived state via `$derived`, side effects via `$effect`, and standard HTML events (`onclick`).

### Phase 2 – Threlte Scene & Renderer Setup

- Renderer factory (`src/lib/rendering/renderer.ts`): `createRenderer(canvas)` prefers WebGPU; falls back to WebGL2 with warnings; shadow/map sizes driven by `appSettings`.
- Scene component (`src/lib/components/scene/Sculpture.svelte`):
  - `<Canvas renderer="webgpu" fallback="webgl">`, camera and lights configured for porcelain look.
  - `geometryDirty = $state(false)`; `useTask` rebuilds `LatheGeometry` only when dirty.
  - `MeshPhysicalMaterial` with transmission, thickness, clearcoat, optional displacement map.
- Realtime visualizer (`src/lib/components/scene/AnalysisVisualizer.svelte`): `<T.Points>` or `<T.LineSegments>` fed by `analysisStore`; toggled during recording.
- Panel layout matches blueprint: header at top, full canvas center, floating transport/AI panels anchored via Tailwind.

### Phase 3 – Audio Pipeline (Mic → Worklet → Worker → UI)

- Shared buffer (`src/lib/audio/ringBuffer.ts`): allocate SAB storing write/read pointers and samples; expose `createAudioRingBuffer`, `write`, `read`, `available`, pointer helpers using `Atomics`.
- Audio context (`src/lib/audio/audioContext.ts`): lazy `AudioContext` creation on first gesture; add `recorder.worklet.ts` via `audioContext.audioWorklet.addModule(new URL('../workers/recorder.worklet.js', import.meta.url))`; connect mic stream to worklet node.
- Worklet (`src/lib/workers/recorder.worklet.ts`): `RecorderProcessor` writes mono samples into SAB ring buffer; no analysis; `registerProcessor`.
- Analysis worker (`src/lib/workers/analysis.worker.ts`): import Meyda; poll SAB every ~16 ms; compute `rms`, `zcr`, `spectralCentroid`, YIN pitch; emit `{ type: 'analysis-frame', payload: AnalysisFrame }`; send status/error events.
- Worker client (`src/lib/audio/analysisWorkerClient.ts`): start/stop worker, forward frames to `analysisStore`, manage FFT configuration.
- Calibration (`src/lib/audio/calibration.ts`): capture 10 s baseline, compute percentile ranges for pitch/energy/timbre, persist in `UserProfile`; UI modal plus reset control in settings.

### Phase 4 – Sculpture Engine & Recording Flow

- Physics mapping (`src/lib/engine/physicsMapping.ts`):
  - `generateLathe(frames, profile)` normalizes pitch to height, maps energy to radius deltas, smooths curve with timbre-weighted kernel.
  - `applyDeformation` and `smoothCurve` helpers derive twist/compression and surface parameters from feature trends.
- Recording orchestration (`src/lib/stores/recording.svelte.ts`):
  - `$effect` transitions: on `recording → processing`, snapshot frames, run generator, update `sculptureStore`, switch to `complete`.
  - `RESET` clears analysis buffers, sculpture state, UI flags.
- Manual controls (`src/lib/components/controls/ParameterSliders.svelte`): sliders for height, twist, compression, roughness, glaze; ghost preview mesh displayed on pointer down, commit on release.
- Transport controls (`src/lib/components/controls/Transport.svelte`): record/stop buttons, mic level meter, state indicators following HTML event attributes.

### Phase 5 – AI System (Cloud + Local) & UI

- Interface (`src/lib/ai/types.ts`): `AISculptor` with `initialize`, `generateVariation`, `getStatus`; include `AISculptorStatus` and typed error class.
- System prompt (`src/lib/ai/systemPrompt.ts`): canonical prompt requiring JSON-only responses describing sculpture mutations.
- Cloud provider (`src/lib/ai/CloudAISculptor.ts`):
  - Validate API key/endpoint; POST OpenAI-compatible payload; parse response JSON; merge via `mergeSculpture` with schema validation; throw typed errors on HTTP/JSON/schema failure.
- Local provider (`src/lib/ai/LocalAISculptor.ts`):
  - Check `navigator.gpu`; load `@mlc-ai/web-llm` model (Desktop: Llama-3-8B q4f16_1, Mobile: Phi-3-mini q4f16_1); track download progress; disable with warning if WebGPU absent; reuse prompt contract.
- Chat UI (`src/lib/components/panels/AIPanel.svelte`):
  - Message history, textarea, send button, provider switch, status indicators; integrates with `appSettingsStore` and `sculptureStore`; retries and errors surfaced explicitly.

### Phase 6 – Storage, Library, Export

- OPFS utilities (`src/lib/storage/opfs.ts`):
  - `saveProject(sculpture, audioBlob?)` writes JSON + WAV into `/voice-to-sculpture/projects/`.
  - `loadProject`, `listProjects`, `deleteProject`; maintain metadata index in `idb-keyval`.
- Project library (`src/lib/components/library/ProjectList.svelte`): list projects with thumbnail, name, date, search/filter, load/delete actions; thumbnails generated via low-res render snapshot.
- High-res export (`src/lib/export/renderHighRes.ts`): off-screen renderer at 4096² captures front/top/side/isometric PNGs, bundles via `jszip`, restores renderer state after capture.
- SVG export (`src/lib/export/radiusCurveToSvg.ts`): convert `radiusCurve` to mm coordinates, emit SVG polyline/path for fabrication.
- Audio export (`src/lib/export/audio.ts`): convert captured samples to WAV using `audiobuffer-to-wav`; save alongside project data.

### Phase 7 – Quality Modes, Fallbacks, Onboarding, Testing

- Graphics quality (`src/lib/stores/settings.svelte.ts`): `quality` toggle adjusts shadow map sizes, SSAO, particle counts; propagated to renderer and visualizer.
- Capability guards: detect `SharedArrayBuffer`, WebGPU, microphone permissions; display warnings and disable dependent features gracefully.
- Error boundaries: wrap scene, audio, AI components; catch worker failures and AI errors with actionable UI feedback.
- Onboarding (`src/lib/components/onboarding/Tutorial.svelte`): five-step modal (welcome, mic permission, calibration, first recording, AI tutorial) using `in:fly` transitions; state stored in `uiStore`.
- Performance: avoid logs in hot paths; rely on `useTask`; use dirty flags; throttle worker posts; run OPFS maintenance with `requestIdleCallback`.
- Testing: unit tests for ring buffer, physics mapping, SVG exporter, AI merge; integration test for mic-to-sculpture pipeline; browser QA on Chrome/Edge/Firefox with Safari guidance; run `npm run check`, `npm run test`, `npm run dev`, `npm run build`, `npm run preview`.

### Definition of Done

- Voice recording produces sculptures with <50 ms latency and 60 fps visualization.
- Cloud/local AI variations share identical UX with robust error handling and capability fallbacks.
- Projects persist via OPFS with PNG/SVG/WAV exports verified.
- Renderer prefers WebGPU, falls back to WebGL2 automatically; Local AI disabled gracefully when unsupported.
- Onboarding guides users through permissions, calibration, first sculpture, and AI usage.
- All components adhere to Svelte 5 runes, Jewel theme, and repo rules; lint/tests pass with zero ambiguity for implementation.
