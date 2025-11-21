## Implementation Blueprint

### Phase 0 – Repo Prep & Guardrails
- **Tooling**: Initialize SvelteKit (TS) + Tailwind v4 + Threlte v9 starter. Add ESLint config that enforces Svelte 5 runes (`let { prop } = $props()`, `$state`, `$derived`, `$effect`) and forbids `export let`/`$:`. Wire Prettier to preserve ASCII.
- **Vite config**: Inject
  ```
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp'
  }
  ```
  to guarantee SharedArrayBuffer availability (PRD §3, §9).
- **Tailwind + Theme tokens**: Import `DEV Docs/jewel-engine-theme-lowcontrast-garnet-topaz.css` into `src/app.postcss`. Mirror key variables in Tailwind `theme.extend.colors` so utilities (buttons, panels) can reference `--brand-primary`, etc. Create component classes (`.bg-app`, `.surface-panel`, `.button-primary`, `.badge-*`) exactly like the theme doc to ensure consistent jewel palette.

### Phase 1 – Domain Skeleton & Scene Scaffolding
- **Types**: Copy every type from PRD §2 into `src/lib/types.ts`. Include `AppSettings`, `SculptureDefinition`, `UserProfile`, `AudioRingBuffer`, `AnalysisFrame`. Add helpers (`type LathePoint = { height: number; radius: number }`) if needed, but keep `any` forbidden.
- **State stores**: Under `src/lib/stores/`, create rune-based modules: `appSettingsStore.ts` (defaults to cloud AI, high graphics), `sculptureStore.ts` (holds live `SculptureDefinition`), `analysisStore.ts` (ring buffer status, live frames), `uiStore.ts` (panel visibility). All mutable values use `$state(initialValue)` and derived selectors use `$derived`.
- **Layout**: Build `src/routes/+layout.svelte` with header (logo placeholder, settings button, “New Project”) and stacked sections for Threlte canvas + floating panels. Tie classes to theme tokens. Ensure interactions use `onclick` rather than Svelte directives per repo rules.
- **Threlte canvas**: In `src/lib/components/scene/Sculpture.svelte`, set up `<Canvas>` that prefers WebGPU (`renderer="webgpu"`) with fallback to WebGL2 calculated via `$derived(() => navigator.gpu ? ... )`. Render static `LatheGeometry` + `MeshPhysicalMaterial` using TSL-friendly setup: transmission, thickness from `sculpture.surface`. Use `useTask` for rotation animation, no `requestAnimationFrame`.

### Phase 2 – Audio Capture & Analysis Loop (PRD §3, §4)
- **Shared memory bootstrapping**:
  - Create `src/lib/audio/ringBuffer.ts` that allocates `SharedArrayBuffer`, exposes `createAudioRingBuffer(capacity: number): AudioRingBuffer`.
  - Add pointer helpers `incrementPointer`, `getAvailableFrames`.
- **AudioWorklet**:
  - File `src/lib/workers/recorder.worklet.ts` exports `class RecorderProcessor extends AudioWorkletProcessor`. Constructor receives SAB + channel count options. `process` writes samples into SAB ring buffer; no analysis. Register with `registerProcessor`.
  - In main thread `src/lib/audio/audioContext.ts`, on user interaction: instantiate `AudioContext`, add module (`audioContext.audioWorklet.addModule(new URL(..., import.meta.url))`), connect mic input -> worklet node.
- **Analysis worker**:
  - File `src/lib/workers/analysis.worker.ts`. Inside, import Meyda/Essentia Wasm. Poll ring buffer every ~16 ms using `setInterval`. For each batch, compute pitch (YIN/CREPE), RMS, spectral centroid, onset detection. Emit `postMessage<AnalysisFrame>` only on significant deltas (threshold config).
  - Define message contract (`type WorkerMessage = { type: 'analysis-frame'; payload: AnalysisFrame } | { type: 'status'; ... }`). In main thread, create `analysisWorkerClient.ts` to abstract start/stop, hooking responses into `analysisStore`.
- **Visualizer**:
  - Build `src/lib/components/scene/AnalysisVisualizer.svelte` showing point cloud/wireframe using `<T.Points>` or `<T.LineSegments>` with attributes derived from live `AnalysisFrame`. Use energy as radial displacement, pitch as height, timbre as color gradient. Mount while recording; hide once final sculpture ready.

### Phase 3 – Physics Mapping & Sculpture Updates (PRD §4)
- **Mapping logic**: `src/lib/engine/physicsMapping.ts` exports `generateSculptureFromFrames(frames: AnalysisFrame[], profile: UserProfile): SculptureDefinition`. Steps per §4.1:
  1. Normalize pitch via profile bounds.
  2. Iterate frames, map energy to radius delta, accumulate into `radiusCurve` array (e.g., 128 samples).
  3. Smooth via moving average weighted by timbre.
  4. Derive `surface.textureRoughness` from timbre variance, `surface.glazeTransmission` from sustained energy, `deformation` from pitch drift (twist) and RMS spikes (compression).
