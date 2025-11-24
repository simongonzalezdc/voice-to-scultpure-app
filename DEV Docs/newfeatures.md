# ⚡ TECHNICAL SPECIFICATION: ZERO-COST FEATURE SUITE
**Version:** 1.0
**Objective:** Implement high-impact visual, mathematical, and audio features without degrading 60fps performance.
**Stack:** Svelte 5, Threlte (Three.js), Web Audio API.

---

## 1. VISUALS & ATMOSPHERE (GPU/Material Level)
**Goal:** Enhance immersion using standard Three.js material properties and scene environment switching.

### 1.1 Bioluminescence (Voice-Reactive Emission)
*   **Target:** `src/lib/components/scene/Sculpture.svelte`
*   **Implementation:**
    *   Bind the `emissive` and `emissiveIntensity` properties of the `<T.MeshPhysicalMaterial>`.
    *   **Logic:**
        ```typescript
        // Inside useTask loop (Recording State)
        const glow = Math.max(0, (analysisStore.micLevel - 0.1) * 2.0); // Normalize
        materialProps.emissiveIntensity = glow * 3.0; // Boost intensity
        materialProps.emissive = uiStore.activeGlaze.color; // Glow with the glaze color
        ```
*   **Idle State:** When not recording, pulse gently: `Math.sin(Date.now() / 1000) * 0.2`.

### 1.2 Heatmap Mode (Stress Visualization)
*   **Target:** `src/lib/engine/analysis.ts` (New utility function)
*   **Logic:** Calculate curvature (stress) based on the change in slope between points.
*   **Algorithm:**
    ```typescript
    export function calculateStressColors(points: Vector2[]): Float32Array {
        const colors = [];
        for (let i = 1; i < points.length - 1; i++) {
            // Calculate angle change between segments
            const v1 = points[i].clone().sub(points[i-1]).normalize();
            const v2 = points[i+1].clone().sub(points[i]).normalize();
            const dot = v1.dot(v2); // 1.0 = Straight, < 0.5 = Sharp Angle
            
            // Map to Color (Red = High Stress, Blue = Low Stress)
            const stress = 1.0 - dot; 
            const color = new Color().setHSL(0.6 - (stress * 0.6), 1.0, 0.5);
            colors.push(color.r, color.g, color.b);
        }
        return new Float32Array(colors);
    }
    ```
*   **Usage:** Apply as `vertexColors` when "Heatmap Mode" is active in the View Settings.

### 1.3 X-Ray / Ghost View
*   **Target:** `src/lib/components/scene/Sculpture.svelte`
*   **Implementation:** Add a toggle in `FabricationPanel`.
    ```typescript
    <T.MeshPhysicalMaterial
        transparent={uiStore.viewMode === 'xray'}
        opacity={uiStore.viewMode === 'xray' ? 0.3 : 1.0}
        wireframe={uiStore.viewMode === 'wireframe'}
        // ... existing props
    />
    ```

### 1.4 Studio Lighting Setups
*   **Target:** `src/lib/components/scene/MainScene.svelte`
*   **Data Model:**
    ```typescript
    const ENVIRONMENTS = {
        'studio': { map: 'studio_small_03_1k.hdr', intensity: 1 },
        'neon': { map: 'city_night_1k.hdr', intensity: 0.5 },
        'darkroom': { map: null, intensity: 0 } // Spotlights only
    };
    ```
*   **Implementation:** Use `<Environment files={currentEnv.map} />` from `@threlte/extras`.

---

## 2. MATHEMATICAL MODIFIERS (CPU Level)
**Goal:** Apply non-destructive math filters to the `radiusCurve` before geometry generation.

### 2.1 The "Lego Filter" (Quantization)
*   **Target:** `src/lib/engine/physicsMapping.ts` -> `applyModifiers`
*   **Logic:** Snap radius and height values to a grid.
    ```typescript
    if (uiStore.modifiers.quantize) {
        const step = 10; // 10mm blocks
        radius = Math.round(radius * heightScale / step) * step / heightScale;
        // Note: Height quantization happens by downsampling the array resolution
    }
    ```

