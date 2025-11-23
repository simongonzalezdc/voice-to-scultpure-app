# Current State Assessment
## Voice-to-Sculpture Studio - Technical Audit Report

**Date:** 2025-01-XX  
**Prepared For:** External Architectural Council  
**Purpose:** Pro-Tier Refactor Planning & Bug Resolution

---

## 1. Project Skeleton & Stack

### 1.1 File Structure

```
voice-to-scultpure-app/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte          # Root layout (minimal)
│   │   ├── +page.svelte            # Main entry point (514 lines)
│   │   └── +page.ts                # SSR config (disabled)
│   ├── lib/
│   │   ├── components/
│   │   │   ├── scene/              # 3D rendering components
│   │   │   │   ├── MainScene.svelte
│   │   │   │   ├── Sculpture.svelte (1028 lines - CRITICAL)
│   │   │   │   ├── AnalysisVisualizer.svelte
│   │   │   │   ├── ForceVisualizer.svelte
│   │   │   │   └── OrbitControls.svelte
│   │   │   ├── controls/           # UI controls
│   │   │   │   ├── Transport.svelte (255 lines)
│   │   │   │   └── ParameterSliders.svelte (790 lines - COMPLEX)
│   │   │   ├── panels/             # Feature panels
│   │   │   │   ├── AIPanel.svelte
│   │   │   │   ├── FabricationPanel.svelte (389 lines)
│   │   │   │   ├── GlazeMixer.svelte (340 lines)
│   │   │   │   └── SettingsPanel.svelte (171 lines)
│   │   │   ├── layout/             # Layout components
│   │   │   │   ├── Inspector.svelte
│   │   │   │   ├── Toolbar.svelte
│   │   │   │   └── WorkspaceSwitcher.svelte
│   │   │   └── modals/             # Modal dialogs
│   │   │       ├── NewProjectModal.svelte (306 lines)
│   │   │       └── KeyboardShortcutsModal.svelte
│   │   ├── stores/                 # State management (Svelte 5 runes)
│   │   │   ├── sculptureStore.svelte.ts
│   │   │   ├── recording.svelte.ts
│   │   │   ├── analysisStore.svelte.ts
│   │   │   ├── uiStore.svelte.ts (199 lines)
│   │   │   └── voiceLinksStore.svelte.ts
│   │   ├── audio/                  # Audio pipeline
│   │   │   ├── audioContext.ts (271 lines)
│   │   │   ├── ringBuffer.ts
│   │   │   ├── analysisWorkerClient.ts
│   │   │   └── calibration.ts
│   │   ├── workers/                # Web Workers
│   │   │   ├── analysis.worker.ts (248 lines)
│   │   │   └── recorder.worklet.js
│   │   ├── engine/                 # Core logic
│   │   │   ├── physicsMapping.ts (408 lines - CRITICAL)
│   │   │   └── constraints.ts (293 lines)
│   │   ├── ai/                     # AI integration
│   │   │   ├── CloudAISculptor.ts (220 lines)
│   │   │   ├── LocalAISculptor.ts (195 lines)
│   │   │   └── systemPrompt.ts
│   │   ├── export/                 # Export formats
│   │   │   ├── gltf.ts (171 lines)
│   │   │   ├── stl.ts
│   │   │   ├── ply.ts
│   │   │   └── blueprint.ts
│   │   ├── config/
│   │   │   └── constants.ts        # Centralized constants
│   │   └── types.ts                # TypeScript definitions
│   └── hooks.server.ts
├── tests/
│   └── e2e/
│       └── studio-flow.spec.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── svelte.config.js
└── tailwind.config.ts
```

**Excluded:** `node_modules/`, `.git/`, `.svelte-kit/`, `test-results/`

### 1.2 Configuration Analysis