- **Integration**: On recording stop, buffer frames, run `generateSculptureFromFrames`, update `sculptureStore`. Transition UI from point cloud to lathe mesh using Svelte transitions (e.g., `in:fly`, but implemented via `$effect` toggles per Svelte 5 rules).

### Phase 4 – AI Providers & Chat Panel (PRD §5)
- **Interface**: `src/lib/ai/types.ts` with `AISculptor` as provided. Add `type AISculptorStatus = "idle" | "loading" | "generating" | "error"`.
- **Cloud provider**:
  - `src/lib/ai/CloudAISculptor.ts` implementing `AISculptor`. In `initialize`, validate API key presence. `generateVariation` sends fetch to `AppSettings.cloudConfig.endpoint` with `messages` array and shared system prompt (PRD §5.4). Parse JSON-only responses, deep-merge into `SculptureDefinition`.
  - Handle HTTP, JSON parse, or schema errors by throwing typed errors.
- **Local provider**:
  - `src/lib/ai/LocalAISculptor.ts`: check `navigator.gpu?.requestAdapter`. If missing, throw `WebGPUUnavailableError`. Use `@mlc-ai/web-llm` to load `localConfig.modelId`. Expose progress events for UI (download weight progress). Mirror same `generateVariation` contract; run inference with prompt template and parse JSON.
- **AI Chat UI**:
  - Component `src/lib/components/panels/AIPanel.svelte`. Contains textarea, send button, provider switcher (local/cloud). On send: call active `AISculptor.generateVariation`, show spinner based on status, update `sculptureStore`. Provide message history view with user/AI entries, but store only metadata needed for replays to minimize memory.

### Phase 5 – UI Polish, Transport, Settings (PRD §6)
- **Transport controls**: `src/lib/components/controls/Transport.svelte` with record/play/stop buttons styled via `.button-primary/secondary`. Use runes state to show mic level meter (listens to `analysisStore`). Provide ghost visualization even when not recording (per §6.2).
- **Manual sliders**: Panel for adjusting `surface`, `deformation`, `baseProfile.height`. On slider hover, overlay ghost wireframe (maybe via secondary `SculptureDefinition` applied to transparent mesh). Use `$state` to store preview values, commit on release.
- **Settings modal**: Manage `AppSettings` (AI provider, endpoint, model, graphics quality). API key stored in `sessionStorage` by default; optional toggle to persist via `localStorage` with warning.
- **Project library (OPFS)**:
  - Create `src/lib/opfs/projectStore.ts`. Use `opfs-tools` to create directory `voice-to-sculpture/projects/`. JSON format: { sculpture: SculptureDefinition, metadata, optional audioPath }.
  - Maintain index via `idb-keyval` for quick listing. Provide left panel listing with load/delete options. Ensure OPFS writes happen off main thread (via worker or `navigator.storage.getDirectory()` with async operations).

### Phase 6 – Export Suite (PRD §7)
- **Image export**:
  - Implement `src/lib/export/renderHighRes.ts`. Temporarily increase renderer size to 4096², capture four camera positions (front/top/side/isometric) sequentially, collect `toDataURL` results, revert renderer state, and offer downloads (maybe zipped).
- **SVG profile export**:
  - `src/lib/export/radiusCurveToSvg.ts`: map `radiusCurve` to mm units based on user-selected height (e.g., 300 mm). Generate `<path>` using `M` + `L` commands. Provide download trigger writing to OPFS or direct blob.
- **Audio export**: Optional WAV write into OPFS using recorded samples (still kept off main thread; use worker to encode).

### Phase 7 – Error Handling, Fallbacks, QA (PRD §8–9)
- **Capability guards**: On startup, detect `SharedArrayBuffer` availability; if missing, show UI warning with instructions (set by `analysisStore`). Similar guard for WebGPU; fallback to WebGL render but disable Local AI with warning.
- **Performance**: Ensure no `console.log` inside render/audio loops. Use `requestIdleCallback` for OPFS housekeeping. Monitor GC by chunking worker messages.
- **Testing**:
  - Unit tests for `physicsMapping`, `radiusCurveToSvg`, AI merging.
  - Integration script verifying mic capture → sculpture pipeline (stubbed audio).
  - Manual QA: check transitions, ghost previews, OPFS persistence.
  - Browser coverage: Chrome/Edge/Firefox main; ensure instructions for Safari (needs COOP/COEP) documented in README.

### Delivery Checklist
- [ ] All required dirs/files exist with starter content.
- [ ] Types file matches PRD definitions verbatim.
- [ ] Audio pipeline runs entirely out of main thread for raw data.
- [ ] Scene uses Threlte + WebGPU-first, with fallback.
- [ ] AI providers conform to same interface and share prompt.
- [ ] UI matches layout + jewel theme; runes syntax enforced everywhere.
- [ ] Storage/export features meet OPFS + SVG specs.
- [ ] Capability fallbacks + warnings implemented.
- [ ] Lint/tests executed before handoff.