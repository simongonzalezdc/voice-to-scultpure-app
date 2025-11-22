# Voice-to-Sculpture Studio — Implementation Plan

**Generated:** November 21, 2025  
**Based On:** Technical Specification v2.0 + Jewel Engine Theme  
**Target:** Production-ready web application with game-like responsiveness

---

## 📋 Executive Summary

This plan breaks down the development of Voice-to-Sculpture Studio into **6 phases** with **35 discrete tasks**. The architecture prioritizes:

1. **Real-time Performance** — Audio/render threads decoupled from UI
2. **Progressive Enhancement** — WebGPU → WebGL2 fallback
3. **Privacy-First** — Local AI option, OPFS storage
4. **Physical Metaphors** — Pottery wheel physics, not data visualization

**Estimated Timeline:** 6-8 weeks (1 developer) or 3-4 weeks (team of 2)

---

## 🏗️ Phase 1: Foundation (Week 1)

### Objective

Set up the development environment with all core dependencies and prove the basic rendering pipeline works.

### Tasks

#### 1.1 Project Scaffolding

```bash
npm create svelte@latest . -- --template skeleton --types typescript
npm install -D tailwindcss @tailwindcss/vite autoprefixer
npm install three @threlte/core @threlte/extras
```

**Key Files to Create:**

- `svelte.config.js` — Adapter-static configuration
- `tailwind.config.js` — Import Jewel theme tokens
- `src/app.css` — Global styles with theme variables

#### 1.2 Vite Configuration (Critical)

**File:** `vite.config.ts`

Must include cross-origin isolation headers for `SharedArrayBuffer`:

```typescript
export default defineConfig({
	plugins: [sveltekit()],
	server: {
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		}
	}
});
```

#### 1.3 Type System Foundation

**File:** `src/lib/types.ts`

Define all core types from spec Section 2:

- `UserProfile` (calibration data)
- `SculptureDefinition` (the "DNA")
- `AppSettings` (AI/graphics config)
- `AudioRingBuffer` (shared memory layout)
- `AnalysisFrame` (per-frame audio features)

#### 1.4 Theme Integration

**Strategy:** Convert CSS custom properties → Tailwind config

**File:** `tailwind.config.js`

```javascript
export default {
	theme: {
		extend: {
			colors: {
				'jewel-garnet': '#8F3E48',
				'jewel-topaz': '#B5933C'
				// ... rest of jewel palette
			}
		}
	}
};
```

#### 1.5 Basic Layout (Svelte 5 Runes)

**File:** `src/routes/+page.svelte`

Structure:

```
┌─────────────────────────────────┐
│  Header (Logo, Settings)        │
├─────────────────────────────────┤
│                                 │
│    Threlte Canvas (Fullscreen)  │
│                                 │
│  [Transport]  [AI Panel]        │
└─────────────────────────────────┘
```

**Components to Build:**

- `src/lib/components/layout/Header.svelte`
- `src/lib/components/layout/TransportControls.svelte`
- `src/lib/components/layout/AIPanel.svelte`

**State Pattern (Svelte 5):**

```typescript
let isRecording = $state(false);
let currentSculpture = $state<SculptureDefinition | null>(null);
```

#### 1.6 Threlte Scene Proof-of-Concept

**File:** `src/lib/components/scene/Scene.svelte`

Render a static `LatheGeometry` to verify:

- WebGPU renderer initialization
- Basic PBR material
- Camera controls (OrbitControls)

**Success Criteria:**
✅ Dev server runs without COOP/COEP errors  
✅ Threlte canvas renders a rotating shape  
✅ Tailwind theme classes work correctly

---

## 🎙️ Phase 2: Audio Engine (Week 2)

### Objective

Build the zero-latency audio pipeline: Mic → Worklet → SharedArrayBuffer → Worker → Analysis → Main Thread.

### Architecture Diagram

```
┌──────────┐   Float32   ┌────────────────┐   Ring    ┌─────────────┐
│   Mic    │──────────────│ AudioWorklet   │──Buffer───│  Worker     │
└──────────┘              │ (recorder.ts)  │           │ (analysis)  │
                          └────────────────┘           └──────┬──────┘
                                                              │
                                                        AnalysisFrame
                                                              │
                                                        ┌─────▼──────┐
                                                        │ Main Thread│
                                                        └────────────┘
```

### Tasks

#### 2.1 AudioContext Initialization

**File:** `src/lib/audio/context.ts`