#### Build Tool: **Vite 5.0.0**
- **Framework:** SvelteKit 2.0.0 (Svelte 5.0.0)
- **TypeScript:** 5.0.0 (strict mode enabled)
- **UI Library:** Threlte v9 (`@threlte/core` 8.3.0, `@threlte/extras` 9.7.0)
- **3D Engine:** Three.js 0.170.0

#### Key Config Details:

**`vite.config.ts`:**
- Security headers: `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Opener-Policy: same-origin` (required for SharedArrayBuffer)
- Threlte shim alias: `@threlte/core` → `src/lib/shims/threlte-core.ts`
- Worker format: ES modules

**`tsconfig.json`:**
- **Strict mode:** ✅ Enabled (`"strict": true`)
- **Target:** ES2022
- **Lib:** Includes `WebWorker`, `SharedArrayBuffer` support
- **Module resolution:** `bundler` (Vite-compatible)

**`package.json` Dependencies:**
- **Audio:** `meyda` 5.6.3 (audio feature extraction)
- **AI:** `@mlc-ai/web-llm` 0.2.79 (local WebGPU inference)
- **Storage:** `opfs-tools` 0.2.1, `idb-keyval` 6.2.1
- **3D:** `three` 0.170.0, `@threlte/core` 8.3.0, `@threlte/extras` 9.7.0

### 1.3 Entry Point

**Primary Entry:** `src/routes/+page.svelte` (514 lines)
- **Layout:** `src/routes/+layout.svelte` (minimal wrapper)
- **SSR:** Disabled (`export const ssr = false` in `+page.ts`)
- **Architecture:** Client-side only SPA (required for Web Audio API, SharedArrayBuffer, WebGPU)

**Component Hierarchy:**
```
+page.svelte
  ├── ErrorBoundary
  ├── CapabilityGuard
  ├── Canvas (@threlte/core)
  │   └── MainScene
  │       ├── Sculpture (1028 lines - CRITICAL COMPLEXITY)
  │       ├── AnalysisVisualizer
  │       └── OrbitControls
  ├── Inspector (right sidebar)
  ├── Toolbar (left rail)
  └── Transport (footer controls)
```

---

## 2. The "Brain" (State & Logic)

### 2.1 State Management Architecture

**Pattern:** Svelte 5 Runes (`$state`, `$derived`, `$effect`)

**Store Files:**

1. **`sculptureStore.svelte.ts`** (66 lines)
   - **State:** `currentSculpture`, `ghostSculpture`, `geometryDirty`, `interactionPoint`
   - **API:** `setCurrentSculpture()`, `updateSculptureColors()`, `setInteractionPoint()`

2. **`recording.svelte.ts`** (164 lines)
   - **State:** `state: 'idle' | 'recording' | 'processing' | 'complete'`
   - **State Machine:** Strict transitions with try/finally guards
   - **Frame Capture:** Reactive array `capturedFrames` (Svelte 5 `$state`)

3. **`analysisStore.svelte.ts`** (53 lines)
   - **State:** `micLevel`, `latestFrame`, `hasSharedArrayBuffer`
   - **Pitch Smoothing:** Exponential moving average (PITCH_SMOOTHING = 0.3)

4. **`uiStore.svelte.ts`** (199 lines)
   - **State:** Workspace mode (`sculpt`, `glaze`, `force`, `export`), panels, view settings, constraint mode
   - **Complexity:** Moderate (manages UI state across multiple modes)

5. **`voiceLinksStore.svelte.ts`**
   - **State:** Voice-to-parameter automation (`twist`, `roughness` links)

**Data Flow Pattern:**
```
AudioWorklet → RingBuffer → AnalysisWorker → analysisStore → recordingStore → sculptureStore
```

### 2.2 Voice-to-Sculpture Transformation Pipeline

**Location:** `src/lib/engine/physicsMapping.ts` (408 lines)

**Core Function:** `createSculptureFromFrames()`
```typescript
createSculptureFromFrames(
  frames: AnalysisFrame[],
  profile?: UserProfile,
  mode: 'additive' | 'subtractive',
  zone?: { min: number; max: number },
  constraintMode: ConstraintMode
): SculptureDefinition
```

