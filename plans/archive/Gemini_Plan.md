# Voice-to-Sculpture Studio - Implementation Master Plan

**Target Stack:** Svelte 5 (Runes), Threlte v9, Three.js (r170+), Web Audio (Worklets), WebGPU (with WebGL fallback).

## Phase 1: Foundation & Configuration

### 1.1 Project Initialization

- [ ] Initialize SvelteKit project (Skeleton, TypeScript, Prettier, ESLint).
- [ ] Install Dependencies:
  - **Core:** `svelte@next`, `@sveltejs/kit`, `three`, `@threlte/core`, `@threlte/extras`
  - **Audio:** `meyda` (or `essentia.js` if preferred for complex features, start with Meyda for simplicity/size).
  - **AI:** `@mlc-ai/web-llm`.
  - **Storage:** `opfs-tools`, `idb-keyval`.
  - **Styling:** `tailwindcss`, `@tailwindcss/vite`.

### 1.2 Environment Configuration

- [ ] **Vite Config (`vite.config.ts`):**
  - Enable `Cross-Origin-Opener-Policy: same-origin`
  - Enable `Cross-Origin-Embedder-Policy: require-corp` (Required for `SharedArrayBuffer`).
- [ ] **Tailwind Config (`tailwind.config.ts`):**
  - Implement "Jewel Engine" theme tokens from `jewel-engine-theme-lowcontrast-garnet-topaz.css`.
  - Map colors: `--bg-body` (#111015), `--brand-primary` (#8F3E48), etc.

### 1.3 Core Type Definitions (`src/lib/types.ts`)

- [ ] Implement `SculptureDefinition` (id, timestamp, baseProfile, surface, deformation).
- [ ] Implement `UserProfile` (calibration data).
- [ ] Implement `AppSettings` (AI provider config).
- [ ] Implement `AudioRingBuffer` & `AnalysisFrame` interfaces.

### 1.4 Audio & 3D Scaffolding

- [ ] Create `src/lib/audio/recorder.worklet.ts` (Raw capture).
- [ ] Create `src/lib/audio/analysis.worker.ts` (Heavy lifting).
- [ ] Create `src/lib/stores/audio.svelte.ts` (Global audio state manager using runes).
- [ ] Create `src/lib/components/scene/MainScene.svelte` (Threlte Canvas entry).

---

## Phase 2: The Engine (Audio -> 3D)

### 2.1 Audio Pipeline Implementation

- [ ] **Worklet:** Implement circular buffer writing in `recorder.worklet.ts`.
- [ ] **Shared Memory:** Set up `SharedArrayBuffer` initialization in main thread.
- [ ] **Worker:** Implement feature extraction (Pitch/YIN, RMS, Spectral Centroid) in `analysis.worker.ts`.
- [ ] **Transport:** Efficient `postMessage` loop (only send data on change/interval) to Main Thread.

### 2.2 Physics-Based Sculpture Logic

- [ ] **Math Helper:** Create `src/lib/utils/sculpture-mapping.ts`.
  - Logic: `radius[h] += loudness * pressure` modulated by `timbre`.
- [ ] **Geometry:** Implement dynamic `LatheGeometry` generation in `Sculpture.svelte`.
- [ ] **Visualizer:** Create `RealtimePoint.svelte` or `WireframeRing.svelte` for live feedback during recording.

### 2.3 Material & Rendering

- [ ] Configure `WebGPURenderer` in Threlte.
- [ ] Create PBR Material (Porcelain/Clay):
  - Transmission > 0.5 for "glaze".
  - Roughness mapped from `SculptureDefinition`.
  - Noise texture for realistic clay surface.

---

## Phase 3: Hybrid AI Architecture

### 3.1 AI Core

- [ ] Define `AISculptor` interface in `src/lib/ai/types.ts`.
- [ ] Create `src/lib/ai/systemPrompt.ts` with the prompt from `Voice-to-Sculpture Studio — System Prompts.txt`.

### 3.2 Providers

- [ ] **Cloud:** Implement `CloudAISculptor.ts` (Fetch OpenAI-compatible API).
- [ ] **Local:** Implement `LocalAISculptor.ts` using `@mlc-ai/web-llm`.
  - Handle model downloading/caching progress state.
  - Check WebGPU support.

### 3.3 UI Integration

- [ ] Create Chat Interface (Floating Panel).
- [ ] Connect Chat input -> `AISculptor.generateVariation()` -> Update Global State -> Re-render Mesh.

---

## Phase 4: Polish, Storage & Export

### 4.1 Storage (OPFS)

- [ ] Implement `ProjectManager` class.
- [ ] Save: Write JSON + optional WAV to OPFS.
- [ ] List: Use `idb-keyval` for fast metadata listing, read blob from OPFS on open.

### 4.2 Export Pipeline

- [ ] **Image:** `renderer.domElement.toDataURL` (High-res render pass).
- [ ] **SVG:** Generate 2D profile path for physical fabrication (laser cutting/printing templates).

### 4.3 UI Refinement

- [ ] Apply "Jewel Engine" styles to all panels.
- [ ] Add "Ghost" sliders (preview state on hover).
- [ ] Add Svelte transitions (`in:fly`, `out:fade`).
