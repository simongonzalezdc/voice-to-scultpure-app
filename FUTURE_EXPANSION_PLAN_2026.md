# 🚀 Future Expansion Plan 2026: Multimodal & Inclusive Design
## Apex Engineering Strategy Document

**Date:** 2025-11-24
**Author:** Apex Engineering Lead
**Target Release:** Q2 2026

---

## 📋 Executive Summary

This document outlines the architectural roadmap for three major initiatives designed to expand the "Voice-to-Sculpture" platform:
1.  **"The Visionary" (Project Iris):** Integration of Computer Vision (Webcam) to allow facial expressions and hand gestures to modulate sculpture parameters in real-time.
2.  **"Sculpt Junior" (Project Sprout):** A specialized, crash-proof mode designed for children (ages 6-10) with simplified physics, guaranteed harmonious results, and gamified feedback.
3.  **"The Stage" (Project Neon):** A high-performance Live Mode for VJs and musicians, featuring DMX/MIDI integration, large-scale projection mapping support, and ultra-low latency audio reactivity.

All initiatives strictly adhere to the **"Pro-Tier" Operational Doctrine**: Local-first processing (Privacy), 60fps performance, and no silent failures.

---

## 👁️ Initiative 1: "The Visionary" (Multimodal Input)

**Goal:** Augment *Voice* (Geometry Generation) with *Vision* (Modifier Modulation).
**Concept:** "Your voice builds the shape; your hands shape the clay."

### 1.1 Technical Architecture: MediaPipe on the Web
We will use **MediaPipe (Google)** via TensorFlow.js with the WASM backend for near-zero latency tracking on consumer hardware.

*   **Library:** `@mediapipe/tasks-vision`
*   **Models:** `FaceLandmarker` (Expressions) + `HandLandmarker` (Gestures)
*   **Processing Pipeline:**
    1.  **Input:** Hidden `<video>` element (640x480 is sufficient).
    2.  **Worker Thread:** `vision.worker.ts` (Critical: Off-main-thread processing).
    3.  **Transport:** `SharedArrayBuffer` (Ring Buffer) sending normalized Vector4 data `[x, y, z, confidence]`.
    4.  **Store:** `visionStore.svelte.ts` (Reactive state for UI/Engine).

### 1.2 Interaction Mappings (The "Magic")

| Gesture / Expression | Sculpture Parameter | Metaphor |
| :--- | :--- | :--- |
| **Mouth Openness** | **Global Scale / Radius** | "Breathing life into the object" |
| **Head Tilt (Roll)** | **Twist Deformation** | "Wringing the towel" |
| **Eyebrows Raised** | **Roughness / Spikiness** | "Surprise = Spikes" |
| **Pinch (Thumb/Index)** | **Precision Sculpting** | "Pinching the clay" (Force Mode) |
| **Open Palm Distance** | **Smoothing / Blur** | "Smoothing the surface" |

### 1.3 Privacy & Performance (Non-Negotiable)
*   **Local Only:** No video stream ever leaves the device. We will display a "Privacy Shield" icon actively when the camera is on.
*   **Performance Budget:** Vision inference capped at 30fps (decoupled from 60fps render loop).
*   **Feedback:** A small "HUD" overlay (Iron Man style) showing the mesh tracking on the user's face in the corner, confirming input.

---

## 🧸 Initiative 2: "Sculpt Junior" (Project Sprout)

**Goal:** A "No Wrong Moves" creative sandbox for children.
**Philosophy:** Frustration-free creativity. Every input creates something beautiful.

### 2.1 The "Safety Geometry" Engine
Children's inputs can be chaotic. The standard engine allows "ugly" or "broken" geometry. "Sculpt Junior" prevents this.

*   **Subdivision Modifiers:** Automatically apply Catmull-Clark subdivision to round off all sharp edges.
*   **"Blobby" Physics:** Use Metropolis balls (Meta-balls) logic or heavy Gaussian smoothing on the radius curve.
*   **Constraint:** `minRadius` is raised to 20mm (prevents thin, breakable walls).

### 2.2 Harmonic Color & Glazes
Kids often mix all colors to create "mud." We will enforce **Harmonic Palettes**.

