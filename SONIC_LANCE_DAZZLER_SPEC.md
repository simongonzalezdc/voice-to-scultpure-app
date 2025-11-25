# ⚡ Sonic Lance, Dazzler Effect & Sound Ribbons - Implementation Specification

**Date:** November 2025  
**Priority:** High  
**Dependencies:** `uiStore`, `Sculpture.svelte`, `PostProcessing`

---

## 1. The Sonic Lance (Precision Carving)

**Concept:** A new tool mode in the Force workspace that turns the voice-sculpting cursor from a soft brush into a precise, high-frequency cutting beam.

### 🎨 UX Design

**Location:** `ForceControls.svelte` panel.

**Controls:**
- Add a **Tool Type** toggle: `[🖌️ Brush]` vs `[🗡️ Lance]`
- **Brush (Default):** Current behavior (Soft, wide, push/pull).
- **Lance:**
  - **Visuals:** Cursor becomes a small, intense cyan ring.
  - **Action:** Always subtractive (carving/drilling).
  - **Physics:** Hardness locked to 1.0 (sharp edges). Radius locked to 0.05-0.1 (fine point).
  - **Voice:** Volume determines **Cut Depth**.

### 🛠️ Technical Implementation

#### 1. Store Updates (`uiStore.svelte.ts`)
```typescript
forceParams: {
    // ... existing params
    toolType: 'brush' | 'lance'; // New property
}
```

#### 2. UI Component (`ForceControls.svelte`)
- Add segmented control for Tool Type.
- When 'lance' is selected:
  - Lock `radius` slider to low value (visually disabled or constrained).
  - Lock `hardness` to 1.0.
  - Force `subtractive` mode toggle to active.

#### 3. Logic Updates (`Sculpture.svelte`)
- In the `useTask` force loop:
  - Check `uiStore.forceParams.toolType`.
  - If `lance`:
    - Override `forceRadius` to fixed precision value (e.g., `0.05`).
    - Override `forceHardness` to `1.0`.
    - Force `isPush` to `false` (always subtract).
    - **Key Mechanic:** Map `micLevel` to `deformationAmount` aggressively (sharp, deep cuts).

#### 4. Visuals (`ForceParticles.svelte`)
- If `toolType === 'lance'`:
  - Change particle color to Cyan/White.
  - Increase particle velocity (sparks vs floating dust).
  - Reduce particle spread (beam vs cloud).

---

## 2. The Dazzler Effect (Living Neon)

**Concept:** A reactive material mode where the sculpture emits light based on voice energy, turning the object into a living visualizer.

### 🎨 UX Design

**Location:** `GlazeMixer.svelte` / `ObjectProperties.svelte`.

**Controls:**
- Add **"Energy"** to Material Type options (`Ceramic`, `Plastic`, `Energy`).
- **Behavior:**
  - **Base State:** Matte dark material.
  - **Voice Active:** Emissive channel glows with `activeGlaze.color`.
  - **Loud Voice:** Blooms white-hot.

### 🛠️ Technical Implementation

#### 1. Store Updates (`uiStore.svelte.ts`)
- `activeGlaze.materialType` already exists.
- Add `'energy'` to valid types: `'ceramic' | 'plastic' | 'energy'`.

#### 2. Material Logic (`Sculpture.svelte` / `materialFactory.ts`)
- Update `deriveMaterialColor` or `createBaseMaterialProps`:
  - If `materialType === 'energy'`:
    - `color`: `#111111` (Dark charcoal/black).
    - `roughness`: `0.8` (Matte - to prevent environment reflections interfering with glow).
    - `emissive`: `uiStore.activeGlaze.color`.
    - `emissiveIntensity`: Derived from `analysisStore.energy` (smoothed).

#### 3. Reactive Glow (`Sculpture.svelte`)
```typescript
// In useTask or derived loop
const targetIntensity = materialType === 'energy' 
    ? baseGlow + (analysisStore.energy * 10) // High multiplier for energy mode
    : 0;

// Smooth interpolation
currentIntensity = lerp(currentIntensity, targetIntensity, 0.1);
```

#### 4. Post-Processing (`PostProcessing.svelte`)
- Ensure Bloom threshold allows the energy material to glow without blowing out the rest of the scene.
- Threshold: `0.8` -> `1.5` (only very bright things glow).

---

## 3. Solid Sound Ribbons (3D Waveform)

**Concept:** A fundamental shift from the "Pottery/Lathe" metaphor. Instead of rotating a profile around a center axis, the sculpture becomes a free-floating ribbon extruded through space, like a 3D audio waveform.

