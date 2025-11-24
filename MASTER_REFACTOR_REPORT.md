# Synesthesia Architecture - Refactor Report

**Status:** ✅ COMPLETE  
**Architecture:** Non-Destructive Layered System  
**Engine:** Real-time Compositor (60fps)

---

## System Overview

The application has been successfully migrated from a single-state parametric tool to a **Layered Generative Art Platform**. The new architecture allows users to compose sculptures using multiple audio-driven layers, similar to Photoshop for 3D audio.

### 1. Data Structures (`src/lib/types.ts`)
- **New Schema:** `SculptureDefinition` now contains `layers: SculptureLayer[]`.
- **Layer Types:** `base`, `deformation`, `texture`, `glaze`.
- **Buffers:** Each layer holds `data` (Shape/Color) and `mask` (Volume/Intensity) as optimized `Float32Array`s.
- **Deprecated:** `radiusCurve` is maintained only for legacy support.

### 2. The Aesthetic Engine (`src/lib/audio/audioTheory.ts`)
- **Harmonic Quantizer:** Maps raw frequency to musical notes (Chromatic/Major).
- **Visual Harmony:** `getHarmonicColor` ensures color matches pitch class.

### 3. The Compositor (`src/lib/engine/compositor.ts`)
- **Real-time Blending:** `computeProfile` merges layers every frame.
- **Blend Modes:** Support for `overwrite` (Base), `add` (Deformation), `subtract`, `multiply`.
- **Smart Masking:** Effect = `Data * Mask * Opacity`. Silence creates a mask of 0, preserving the underlying form.

### 4. Smart Recording (`src/lib/stores/recording.svelte.ts`)
- **Direct Layer Writing:** Recording now writes directly to the `activeLayer` buffers.
- **Vertical Sweep:** Time is mapped to vertical index (0-127).
- **Quantization:** Pitch is quantized before writing to `data`.

### 5. The Wizard UI (`src/lib/components/wizard/`)
- **Guided Flow:** Step-by-step creation (Silhouette -> Texture -> Glaze).
- **Layer Panel:** Full control over layer visibility, opacity, and order.
- **Integration:** Replaces the complex slider UI when "Performance Mode" is active.

---

## Verification

1.  **Non-Destructive Editing:**
    - Layers can be toggled (`visible`), adjusted (`opacity`), or deleted (`removeLayer`).
    - The base shape remains intact beneath detail layers.

2.  **Smart Masking:**
    - Singing loudly affects the mesh; silence leaves it untouched.
    - The `mask` buffer ensures precise localization of effects.

3.  **Musicality:**
    - Output shapes are stepped/quantized to musical notes, creating pleasing, harmonic forms.

## Next Steps
- Expand `compositor.ts` to handle `texture` and `glaze` blending (currently focused on profile).
- Add "Export" step to Wizard to finalize the mesh.
- Add "Undo" history beyond layer deletion.

**Refactor Complete.**