```typescript
export class AudioEngine {
	private ctx: AudioContext | null = null;
	private workletNode: AudioWorkletNode | null = null;

	async initialize() {
		// Resume on user gesture
		this.ctx = new AudioContext();
		await this.ctx.audioWorklet.addModule('/recorder.worklet.js');
		// ...
	}
}
```

**Requirement:** Context starts `suspended`, resumes on first button click.

#### 2.2 AudioWorklet Processor

**File:** `static/recorder.worklet.js` (or `.ts` compiled)

```javascript
class RecorderProcessor extends AudioWorkletProcessor {
	process(inputs, outputs, parameters) {
		const input = inputs[0][0]; // Mono channel
		if (!input) return true;

		// Write to SharedArrayBuffer (Ring Buffer)
		// NO ANALYSIS HERE — pure transport

		return true;
	}
}
```

#### 2.3 Ring Buffer Implementation

**File:** `src/lib/audio/ringbuffer.ts`

**Memory Layout:**

```
[0]           → Write Pointer (Atomics)
[1]           → Read Pointer (Atomics)
[2 ... N]     → Audio samples (Float32)
```

**Functions:**

- `write(sample: number)` — Called by Worklet
- `read(numSamples: number): Float32Array` — Called by Worker

#### 2.4 Analysis Worker

**File:** `src/lib/workers/analysis.worker.ts`

**Dependencies:** `meyda` or `essentia.js`

**Loop:**

```typescript
setInterval(() => {
	const samples = ringBuffer.read(2048); // FFT size

	const features = Meyda.extract({
		audioContext: null, // Offline mode
		signal: samples,
		bufferSize: 2048,
		featureExtractors: ['rms', 'zcr', 'spectralCentroid']
	});

	const frame: AnalysisFrame = {
		time: performance.now(),
		pitch: detectPitch(samples), // YIN algorithm
		energy: features.rms,
		timbre: features.spectralCentroid
		// ...
	};

	postMessage(frame);
}, 16); // ~60fps
```

#### 2.5 Calibration System

**File:** `src/lib/audio/calibration.ts`

**Process:**

1. Record 10 seconds of user speaking normally
2. Calculate percentiles: `p5(pitch)`, `p95(pitch)`
3. Store in `UserProfile` → LocalStorage
4. Use to normalize all future recordings

**UI:** Modal prompting user to read a sample phrase.

#### 2.6 Real-Time Visualizer

**File:** `src/lib/components/scene/RealtimeVisualizer.svelte`

**During Recording:** Show a spinning point cloud or wireframe that reacts to `AnalysisFrame` data.

**Tech:** Use `<T.Points>` (Threlte) with a geometry updated via `useTask`.

**Success Criteria:**
✅ Mic input captured without main-thread jank  
✅ Analysis frames arrive at 60fps  
✅ Visualizer responds < 50ms latency

---

## 🏺 Phase 3: Sculpture Engine (Week 3-4)

### Objective

Transform audio features into ceramic geometry using physics-based metaphors.

### The "Lathe" Algorithm

**Input:** Array of `AnalysisFrame[]` (e.g., 600 frames for 10 seconds @ 60fps)

**Output:** `radiusCurve: number[]` (the vase profile)

**Metaphor Mapping:**

- **Pitch (Hz)** → **Vertical Position** (0 = base, 1 = rim)
- **Energy (RMS)** → **Outward Pressure** (pushes clay out)
- **Timbre (Centroid)** → **Surface Smoothness** (sharp = ridges, soft = smooth)

**Pseudocode:**

```typescript
function generateLathe(frames: AnalysisFrame[], profile: UserProfile): number[] {
	const curve = new Array(100).fill(0.2); // Start with cylinder

	for (const frame of frames) {
		const h = normalize(frame.pitch, profile.lowPitchHz, profile.highPitchHz);
		const index = Math.floor(h * curve.length);

		const pressure = frame.energy * 0.5; // Coefficient
		curve[index] += pressure;
	}

	// Apply smoothing based on average timbre
	return smoothCurve(curve, timbreBasedKernel);
}
```

### Tasks

#### 3.1 Physics Mapping Implementation

**File:** `src/lib/sculpture/generator.ts`

**Functions:**

- `generateLathe(frames, profile): number[]`
- `applyDeformation(curve, def): number[]` — Twist/compression
- `smoothCurve(curve, kernel): number[]` — Moving average

#### 3.2 Sculpture Component (Threlte)

**File:** `src/lib/components/scene/Sculpture.svelte`

**Key Features:**