**Transformation Steps:**

1. **`generateLathe()`** (Lines 27-236)
   - Maps `AnalysisFrame[]` → `LathePoint[]` (2D profile)
   - **Modes:** Standard (Volume→Radius) vs Melodic (Pitch→Radius)
   - **Noise Gate:** Filters silence using `NOISE_FLOOR_DEFAULT`
   - **Jitter Sources:** Timbre noise, attack detection, pitch ripple
   - **Zone Sculpting:** Maps frames to restricted height range

2. **`applyDeformation()`** (Lines 238-264)
   - Applies twist, compression, taper to curve
   - **Non-destructive:** Returns new array

3. **`applyConstraints()`** (from `constraints.ts`)
   - Fabrication constraints (digital/ceramic/3d-print)
   - Prevents pinching, ensures manufacturability

4. **`deriveSurfaceParameters()`** (Lines 266-307)
   - Calculates `textureRoughness` (from timbre) and `glazeTransmission` (from energy variance)

**Critical Logic:**
- **NaN Guards:** Multiple sanitization passes (lines 208-228)
- **Fallback:** Returns default cylinder if generation fails (lines 14-25, 230-233)
- **Magic Numbers:** Most extracted to `constants.ts`, but some remain (e.g., `0.3`, `0.5` multipliers)

### 2.3 Audio Engine Architecture

**Location:** `src/lib/audio/audioContext.ts` (271 lines)

**Audio Graph:**
```
MediaStream → InputGainNode → DynamicsCompressor → [WorkletNode, AnalyserNode]
                                                      ↓
                                              RingBuffer (SharedArrayBuffer)
                                                      ↓
                                              AnalysisWorker
```

**Key Components:**

1. **`initializeAudioContext()`** (Lines 28-88)
   - Creates `AudioContext` (44.1kHz)
   - Loads `recorder.worklet.js` (AudioWorklet processor)
   - Creates `DynamicsCompressorNode` for volume normalization
   - **Visualizer Bypass:** Parallel `AnalyserNode` for UI feedback

2. **`startMicrophoneCapture()`** (Lines 90-116)
   - Requests `getUserMedia()` with echo cancellation/noise suppression

3. **`startVisualizerBypass()`** (Lines 146-196)
   - Polls `AnalyserNode` at ~60fps
   - Calculates RMS from frequency bins
   - **Smoothing:** Exponential moving average (`SMOOTHING_FACTOR = 0.15`)

**Analysis Worker:** `src/lib/workers/analysis.worker.ts` (248 lines)

**Processing Loop:**
```typescript
function processLoop(): void {
  // Read from RingBuffer (SharedArrayBuffer)
  const buffer = new Float32Array(hopSize); // 512 samples
  const read = readIntoBuffer(ringBuffer, buffer);
  
  // Extract features using Meyda (stateless API)
  const features = Meyda.extract(['rms', 'zcr', 'spectralCentroid'], buffer);
  
  // Pitch detection via autocorrelation
  const pitch = estimatePitch(buffer, sampleRate);
  
  // Post frame to main thread
  self.postMessage({ type: 'analysis-frame', payload: frame });
}
```

**Pitch Detection:** Autocorrelation algorithm (lines 55-139)
- **Range:** 80-800Hz (human vocal range)
- **Threshold:** `CORRELATION_THRESHOLD = 0.5` (normalized)
- **Preprocessing:** DC offset removal, normalization

**Audio Data Flow:**
```
Microphone → AudioWorklet → SharedArrayBuffer → AnalysisWorker → analysisStore → UI
```

---

## 3. The "Body" (3D & Rendering)

### 3.1 3D Engine: Threlte v9 + Three.js

**Scene Graph:** Declarative JSX-like syntax (`<T.Mesh>`, `<T.Group>`)

