The Apex Engineering & Design Council has drafted the **Product Requirement Document (PRD)** for the standalone performance application.

We are forking the codebase. The CAD version focuses on *Accuracy and Manufacturing*. This new project focuses on *Latency, Spectacle, and Interoperability*.

**Project Codename:** **VIRTUSO**
**Target Audience:** Live Electronic Musicians, VJs, Vocalists, Streamers.

---

# 📄 SPECIFICATION: VIRTUSO (Live Performance Suite)

## 1. Executive Summary
**Virtuso** is a real-time, audio-reactive visual synthesizer. Unlike its predecessor (The Studio), which focuses on static geometry for fabrication, Virtuso treats the sculpture as a living, transient light object intended for projection mapping, LED walls, and live streaming overlays.

**Core Philosophy:** "The Voice is the Light."

---

## 2. Technical Architecture (The Fork Strategy)
To maintain sanity, we will restructure the repository into a **Monorepo** or shared library structure.

*   **`packages/core-audio`**: Shared. (FFT analysis, Pitch detection, Beat detection).
*   **`packages/core-physics`**: Shared. (Lathe generation math, noise mapping).
*   **`apps/studio`**: The current CAD tool (Material: Clay, Output: STL).
*   **`apps/stage`**: **NEW.** The Performance tool (Material: Light, Output: HDMI/OBS).

---

## 3. Feature Specification

### 3.1 The "Stage" Engine (Visuals)
We are abandoning PBR Realism (Clay/Plastic) for **Abstract Luminescence**.

*   **Ethereal Materials:**
    *   **Shader:** Custom ShaderMaterial using `gl_FragColor = vec4(audioEnergy, pitch, time, 1.0)`.
    *   **Emission:** Geometry glows based on volume.
    *   **Wireframe Overlay:** A secondary mesh slightly larger than the solid mesh, rendering only edges, pulsing to the beat (Kick drum).
*   **Post-Processing Pipeline (The "Glow-Up"):**
    *   **Bloom:** High-intensity neon glow (Cyberpunk aesthetic).
    *   **Chromatic Aberration:** Distorts RGB channels on heavy bass hits.
    *   **Feedback/Trails:** Old frames fade out slowly, creating light trails in the 3D space.

### 3.2 The "Director" System (Camera)
Musicians cannot touch a mouse while performing. The camera must be autonomous.

*   **Auto-Cam Behaviors:**
    *   **Drift:** Slow, continuous orbit (Idle state).
    *   **Kick-Zoom:** Camera FOV punches in slightly on low-frequency transients (Bass drum).
    *   **The Drop:** Camera spins rapidly or pulls back wide when energy threshold > 90%.
*   **Manual Override:** MIDI mapped camera angles (e.g., Pad 1 = Front, Pad 2 = Top-down).

### 3.3 Input & Control (MIDI & OSC)
*   **WebMIDI API Implementation:**
    *   **Learn Mode:** Click a UI element (e.g., "Roughness"), twist a physical knob, and they link instantly.
    *   **Default Mappings:**
        *   **Mod Wheel:** Controls `Twist` magnitude.
        *   **Sustain Pedal:** Toggles `Recording` (Freeze/Thaw shape).
        *   **Velocity:** Controls `Glow` intensity.
*   **Clock Sync:**
    *   Listen for MIDI Clock. Sync the rotation speed of the lathe to the BPM of the track.

### 3.4 The "Setlist" Workflow
Instead of "saving files," the musician builds a "Playlist" of visual presets.

*   **Preset Object:** `{ SongName, BaseShape, ColorPalette, CameraBehavior, PhysicsSettings }`.
*   **Flow:**
    *   *Song 1 (Ballad):* Blue/Purple palette, Slow drift, Sphere shape.
    *   *Song 2 (Techno):* Red/White strobe, Glitch camera, Cube shape.
*   **Transition:** Pressing "Next" (Spacebar or MIDI) morphs the geometry smoothly from Preset A to Preset B.

---

## 4. UI/UX Redesign ("The Dark Booth")

The interface must be invisible to the audience but high-contrast for the performer.

### 4.1 The "Blackout" Interface
*   **Default State:** **ZERO UI.** Just the 3D void.
*   **Hover State:** Minimal, semi-transparent controls fade in at the bottom edge.
*   **Output Window:** The app renders to a clean `<canvas>` with a transparent background (`alpha: true`), allowing it to be layered over camera footage in OBS.

### 4.2 The Performance Dashboard (Second Screen)
*   *Ideal Setup:* The projector shows the "Clean Feed." The laptop screen shows the "Dashboard."
*   **Dashboard Modules:**
    *   **Spectrogram:** Live frequency visualization.
    *   **Setlist:** Large, readable text of current/next track.
    *   **Panic Button:** Instantly resets geometry and camera if physics explode.

---

## 5. Implementation Roadmap

### Phase 1: The Split (Week 1)
*   Refactor existing code into `apps/stage`.
*   Strip out: Fabrication Panel, Export STL, Constraints, Measurements.
*   Add: Post-processing (Bloom), Transparent Background.

### Phase 2: The Inputs (Week 2)
*   Implement `navigator.requestMIDIAccess`.
*   Build the "MIDI Learn" wrapper for Svelte stores.
*   Map `Sustain Pedal` to `recordingStore.toggle()`.

### Phase 3: The Visuals (Week 3)
*   Replace "Clay" material with "Neon/Wireframe" shaders.
*   Implement "Audio Reactive Lighting" (Lights pulse with sound).
*   Build the "Auto-Director" Camera logic.

### Phase 4: The Setlist (Week 4)
*   Create the JSON structure for Presets.
*   Build the "Next Song" transition logic (morphing target values).

---

## 6. Prompt for the Agent (To Start Phase 1)

```markdown
Act as Lead Systems Architect. We are forking the project to create **"VIRTUSO"** (The Performance App).

**Directive 1: Create the Fork**
*   **Action:** duplicate `src` to `src_performance` (or initialize a new Vite app in a monorepo structure).
*   **Cleanup:** In the new app, DELETE `FabricationPanel`, `gltf.ts`, `stl.ts`, `blueprint.ts`, and `constraints.ts`. These are irrelevant for stage performance.

**Directive 2: The "Void" Canvas**
*   **Target:** `MainScene.svelte`.
*   **Action:**
    *   Remove the Grid and ContactShadows (or make them neon/holographic).
    *   Set `background-color: transparent`.
    *   Add `EffectComposer` with `BloomEffect`.

**Directive 3: The "Living" Material**
*   **Target:** `Sculpture.svelte`.
*   **Action:** Replace `MeshPhysicalMaterial` with a custom `ShaderMaterial` or `MeshStandardMaterial` with high `emissive` and `wireframe` clone.
*   **Logic:** Bind `emissiveIntensity` to `analysisStore.micLevel`.

**Report:**
Confirm the new app runs, has a black/transparent background, and the sculpture glows when you sing.
```