*   **System:** The app randomly selects a "Theme" (e.g., "Unicorn", "Dinosaur", "Space").
*   **Logic:** The user can pick *any* color, but the engine shifts it to the nearest hue in the active harmonic triad.
    *   *Example:* In "Ocean Mode," picking Red shifts it to Coral/Orange.
*   **Feedback:** "Sparkle" particle effects on every voice input > 50ms.

### 2.3 Simplified UI (The "Chunky" Interface)
*   **Text-Free:** Icons only (Microphone, Save, Trash Can).
*   **Big Targets:** Minimum touch target 64px.
*   **Gamification:**
    *   **"Sticker" Mode:** Instead of complex deformation, voice pitch unlocks 3D "Stickers" (Eyes, Stars, Wings) that attach to the surface.
    *   **"Dance" Mode:** The sculpture bounces to the beat (using the existing `beatDetection` logic).

---

## 🎸 Initiative 3: "The Stage" (Project Neon)

**Goal:** A professional-grade Live Performance tool for Musicians and VJs.
**Philosophy:** "The Instrument is the Visual."

### 3.1 The Performance Engine (Zero Latency)
Live environments demand rock-solid stability. "The Stage" forks the engine to prioritize **Latency** over **Precision**.

*   **Audio:** Bypass `SharedArrayBuffer` buffering for direct `AudioWorklet` FFT (sacrifices recording accuracy for <10ms visual latency).
*   **Resolution:** Dynamic Level of Detail (LOD). If FPS drops below 55, geometry resolution is halved instantly.
*   **Projection Mapping:** Support for **Quad Warping** (Keystone correction) directly in the browser to fit odd screens/projectors.

### 3.2 Connectivity (The "Nerve Center")
Musicians don't just use microphones; they use MIDI controllers and Ableton Link.

*   **WebMIDI API:**
    *   Map Knobs/Faders to Sculpture Parameters (Twist, Roughness, Color).
    *   Map Drum Pads to "Impulse" forces (explosive deformations).
*   **OSC (Open Sound Control):**
    *   Bridge via local WebSocket server (e.g., `node-osc`) to talk to TouchDesigner or Resolume.
*   **DMX (Lighting):**
    *   Experimental support for WebSerial DMX USB dongles to sync room lighting with sculpture color.

### 3.3 "Setlist" Mode (Preset Management)
VJs need to switch styles instantly between songs.

*   **Scene Snapshots:** Save "Sculpture DNA" (all modifier params + materials) into hot-swappable slots (1-8).
*   **Morphing:** Smooth interpolation (Lerp) between Scenes when switching.
    *   *Example:* "Verse" (Smooth Blue) -> "Chorus" (Spiky Red) over 4 bars.

### 3.4 "The Jam Session" (Real-Time Collaboration)
**Concept:** Multiplayer sculpting. Two or more users connect to the same "room." User A controls the base shape (Bass/Rhythm), while User B controls the texture/glaze (Melody/Vocals).

*   **Tech Stack:** WebRTC (Peer-to-Peer data channels) + Yjs (CRDTs) for state synchronization.
*   **Why:** Turns a solitary tool into a social experience. "Band practice" for visual art.

---

## 🛠️ Initiative 4: The Studio Core (Main App Expansions)

**Goal:** Deepen the capabilities of the core creative tool.
**Philosophy:** "More power, less friction."

### 4.1 "Direct-to-Matter" (In-Browser Slicing)
**Concept:** Bypass external slicers (Cura/Prusa). The app generates ready-to-print G-Code specifically optimized for "Vase Mode" (Spiralized Contour) 3D printing, which fits your lathe geometry perfectly.
*   **Tech Stack:** Client-side G-Code generation engine.
*   **Why:** The ultimate "Voice to Object" pipeline. You sing, you hit print, you hold it.

### 4.2 "Acoustic Resonance" (Reverse Sonification)
**Concept:** The shape you build *changes* how your audio sounds. Use the 3D geometry to generate an "Impulse Response" (IR) for a Reverb node. A wide vase makes your voice boom; a narrow neck makes it tinny.
*   **Tech Stack:** Web Audio API `ConvolverNode` + Ray-tracing for IR generation.
*   **Why:** It closes the feedback loop. You sculpt the sound that sculpts you.