**Main Scene:** `src/lib/components/scene/MainScene.svelte` (107 lines)
- **Camera:** `PerspectiveCamera` (FOV: 20-80°, derived from zoom)
- **Lighting:** `DirectionalLight` (rotatable) + `AmbientLight`
- **Controls:** Custom `OrbitControls` component
- **Ground:** Grid + ContactShadows

### 3.2 Mesh Generation

**Location:** `src/lib/components/scene/Sculpture.svelte` (1028 lines - **CRITICAL COMPLEXITY**)

**Geometry Generation:** `createGeometryFromSculpture()` (Lines 247-473)

**Process:**
1. **Base Shape Selection:** `lathe` (default), `sphere`, `cube`, `plane`
2. **Lathe Path:** `radiusCurve: LathePoint[]` → `Vector2[]` → `LatheGeometry`
3. **Deformations:** Twist (vertex-level), compression, taper
4. **Live Modulation:** Audio breathing effect (during recording)
5. **Constraints:** Fabrication constraints applied post-deformation
6. **Resolution:** Dynamic segments (6-64) based on `textureRoughness`

**Critical Code:**
```typescript
// Lines 376-379
const vectors = basePoints.map((p) => new Vector2(p.x, p.y));
const geometry = new LatheGeometry(vectors, segments);

// Lines 428-431: Vertex-level twist (spiral)
if (sculpture.deformation && Math.abs(sculpture.deformation.twist) > 0.001) {
  applyVertexTwist(geometry, sculpture.deformation.twist);
}
```

**Safety Mechanisms:**
- **Try-Catch Wrapper:** Entire function wrapped (lines 252-472)
- **Fallback Cylinder:** Returns `CylinderGeometry(0.5, 0.5, 1, 32)` on error
- **NaN Validation:** Checks points before geometry creation (lines 372-375)
- **Frustum Culling:** Disabled (`frustumCulled={false}`) to prevent invisible meshes

**Vertex Colors:** Used for glaze mode (non-destructive painting)
- Colors stored in `sculpture.vertexColors: number[]` (RGB per vertex)
- Resampling when vertex count changes (lines 145-184)

### 3.3 Performance Analysis