### 2.2 The Golden Ratio Lock
*   **Target:** `src/lib/components/overlay/GoldenGuide.svelte` (New Component)
*   **Logic:**
    *   Monitor `sculpture.physical.height` and `maxRadius`.
    *   Calculate Ratio: `Height / (MaxRadius * 2)`.
    *   **Feedback:** If Ratio is between `1.61` and `1.62`:
        *   Show a glowing "Φ" (Phi) symbol in the UI.
        *   Snap/Vibrate the slider slightly (Haptic feedback via UI color).

### 2.3 Symmetry / Kaleidoscope (Radial Modulation)
*   **Target:** `src/lib/components/scene/Sculpture.svelte` (Vertex Loop)
*   **Logic:** Deform vertices *after* Lathe generation.
*   **Math:**
    ```typescript
    const lobes = uiStore.modifiers.symmetryCount; // e.g., 3, 5, 8
    if (lobes > 0) {
        // Iterate vertices
        const angle = Math.atan2(z, x);
        const distortion = 1.0 + Math.sin(angle * lobes) * 0.2; // 20% Variance
        
        position.setX(i, x * distortion);
        position.setZ(i, z * distortion);
    }
    ```

---

## 3. GUIDANCE & GAMIFICATION (UI Layer)
**Goal:** Provide context without expensive rendering.

### 3.1 Phantom Blueprints
*   **Target:** `src/lib/assets/shapes/` (Store simple JSON paths).
*   **Implementation:** `src/lib/components/scene/BlueprintOverlay.svelte`
    *   Load a target profile (e.g., "Amphora").
    *   Render as a `<T.Line>` with `dashed` material.
    *   **Gamification:** Calculate "Match %" by comparing user `radiusCurve` to `blueprintCurve`.

### 3.2 Vocal Tuner Overlay
*   **Target:** `src/lib/components/layout/Footer.svelte`
*   **Logic:** Visual needle gauge.
    *   `const deviation = (pitch - nearestNoteHz)`.
    *   Render a needle rotation based on `deviation`.
    *   Color Green if `Math.abs(deviation) < 5`.

### 3.3 History Slider (Time Travel)
*   **Target:** `src/lib/stores/recording.svelte.ts` & `Transport.svelte`.
*   **Logic:**
    *   Store the full `frames` array.
    *   Slider value `t` (0 to 1).
    *   `const sliceIndex = Math.floor(frames.length * t);`
    *   Pass `frames.slice(0, sliceIndex)` to the renderer.
*   **Benefit:** Instant Undo/Redo scrubbing.

---

## 4. AUDIO FEEDBACK (Sonification)
**Goal:** Auditory confirmation of physical properties.

### 4.1 Singing Bowl Resonance
*   **Target:** `src/lib/audio/sonification.ts` (New File).
*   **Trigger:** Call `playResonance()` on **Stop Recording**.
*   **Implementation:**
    ```typescript
    export function playResonance(audioContext, avgRadius, height, materialType) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        // Physics: Larger/Taller = Lower Pitch
        const frequency = 800 / (avgRadius * 5 + 1) / (height / 150);
        
        // Material: Ceramic = Pure Sine, Plastic = Square/Dull
        osc.type = materialType === 'ceramic' ? 'sine' : 'triangle';
        
        osc.frequency.value = frequency;
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        // Envelope: Ping sound
        const now = audioContext.currentTime;
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0); // 2s Decay
        
        osc.start(now);
        osc.stop(now + 2.0);
    }
    ```

---

## 5. IMPLEMENTATION ORDER

1.  **Step 1: Audio Feedback (Sonification)**
    *   *Why:* Easiest to implement, high "Magic" factor immediately on stop.
2.  **Step 2: Visual Modifiers (Bioluminescence & Lighting)**
    *   *Why:* Makes the app look "Pro" instantly.
3.  **Step 3: Math Modifiers (Lego/Kaleidoscope)**
    *   *Why:* Adds depth to the creative tools.
4.  **Step 4: Guidance (Blueprints/History)**
    *   *Why:* Polishes the UX for learning users.