### 4.3 "Harmonic Branching" (Fractal Geometry)
**Concept:** Break free from the "Lathe" (cylinder) constraint. Use audio harmonics (overtones) to drive L-System branching. High notes create coral-like offshoots; low notes create thick trunk structures.
*   **Tech Stack:** Recursive geometry generation algorithms.
*   **Why:** Allows for organic, non-symmetrical forms (trees, coral, lightning) that represent complex music better than a simple vase.

### 4.4 "Material Alchemy" (Timbre-to-Texture)
**Concept:** Use a lightweight local AI (or procedural shader) to generate PBR materials based on voice *texture*.
*   *Raspy/Growl* = Rough, matte stone.
*   *Clean/Whistle* = Polished, transmissive glass.
*   *Vibrato* = Iridescent/Pearlescent coating.
*   **Tech Stack:** WebGL Custom Shaders (TSL).
*   **Why:** Currently, materials are manual choices. This makes the *surface* just as expressive as the *shape*.

### 4.5 "4D Chronos" (Performance Capture)
**Concept:** Don't just export the final shape; export the *performance*. Save the file as an Alembic (`.abc`) or GLTF Animation that morphs and grows exactly as you sang it.
*   **Tech Stack:** Morph Target recording / skeletal animation export.
*   **Why:** The act of creation is often more beautiful than the result. This allows users to share the "video" of the sculpture growing.

---

## 🥽 Initiative 5: Immersive Frontiers

**Goal:** Break the 2D Screen Barrier.

### 5.1 "The Virtual Kiln" (WebXR / AR)
**Concept:** Using WebXR Passthrough (Quest 3 / Vision Pro / Mobile AR), place the virtual sculpture on your real-world desk. Walk around it to inspect imperfections before "firing" (saving).
*   **Tech Stack:** `@threlte/xr` (WebXR API).
*   **Why:** Screens are 2D; sculptures are 3D. This is the only way to truly see volume without printing.

---

## 🛣️ Implementation Roadmap (Draft)

### Phase 1: Vision POC (4 Weeks)
1.  **Week 1:** `vision.worker.ts` setup with MediaPipe FaceMesh.
2.  **Week 2:** Map Mouth Openness -> Cylinder Radius (Simple test).
3.  **Week 3:** Build the "Privacy HUD" overlay.
4.  **Week 4:** Performance tuning (WASM SIMD support check).

### Phase 2: Sculpt Junior Core (3 Weeks)
1.  **Week 1:** `geometryFactory.ts` -> Add `createSafeGeometry()` (Smoothing enabled).
2.  **Week 2:** `ColorHarmonizer.ts` utility.
3.  **Week 3:** "Sticker" asset integration (GLB loader).

### Phase 3: The Stage MVP (4 Weeks)
1.  **Week 1:** WebMIDI Integration (`navigator.requestMIDIAccess`).
2.  **Week 2:** "Setlist" State Manager (Lerping between stores).
3.  **Week 3:** Quad-Warp Rendering Pass (Post-processing).
4.  **Week 4:** Latency Testing & Optimization.

### Phase 4: Integration (2 Weeks)
1.  **Week 1:** Global "Mode Switcher" (Pro / Junior / Live).
2.  **Week 2:** User Testing (Internal & Field).

---

## 📝 Technical Feasibility Analysis

*   **MediaPipe:** Standard implementation in Svelte is trivial. Main risk is mobile thermal throttling.
    *   *Mitigation:* Auto-disable vision on low-power mode.
*   **Three.js Smoothing:** `SubdivisionModifier` is heavy.
    *   *Alternative:* Use `glsl` shaders for visual smoothing (normal smoothing) rather than geometry modification to keep FPS high.
*   **WebMIDI:** Excellent support in Chrome/Edge. Limited in Safari/Firefox.
    *   *Fallback:* Keyboard shortcuts for "The Stage" mode on unsupported browsers.

---

**Prepared by:** Apex Engineering
**Status:** Awaiting Approval for Prototyping