**Render Loop:** `useTask()` (Threlte's frame loop)

**Locations:**
- `Sculpture.svelte` (Line 588): Live audio modulation, force mode deformation
- `AnalysisVisualizer.svelte` (Lines 27, 94, 111): Smooth interpolation
- `ForceVisualizer.svelte` (Line 18): Reticle updates
- `ForceParticles.svelte` (Line 30): Particle system

**Memory Management:**

✅ **Good Practices:**
- Geometry disposal: `oldGeom.dispose()` before replacement (line 513)
- Buffer attributes marked `DynamicDrawUsage` for frequent updates
- `computeVertexNormals()` called after geometry changes

⚠️ **Potential Issues:**
- **Geometry Recreation:** `createGeometryFromSculpture()` called in `$effect()` (line 439)
  - Triggers on every sculpture/zone/constraint change
  - Could be optimized with dirty flags
- **Vertex Buffer Updates:** In `useTask()` (lines 634-666), positions updated every frame during force mode
  - Uses `needsUpdate = true` (correct)
  - But no throttling/debouncing

**Performance Metrics:**
- **Target:** 60fps (16ms frame budget)
- **Analysis Interval:** 16ms (~60fps) in worker
- **Visualizer Poll:** 16ms interval (setInterval)

---

## 4. Code Hygiene & Quality

### 4.1 Type Safety

**TypeScript Configuration:**
- ✅ **Strict mode:** Enabled (`"strict": true`)
- ✅ **Type Coverage:** High (interfaces defined in `types.ts`)
- ⚠️ **`any` Usage:** Only 2 instances (both in `LocalAISculptor.ts`):
  ```typescript
  let WebLLM: any = null;  // Line 7
  private engine: any = null;  // Line 22
  ```
  **Reason:** `@mlc-ai/web-llm` lacks TypeScript definitions

**Type Definitions:** `src/lib/types.ts` (124 lines)
- Comprehensive interfaces: `SculptureDefinition`, `AnalysisFrame`, `UserProfile`
- **Missing:** Some internal types could be exported (e.g., `ConstraintMode`)

### 4.2 Magic Numbers Audit

**Centralized Constants:** `src/lib/config/constants.ts` (50 lines)

**Extracted Constants:**
- Audio: `AUDIO_SAMPLE_RATE = 44100`, `MIC_SENSITIVITY_MULTIPLIER = 3.0`
- Sculpture: `SCULPTURE_BASE_RADIUS = 0.2`, `SCULPTURE_MAX_RADIUS = 1.5`
- Geometry: `GEOMETRY_MIN_SEGMENTS = 6`, `GEOMETRY_MAX_SEGMENTS = 64`

**Remaining Magic Numbers:**

1. **`Sculpture.svelte`:**
   - Line 150: `heightScale = height / 150` (150mm reference height) - **Should extract**
   - Line 312: `defaultPoints.push({ x: 0.5, y: t * 2 })` - `0.5` radius, `2` height range
   - Line 337: `breathScale = 1.0 + energy * 0.3` - `0.3` expansion factor
   - Line 469: `CylinderGeometry(0.5, 0.5, 1, 32)` - Fallback dimensions

2. **`physicsMapping.ts`:**
   - Line 154: `noiseMod = (Math.random() - 0.5) * normalizedRoughness * 0.3` - `0.3` multiplier
   - Line 167: `attackJitter = (Math.random() - 0.5) * 0.5` - `0.5` cut depth
   - Line 184: `pitchJitter = (Math.random() - 0.5) * pitchMultiplier * 0.25` - `0.25` multiplier

3. **`audioContext.ts`:**
   - Line 66: `dynamicsCompressor.threshold.value = -50` - Compression threshold
   - Line 67: `dynamicsCompressor.knee.value = 40` - Compression knee
   - Line 68: `dynamicsCompressor.ratio.value = 12` - Compression ratio

**Recommendation:** Extract remaining magic numbers to `constants.ts` with descriptive names.

### 4.3 TODO/FIXME Markers

**Search Results:** No critical `TODO`/`FIXME` markers found in source code.

**Documentation Markers:**
- `FRONTEND_AUDIT_REPORT.md`: Mentions "Export" actions buried in tabs (UX issue, not code)
- Various `.md` files contain test checklists and debugging notes (not code issues)

**Code Comments:**
- Extensive inline documentation (e.g., `Sculpture.svelte` has detailed directive comments)
- Some commented-out code blocks (e.g., `+page.svelte` lines 13-15: deprecated imports)

---

## 5. The "Broken Windows" (Known Issues)

### 5.1 File Complexity Analysis

**Overly Complex Files (>300 lines):**

1. **`Sculpture.svelte`** - **1,028 lines** ⚠️ **CRITICAL**
   - **Issues:**
     - Monolithic component handling geometry generation, rendering, live updates, force mode, glaze mode
     - Multiple responsibilities: geometry creation, vertex manipulation, material switching, zone visualization
     - **Refactor Target:** Split into:
       - `SculptureGeometry.svelte` (geometry generation)
       - `SculptureMesh.svelte` (rendering)
       - `SculptureLiveUpdate.svelte` (useTask logic)
       - `SculptureForceMode.svelte` (force mode deformation)

2. **`ParameterSliders.svelte`** - **790 lines** ⚠️
   - **Issues:**
     - Large component with many slider controls
     - **Refactor Target:** Split by feature (Deformation, Surface, Physical)

3. **`physicsMapping.ts`** - **408 lines** ⚠️
   - **Issues:**
     - Core transformation logic is complex but cohesive
     - **Status:** Acceptable complexity, but could benefit from extraction of jitter calculations

4. **`FabricationPanel.svelte`** - **389 lines**
   - **Status:** Moderate complexity, manageable

5. **`+page.svelte`** - **514 lines**
   - **Issues:**
     - Main entry point with layout logic
     - **Status:** Could extract layout shell to separate component

### 5.2 Known Bugs & Issues

**From Recent Changes (git status):**
- Modified files indicate recent work on:
  - `ParameterSliders.svelte`
  - `Transport.svelte`
  - `Sculpture.svelte`
  - `WorkspaceSwitcher.svelte`

**Recent Fixes (from code comments):**
1. **Frustum Culling:** Fixed invisible mesh issue (`frustumCulled={false}`)
2. **Safe Cylinder Fallback:** Added try-catch with fallback geometry
3. **Height Scale Validation:** Enhanced NaN/0 checks
4. **Pitch Smoothing:** Exponential moving average to prevent jitter
5. **Volume Smoothing:** RMS smoothing in visualizer bypass

**Potential Issues:**

1. **Memory Leaks:**
   - Geometry disposal: ✅ Properly handled (`oldGeom.dispose()`)
   - Audio context cleanup: ✅ `resetAudioContext()` disconnects all nodes
   - **Risk:** Worker cleanup on page unload (no explicit `worker.terminate()`)

2. **Race Conditions:**
   - Recording state transitions: ✅ Protected with try/finally (line 87-141 in `recording.svelte.ts`)
   - Geometry updates during recording: ⚠️ `$effect()` skips during recording (line 451), but `useTask()` still runs

3. **Performance:**
   - Geometry recreation: ⚠️ `createGeometryFromSculpture()` called on every reactive change
   - **Optimization:** Could use dirty flags (`geometryDirty`) to throttle updates

4. **Type Safety:**
   - `LocalAISculptor.ts`: Uses `any` for WebLLM (external library limitation)
   - **Mitigation:** Could create wrapper types

### 5.3 Architectural Debt

1. **Component Coupling:**
   - `Sculpture.svelte` directly imports `uiStore`, `recordingStore`, `analysisStore`
   - **Impact:** Hard to test, tight coupling

2. **State Management:**
   - Multiple stores with overlapping concerns (e.g., `uiStore` vs `sculptureStore`)
   - **Status:** Acceptable for Svelte 5 runes pattern

3. **Audio Pipeline:**
   - Complex chain: Worklet → RingBuffer → Worker → Store
   - **Status:** Well-architected, but could benefit from error boundaries

4. **Export System:**
   - Multiple export formats (GLTF, STL, PLY, SVG, PNG)
   - **Status:** Well-organized in `src/lib/export/`

---

## Summary & Recommendations

### Strengths
1. ✅ **Modern Stack:** Svelte 5, Threlte v9, TypeScript strict mode
2. ✅ **Architecture:** Clean separation of concerns (audio, 3D, state)
3. ✅ **Safety:** Extensive NaN guards, fallback geometries, error handling
4. ✅ **Performance:** Proper geometry disposal, buffer usage flags
5. ✅ **Type Safety:** High coverage, minimal `any` usage

### Critical Refactor Targets
1. **`Sculpture.svelte` (1,028 lines):** Split into focused components
2. **`ParameterSliders.svelte` (790 lines):** Extract feature-specific sliders
3. **Magic Numbers:** Extract remaining hardcoded values to `constants.ts`

### Pro-Tier Improvements
1. **Performance:**
   - Implement dirty flags for geometry updates
   - Throttle vertex buffer updates in force mode
   - Add worker cleanup on page unload

2. **Type Safety:**
   - Create TypeScript definitions for `@mlc-ai/web-llm`
   - Export internal types from `constraints.ts`

3. **Testing:**
   - Add unit tests for `physicsMapping.ts` transformations
   - Add integration tests for audio pipeline
   - E2E tests for recording → sculpture flow

4. **Documentation:**
   - Add JSDoc comments to public APIs
   - Document audio pipeline architecture
   - Create component dependency graph

---

**Report End**