```svelte
<script lang="ts">
	let { definition } = $props<{ definition: SculptureDefinition }>();

	// Reactively rebuild geometry
	let geometry = $derived(createLatheGeometry(definition.baseProfile.radiusCurve));
</script>

<T.Mesh {geometry}>
	<T.MeshPhysicalMaterial
		color="#FDFDFD"
		roughness={definition.surface.textureRoughness}
		transmission={definition.surface.glazeTransmission}
		thickness={0.5}
	/>
</T.Mesh>
```

**Material Goals:**

- Porcelain/ceramic look
- Transmission for glassy glaze effect
- Subtle displacement map for ridges

#### 3.3 Recording State Machine

**File:** `src/lib/stores/recording.svelte.ts`

**States:** `idle` → `recording` → `processing` → `complete`

**Transitions:**

- `START` → Begin audio capture + visualizer
- `STOP` → Freeze frames → Generate lathe → Morph visual
- `RESET` → Clear sculpture

**Use Svelte 5 `$effect` for side effects:**

```typescript
$effect(() => {
	if (recordingState === 'processing') {
		const sculpture = generateSculpture(capturedFrames);
		currentSculpture = sculpture;
		recordingState = 'complete';
	}
});
```

#### 3.4 Manual Parameter Controls

**File:** `src/lib/components/controls/ParameterSliders.svelte`

**Controls:**

- Height (0-1)
- Twist Torque (-π to π)
- Vertical Compression (0-1)
- Surface Roughness (0-1)
- Glaze Transmission (0-1)

**Ghost Preview:**
On slider `mousedown`:

1. Clone current sculpture
2. Apply new parameter
3. Render as wireframe overlay (opacity 0.3)
4. On `mouseup`, commit change

**Success Criteria:**
✅ Voice recording generates recognizable vase shape  
✅ Pitch changes correlate to vertical variation  
✅ Manual sliders work with instant feedback

---

## 🤖 Phase 4: Hybrid AI System (Week 4-5)

### Objective

Enable text-driven sculpture modification via local or cloud AI.

### Interface Contract

**File:** `src/lib/ai/types.ts`

```typescript
export interface AISculptor {
	initialize(): Promise<void>;
	generateVariation(
		current: SculptureDefinition,
		instruction: string
	): Promise<SculptureDefinition>;
	getStatus(): 'idle' | 'loading' | 'generating' | 'error';
}
```

### Tasks

#### 4.1 Cloud Provider (Easier First)

**File:** `src/lib/ai/CloudAISculptor.ts`

**Config:** User provides API key + endpoint in Settings modal.

**System Prompt:**

```
You are a ceramic design assistant.
Input: JSON of a vase.
User instruction: "Make it taller and add a twist."
Output: ONLY the modified JSON. No explanations.
```

**Implementation:**

```typescript
async generateVariation(current, instruction) {
  const response = await fetch(this.config.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: this.config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Current: ${JSON.stringify(current)}\nRequest: ${instruction}` }
      ]
    })
  });

  const json = await response.json();
  return mergeSculpture(current, JSON.parse(json.choices[0].message.content));
}
```

#### 4.2 Local Provider (WebLLM)

**File:** `src/lib/ai/LocalAISculptor.ts`

**Dependencies:** `@mlc-ai/web-llm`

**Workflow:**

1. Check `navigator.gpu` (WebGPU)
2. Download model weights to Cache API (show progress)
3. Initialize engine
4. Run inference (same prompt structure)

**Model Selection:**

- Desktop: `Llama-3-8B-Instruct-q4f16_1`
- Mobile: `Phi-3-mini-4k-instruct-q4f16_1`

#### 4.3 AI Chat UI

**File:** `src/lib/components/ai/ChatPanel.svelte`

**Features:**

- Message history (user/assistant)
- Text input with Enter-to-send
- Loading state during generation
- Error handling (API failures, JSON parsing)

**Layout:** Right-side floating panel (slide in/out).

#### 4.4 Settings Modal

**File:** `src/lib/components/settings/SettingsModal.svelte`

**Tabs:**

1. **AI Provider**
   - Radio: Local / Cloud
   - If Cloud: Input for endpoint, API key, model name
   - If Local: Model selector dropdown

2. **Graphics**
   - Quality: Low / High (affects shadows, SSAO)

3. **Audio**
   - Input device selector
   - Calibration reset button

**Storage:** Use `localStorage` for settings (encrypt API key if possible).

**Success Criteria:**
✅ Cloud AI successfully modifies sculpture via text  
✅ Local AI initializes and runs (tested on Chrome/Edge)  
✅ Interface is identical for both providers

---

## 💾 Phase 5: Storage & Export (Week 5-6)

### Objective

Persist projects locally and export in multiple formats.

### OPFS Strategy

**Why OPFS?**

- Faster than IndexedDB for large blobs
- No quota prompts (on most browsers)
- Direct file-like API

**File Structure:**

```
/opfs/
  /projects/
    /{projectId}.json      → SculptureDefinition
    /{projectId}.wav       → Optional audio