### 🎨 UX Design

**Location:** `ObjectProperties.svelte` / Project Creation Wizard.

**Controls:**
- **Base Shape:** Add `[🏺 Vase]` vs `[〰️ Ribbon]` toggle.
- **Behavior (Ribbon Mode):**
  - **X-Axis:** Controlled by **Pitch** (Steering left/right).
  - **Y-Axis:** Time/Height (Constant extrusion upward).
  - **Z-Axis / Thickness:** Controlled by **Volume** (Thick/Thin).
  - **Twist:** Controlled by **Timbre** (Spectral Centroid).

### 🛠️ Technical Implementation

#### 1. Store Updates (`uiStore.svelte.ts`)
- Add `baseShape` to `SculptureDefinition` (already exists as legacy, formalize it).
- Values: `'lathe' | 'ribbon'`.

#### 2. Geometry Engine (`RibbonGeometryManager.ts`)
- Create a new manager similar to `DynamicGeometryManager`.
- **Algorithm:**
  - Instead of `generateLathe` (Rotation), implement `generateRibbon`.
  - Maintains a `TriangleStrip` buffer.
  - For each new frame:
    - Calculate center point `x` based on pitch.
    - Calculate width `w` based on energy.
    - Add two vertices: `[x - w/2, height, 0]` and `[x + w/2, height, 0]`.
    - Connect to previous pair of vertices to form a quad.

#### 3. Renderer (`Sculpture.svelte`)
- Add conditional rendering:
  - If `baseShape === 'lathe'`: Use `DynamicGeometryManager` (Lathe).
  - If `baseShape === 'ribbon'`: Use `RibbonGeometryManager`.
- **Material:** Ribbons support all existing materials (Ceramic, Glaze, Energy).

---

## 📋 Implementation Checklist

### Phase 1: Store & UI
- [ ] Update `uiStore` types (`toolType`, `materialType`, `baseShape`).
- [ ] Update `ForceControls.svelte` (Brush/Lance).
- [ ] Update `GlazeMixer.svelte` (Energy material).
- [ ] Update `ObjectProperties.svelte` (Ribbon toggle).

### Phase 2: Sculpture Logic (Lance & Dazzler)
- [ ] Implement "Lance" override in `Sculpture.svelte` force loop.
- [ ] Implement "Energy" material logic in `deriveMaterialColor`.
- [ ] Bind audio energy to emissive intensity.

### Phase 3: Ribbon Architecture
- [ ] Create `RibbonGeometryManager.ts`.
- [ ] Implement `generateRibbon` logic (Pitch->X, Volume->Width).
- [ ] Integrate into `Sculpture.svelte` as alternative renderer.

### Phase 4: Visual Polish
- [ ] Tune particle effects for Lance.
- [ ] Tune Bloom for Energy mode.
- [ ] Smooth ribbon steering (lerp pitch values).

---

## 4. POV Acoustic Projection (The Voice Stream)

**Concept:** A visualizer that bridges the gap between the user (the screen) and the sculpture. It visualizes the sound waves traveling *from* the user's point of view *into* the 3D world, reinforcing the feeling that your voice is the tool.

### 🎨 UX Design

**Location:** Scene Overlay / Always Active (when mic is on).

**Visuals:**
- **The Stream:** A series of concentric distortion rings or semi-transparent waves moving from the camera into the scene.
- **Behavior:**
  - **Silence:** Invisible.
  - **Speaking:** Faint ripples.
  - **Singing/Shouting:** Distinct, glowing pulses traveling forward.
- **Mode Reaction:**
  - **Brush Mode:** Wide, slow, spherical waves (like a speaker cone).
  - **Lance Mode:** Tight, fast, conical spiral (like a drill).

### 🛠️ Technical Implementation

#### 1. Component (`VoiceProjector.svelte`)
- A new scene component using `<T.InstancedMesh>` or a custom ShaderMaterial on a cone/tube.
- Positioned parented to the camera (or updated to match camera transform).

#### 2. Mechanics
- **Spawn:** On every frame with audio energy > threshold.
- **Movement:** Move instances along -Z axis (local to camera) or towards the `interactionPoint`.
- **Uniforms:**
  - `uEnergy`: Controls displacement/opacity.
  - `uPitch`: Controls color/frequency of ripples.

#### 3. Integration
- Add to `MainScene.svelte`.
- Ensure it doesn't occlude the sculpting target too much (fades out as it gets close).

---

*Spec updated November 2025.*

