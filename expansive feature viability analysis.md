## Viability & Implementation Plan

### 1) Audio–Visual Harmonic Aesthetics
Goal: Map musical harmonics to visual “color harmonics” so that singing always yields pleasing audio and visuals.

**Key concepts**
- Use harmonic series (interval consonance) to drive hue relationships (complementary/analogous palettes), while timbre and formants influence saturation and texture.
- Employ psychoacoustic brightness vs. visual luminance mappings; amplitude envelopes can modulate lightness and particle density.
- Pre-curated harmonic-to-palette lookup tables plus ML-based palette suggestions from real-time spectral features.

:::task-stub{title="Design harmonic-to-color aesthetic mapping"}
- Add a `harmonics_to_palette` module that ingests FFT/harmonic ratios and outputs hue relationships (analogous/complementary/triadic).
- Map spectral centroid ↔ luminance, inharmonicity/noise ↔ texture/roughness parameters.
- Build preset palette tables (e.g., per key/mode) and a smoothing filter to avoid abrupt hue jumps across frames.
:::

### 2) Rhythm as a Visual Principle
Goal: Translate rhythm into visual cadence and repetition.

**Key concepts**
- Onset/beat detection to drive visual pulses, spacing, and repetition motifs.
- Tempo maps influence stroke spacing, extrusion cadence, or particle burst timing.
- Meter/subdivision maps to grid/tiling density; swing/laid-back feel adjusts easing curves.

:::task-stub{title="Integrate beat/onset-driven visuals"}
- Add real-time beat detection feeding a `visual_rhythm` engine.
- Map beat grid to spawn/scale pulses in the sculpture editor (e.g., radial ripples or lattice deformations).
- Expose rhythmic parameters for pattern repetition (grid tiling, ripple intervals) synchronized to tempo.
:::

### 3) Synesthetic Mode (Voice-to-Visual Art Suite)
Goal: Generalize from sculpture-only to a broader synesthesia tool that responds to pitch, loudness, and timbre.

**Key concepts**
- Multi-channel control: pitch→hue, loudness→scale/extrusion, timbre/brightness→material/texture, vibrato→micro-oscillation patterns.
- Preset “synesthesia profiles” for different artistic outputs: sculpture, 2D canvas, particle fields, light paths.

:::task-stub{title="Extend control mapping for synesthetic outputs"}
- Implement a unified `voice_control_router` mapping (pitch/loudness/timbre) to multiple render targets (3D mesh, 2D canvas, particles).
- Add profile presets with tunable mappings and safety clamps to ensure aesthetic bounds.
- Support export workflows (STL/OBJ, PNG/MP4, shader params) driven by recorded performance timelines.
:::

### 4A) Remove Direction Sliders
Goal: Eliminate confusing “top/bottom” sliders for deformation direction.

:::task-stub{title="Replace direction sliders with direct voice-driven targeting"}
- Remove slider UI and related state.
- Default deformation targeting is inferred from singing (active frames apply change; silence holds state).
- Provide visual affordances (ghost overlays) showing where the next sung layer will affect.
:::

### 4B) Guided Wizard + Layered Workflow
Goal: Step-by-step recording wizard; each take is a non-destructive additive layer (geometry or color).

**Workflow**
1. **Base shape pass**: first recording sets initial form.
2. **Refinement passes**: additional takes add independent layers; silence = no change, singing = apply change.
3. **Color/glaze phase**: separate passes for selecting palette via pitch and applying glaze via performance; support multiple translucent layers.
4. **Export**: save/print with layer stack preserved.

:::task-stub{title="Implement multi-pass wizard flow"}
- Build a wizard state machine: base form → refinement layers (N passes) → color select → color apply (repeatable) → export.
- Layer system: each recording stored as an independent, non-destructive modifier (geometry delta or material layer) with solo/mute/delete.
- UX cues: per-step instructions, recording countdown, and clear “sing to affect / silence to skip” messaging; progress indicator across phases.
- Color phase: pitch→palette selection, loudness/timbre→glaze thickness/roughness; apply as separate material layers with opacity controls.
:::

### 5) Safety, Playability, and Aesthetic Guarantees
Goal: Ensure outputs stay pleasing and responsive.

:::task-stub{title="Add safeguards for smooth, pleasing results"}
- Envelope smoothing and hysteresis on pitch/loudness to prevent jitter; constrain deformation and color deltas per frame.
- Adaptive gain/normalization for consistent response across voices.
- Preview/undo per layer; allow reordering layers in the stack.
- Provide “pleasantness mode” that clamps to consonant intervals and harmonious palettes; offer “expressive mode” with wider ranges.
:::

### 6) Technical Architecture Notes
- Real-time audio analysis: FFT + onset/beat + pitch tracking, with low-latency buffering.
- Event bus links audio features to rendering engines (3D mesh ops, material shaders, particle/2D canvases).
- Layer timeline: record feature streams per pass; replay deterministically for export and edits.
- UI: wizard panels, layer list, live viewport; remove legacy slider controls.

:::task-stub{title="Prototype end-to-end pipeline"}
- Set up audio feature capture → feature bus → render controllers; log feature streams per pass.
- Implement deterministic playback for export/rendering (mesh + material + particle).
- Instrument performance metrics (latency, dropped frames) to keep interaction tight for singers.
:::