```

### Tasks

#### 5.1 OPFS Save/Load

**File:** `src/lib/storage/opfs.ts`

**Dependencies:** `opfs-tools` (wrapper library)

**Functions:**

```typescript
export async function saveProject(sculpture: SculptureDefinition, audio?: Blob) {
	const root = await navigator.storage.getDirectory();
	const projectsDir = await root.getDirectoryHandle('projects', { create: true });

	const file = await projectsDir.getFileHandle(`${sculpture.id}.json`, { create: true });
	const writable = await file.createWritable();
	await writable.write(JSON.stringify(sculpture));
	await writable.close();

	if (audio) {
		const audioFile = await projectsDir.getFileHandle(`${sculpture.id}.wav`, { create: true });
		const audioWritable = await audioFile.createWritable();
		await audioWritable.write(audio);
		await audioWritable.close();
	}
}

export async function loadProject(id: string): Promise<SculptureDefinition> {
	// ...
}
```

#### 5.2 Project Library UI

**File:** `src/lib/components/library/ProjectList.svelte`

**Features:**

- List all projects (thumbnail + name + date)
- Click to load
- Delete button
- Filter/search

**Data Source:** On mount, scan OPFS directory.

#### 5.3 High-Res Image Export

**File:** `src/lib/export/image.ts`

**Strategy:**

1. Create off-screen renderer (4096x4096)
2. Position camera (front, top, side, iso)
3. Render each view
4. Convert to PNG via `toDataURL()`
5. Zip all 4 views + download

**Library:** `jszip` for bundling.

#### 5.4 SVG Profile Export

**File:** `src/lib/export/svg.ts`

**Purpose:** Generate a 2D cutting template for physical fabrication.

**Algorithm:**

```typescript
function exportSVGProfile(radiusCurve: number[], heightMM: number) {
	const scaleY = heightMM / radiusCurve.length;
	const points = radiusCurve.map((r, i) => `${r * 100},${i * scaleY}`).join(' ');

	return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${heightMM}">
      <polyline points="${points}" stroke="black" fill="none" />
    </svg>
  `;
}
```

**UI:** Button in export menu → "Download SVG Template (300mm height)".

#### 5.5 Audio Recording Save

**File:** `src/lib/export/audio.ts`

**Format:** WAV (uncompressed PCM)

**Strategy:**

- Convert `Float32Array` from analysis frames → WAV blob
- Save alongside JSON in OPFS

**Library:** `audiobuffer-to-wav`

**Success Criteria:**
✅ Projects persist across browser sessions  
✅ Exported images are 4K resolution  
✅ SVG files import correctly into Inkscape/Illustrator

---

## ✨ Phase 6: Polish & Performance (Week 6-8)

### Objective

Production-ready: Graceful fallbacks, optimizations, and onboarding.

### Tasks

#### 6.1 WebGPU Fallback Detection

**File:** `src/lib/rendering/renderer.ts`

```typescript
export function createRenderer(canvas: HTMLCanvasElement) {
	if (navigator.gpu) {
		return new WebGPURenderer({ canvas });
	} else {
		console.warn('WebGPU unavailable, falling back to WebGL2');
		return new WebGLRenderer({ canvas, antialias: true });
	}
}
```

**Note:** Some TSL materials may need WebGL equivalents.

#### 6.2 Quality Settings

**File:** `src/lib/stores/settings.svelte.ts`

**Effects of `quality: "low"`:**

- Shadow map size: 512 → 1024
- Disable SSAO
- Reduce particle count in visualizer

**Effects of `quality: "high"`:**

- Shadow map size: 2048+
- Enable SSAO
- 4x MSAA

#### 6.3 Render Loop Optimization

**Strategy:**

- Use Threlte's `useTask` (not `requestAnimationFrame`)
- Skip expensive calculations when sculpture is static
- Implement dirty flags (only rebuild geometry on parameter change)

**File:** `src/lib/components/scene/Sculpture.svelte`

```typescript
let geometryDirty = $state(false);

$effect(() => {
	if (definition) geometryDirty = true;
});

useTask(() => {
	if (geometryDirty) {
		rebuildGeometry();
		geometryDirty = false;
	}
});
```

#### 6.4 Error Boundaries & Fallbacks

**Scenarios:**

1. **SharedArrayBuffer missing** → Show banner: "Cross-origin isolation required"
2. **Microphone denied** → Show permission prompt
3. **WebGPU + WebGL fail** → Show "Browser not supported"
4. **AI generation fails** → Retry button + error message

**Implementation:** Use Svelte's error boundaries (or manual try/catch).

#### 6.5 Onboarding Flow

**File:** `src/lib/components/onboarding/Tutorial.svelte`

**Steps:**

1. Welcome screen (explain concept)
2. Microphone permission request
3. Calibration (record sample)
4. First recording tutorial (tooltip overlays)
5. AI tutorial (optional)

**Tech:** Use a stepped modal with `in:fly` transitions.

**Success Criteria:**
✅ App works on Chrome, Edge, Firefox (latest)  
✅ Graceful degradation on unsupported browsers  
✅ First-time users complete onboarding without confusion

---

## 📦 Dependencies Checklist

### Core Framework

- `svelte` + `@sveltejs/kit` + `@sveltejs/adapter-static`
- `typescript`
- `vite`

### 3D Rendering

- `three` (r170+)
- `@threlte/core` (v9+)
- `@threlte/extras`

### Audio Processing

- `meyda` or `essentia.js`
- `audiobuffer-to-wav` (export)

### AI (Conditional)

- `@mlc-ai/web-llm` (local)
- Standard `fetch` (cloud)

### Storage

- `opfs-tools` (OPFS wrapper)
- `idb-keyval` (project index)

### Export

- `jszip` (multi-image export)

### Styling

- `tailwindcss` (v4)
- `autoprefixer`

---

## 🎯 Success Metrics

### Performance Targets

- **Audio Latency:** < 50ms (mic → visualizer)
- **Frame Rate:** 60fps during recording
- **Sculpture Generation Time:** < 2s for 10s recording
- **AI Response Time:** < 5s (cloud), < 10s (local on M1+ Mac)

### User Experience

- **First Recording:** < 3 minutes from landing → saved sculpture
- **AI Iteration:** < 30 seconds per variation
- **Export Speed:** < 5s for 4-view image bundle

### Browser Compatibility

| Feature           | Chrome/Edge | Firefox         | Safari              |
| ----------------- | ----------- | --------------- | ------------------- |
| Core App          | ✅          | ✅              | ✅                  |
| SharedArrayBuffer | ✅          | ✅              | ⚠️ Requires headers |
| WebGPU            | ✅          | ⚠️ Experimental | ❌ (WebGL fallback) |
| Local AI          | ✅          | ❌ (no WebGPU)  | ❌                  |

---

## 🚨 Risk Mitigation

### High-Risk Areas

1. **SharedArrayBuffer** — Requires COOP/COEP headers (already addressed in Vite config)
2. **WebGPU adoption** — Fallback to WebGL2 (already planned)
3. **AI JSON parsing** — Strict schema validation + retry logic
4. **Audio latency on low-end devices** — Adaptive buffer sizes

### Testing Strategy

- **Unit Tests:** Audio ring buffer, lathe algorithm
- **Integration Tests:** Full audio → sculpture pipeline
- **Browser Tests:** Playwright on Chrome, Firefox, Edge
- **Performance Profiling:** Chrome DevTools Performance tab

---

## 📝 Development Commands

```bash
# Install
npm install

# Dev server (with COOP/COEP headers)
npm run dev

# Type checking
npm run check

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🎨 Design System Integration

The Jewel Engine theme is integrated via Tailwind config. Key class patterns:

```html
<!-- Surface -->
<div class="bg-[var(--bg-panel)] border border-[var(--border-subtle)]">
	<!-- Primary button -->
	<button
		class="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--text-primary)]"
	>
		Record
	</button>

	<!-- Status badge -->
	<span class="badge badge-success">Recording</span>
</div>
```

**Custom components follow the theme automatically.**

---

## 🏁 Definition of Done

The project is complete when:

1. ✅ User can record voice and see a 3D sculpture
2. ✅ AI modifications work (local or cloud)
3. ✅ Projects save and load from OPFS
4. ✅ All 3 export formats work (PNG, SVG, WAV)
5. ✅ App runs smoothly on mid-range hardware (60fps)
6. ✅ Error states are handled gracefully
7. ✅ First-time user completes onboarding successfully

---

## 📞 Next Steps

**To begin implementation, start with Phase 1, Task 1.1:**

```bash
npm create svelte@latest . -- --template skeleton --types typescript
```

Then proceed sequentially through the checklist in the TODO system.

**Questions? Areas needing clarification before starting?**
