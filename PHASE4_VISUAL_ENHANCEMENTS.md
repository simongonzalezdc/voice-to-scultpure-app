# Phase 4: Visual Enhancements & Color System

## Overview

This phase implements advanced color controls, improved live visualization, contextual wireframe skeletons, and fixes lathe rotation mechanics.

---

## Directive 1: Advanced Color System

### 1.1: Glaze Color for Ceramic Material

**Target:** `src/lib/types.ts`, `src/lib/components/scene/Sculpture.svelte`, `src/lib/components/controls/ParameterSliders.svelte`

**Requirements:**

- Add `glazeColor?: string` to `SculptureSurface` interface (hex color, default: `#FFFFFF` for clear glaze)
- Ceramic material should blend between `baseColor` (clay) and `glazeColor` based on `glazeTransmission`
- When `glazeTransmission` is 0, show only `baseColor`
- When `glazeTransmission` is 1, show primarily `glazeColor` (with some base showing through)
- Use `lerpColor()` helper for smooth blending
- Update `materialColor` derived value in `Sculpture.svelte` to use glaze color blending

**UI Implementation:**

- Add "Glaze Color" picker in `ParameterSliders.svelte` (only visible when `materialType === 'ceramic'`)
- Position below "Base Color" picker
- Label: "Glaze Color" with tooltip: "Color of the glaze layer (visible when glaze transmission > 0)"
- Default value: `#FFFFFF` (clear/white glaze)
- Sync with sculpture state and update on change

**Material Rendering:**

- Update ceramic `MeshPhysicalMaterial` to use blended color
- Maintain transmission/clearcoat properties for glass-like glaze effect
- Ensure glaze color is visible through transmission

---

### 1.2: Enhanced Plastic Color System

**Target:** `src/lib/components/scene/Sculpture.svelte`, `src/lib/components/controls/ParameterSliders.svelte`

**Requirements:**

- Plastic material already uses `baseColor` - verify it's working correctly
- Ensure color picker updates plastic material in real-time
- No additional changes needed if current implementation works

**Verification:**

- Test that plastic color changes immediately when baseColor is modified
- Ensure color persists across recording sessions

---

## Directive 2: Improved Live Visualization

### 2.1: Visualization Similarity to End Result

**Target:** `src/lib/components/scene/AnalysisVisualizer.svelte`, `src/lib/components/scene/Sculpture.svelte`

**Current Issue:**

- Ring visualizer appears above the forming shape (`position={[0, 1.5, 0]}`)
- Creates confusion about what's being visualized
- Doesn't match the final sculpture appearance

**Requirements:**

- **Reposition Visualization:** Move ring to align with the sculpture's forming position
  - For Pottery (Vertical): Position at `y = sculptureHeight * heightScale` (top of forming sculpture)
  - For Lathe (Horizontal): Position at `x = sculptureLength` (end of forming sculpture)
  - Use `uiStore.orientation` to determine positioning
  - Use `sculptureStore.currentSculpture?.physical.height` or live mesh bounds for positioning

- **Visual Consistency:** Make ring visualization match the live mesh material
  - Use same color scheme as live mesh (`#ff4081` currently)
  - Match opacity/transparency style
  - Consider making ring semi-transparent overlay on the forming sculpture

- **Alternative Approach:** Instead of floating ring, consider:
  - Highlighting the active forming section of the live mesh
  - Adding a pulsing/glowing effect to the mesh itself
  - Using a wireframe overlay on the live mesh to show "active zone"

**Implementation Options:**

1. **Option A (Recommended):** Position ring at the forming edge of the sculpture
   - Calculate position based on current recording progress
   - Ring follows the "growing" edge of the sculpture
   - More intuitive spatial relationship

2. **Option B:** Integrate visualization into the live mesh
   - Add emissive/glow effect to the active forming section
   - Use shader or material properties to highlight growth zone
   - More seamless visual experience

**Code Changes:**

- Update `AnalysisVisualizer.svelte` to:
  - Read `uiStore.orientation` for positioning logic
  - Calculate dynamic position based on sculpture state
  - Optionally read live mesh ref to align with forming edge
  - Match color scheme with live mesh material

---

### 2.2: Better Layout & Positioning

**Target:** `src/lib/components/scene/AnalysisVisualizer.svelte`

**Requirements:**

- Remove confusing floating ring above sculpture
- Position visualization at the actual forming edge
- Ensure visualization doesn't occlude the sculpture
- Make it clear that visualization represents the "active growth zone"

**Visual Design:**

- Consider using a semi-transparent torus/ring that sits at the forming edge
- Add subtle animation (pulse/glow) to indicate active recording
- Use color gradient from center (active) to edges (fading)
- Match the orientation (vertical/horizontal) of the sculpture

---

## Directive 3: Contextual Wireframe Skeletons

### 3.1: Pottery Wheel Skeleton

**Target:** `src/lib/components/scene/MainScene.svelte` or new component `src/lib/components/scene/PotteryWheelSkeleton.svelte`

**Requirements:**

- Create wireframe skeleton of a pottery wheel
- Only visible when `uiStore.orientation === 'vertical'`
- Position at origin (0, 0, 0) - the sculpture sits on top
- Design elements:
  - **Base Plate:** Circular disc at y=0 (ground level), radius ~1.5 units
  - **Central Axis:** Vertical cylinder/line from base to top
  - **Wheel Surface:** Circular disc at y=0.1 (slightly above base), radius ~1.5 units
  - Use `T.LineSegments` or `T.Mesh` with `wireframe={true}`
  - Color: `#4a4a4a` (subtle, non-distracting)
  - Opacity: 0.3-0.5

**Implementation:**

- Create new component `PotteryWheelSkeleton.svelte`
- Use Three.js primitives: `CircleGeometry`, `CylinderGeometry`
- Apply wireframe material
- Conditionally render based on orientation

**Code Structure:**

```svelte
<script lang="ts">
	import { T } from '@threlte/core';
	import { uiStore } from '$lib/stores/uiStore.svelte';
</script>

{#if uiStore.orientation === 'vertical'}
	<T.Group position={[0, 0, 0]}>
		<!-- Base plate -->
		<T.Mesh rotation={[-Math.PI / 2, 0, 0]}>
			<T.CircleGeometry args={[1.5, 32]} />
			<T.MeshBasicMaterial wireframe color="#4a4a4a" transparent opacity={0.4} />
		</T.Mesh>
		<!-- Central axis -->
		<T.Mesh>
			<T.CylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
			<T.MeshBasicMaterial wireframe color="#4a4a4a" transparent opacity={0.4} />
		</T.Mesh>
		<!-- Wheel surface -->
		<T.Mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
			<T.CircleGeometry args={[1.5, 32]} />
			<T.MeshBasicMaterial wireframe color="#4a4a4a" transparent opacity={0.4} />
		</T.Mesh>
	</T.Group>
{/if}
```

---

### 3.2: Lathe Skeleton (Rotisserie Style)

**Target:** `src/lib/components/scene/MainScene.svelte` or new component `src/lib/components/scene/LatheSkeleton.svelte`

**Requirements:**

- Create wireframe skeleton of a horizontal lathe (rotisserie style)
- Only visible when `uiStore.orientation === 'horizontal'`
- **Critical:** Two-ended design (like slow-roasted pig rotisserie)
  - **Left End:** Vertical support post at x=-2, extending from y=-0.5 to y=1.5
  - **Right End:** Vertical support post at x=2, extending from y=-0.5 to y=1.5
  - **Horizontal Axis:** Cylinder/rod connecting the two ends at y=0 (ground level)
  - **Base:** Horizontal platform/rails connecting the two posts at y=-0.5
- The sculpture material spins around the horizontal axis (x-axis)
- Use same wireframe styling as pottery wheel

**Implementation:**

- Create new component `LatheSkeleton.svelte`
- Position axis at origin (0, 0, 0) - sculpture rotates around this
- Ensure axis aligns with sculpture's rotation pivot
- Design should clearly show the "two-ended" rotisserie structure

**Code Structure:**

```svelte
<script lang="ts">
	import { T } from '@threlte/core';
	import { uiStore } from '$lib/stores/uiStore.svelte';
</script>

{#if uiStore.orientation === 'horizontal'}
	<T.Group position={[0, 0, 0]}>
		<!-- Left support post -->
		<T.Mesh position={[-2, 0.5, 0]}>
			<T.CylinderGeometry args={[0.05, 0.05, 2, 8]} />
			<T.MeshBasicMaterial wireframe color="#4a4a4a" transparent opacity={0.4} />
		</T.Mesh>
		<!-- Right support post -->
		<T.Mesh position={[2, 0.5, 0]}>
			<T.CylinderGeometry args={[0.05, 0.05, 2, 8]} />
			<T.MeshBasicMaterial wireframe color="#4a4a4a" transparent opacity={0.4} />
		</T.Mesh>
		<!-- Horizontal axis rod (spinning axis) -->
		<T.Mesh rotation={[0, 0, Math.PI / 2]}>
			<T.CylinderGeometry args={[0.03, 0.03, 4, 8]} />
			<T.MeshBasicMaterial wireframe color="#4a4a4a" transparent opacity={0.4} />
		</T.Mesh>
		<!-- Base platform -->
		<T.Mesh position={[0, -0.5, 0]} rotation={[0, 0, 0]}>
			<T.BoxGeometry args={[4.5, 0.1, 0.5]} />
			<T.MeshBasicMaterial wireframe color="#4a4a4a" transparent opacity={0.4} />
		</T.Mesh>
	</T.Group>
{/if}
```

---

## Directive 4: Lathe Rotation Fix

### 4.1: Correct Lathe Axis Alignment

**Target:** `src/lib/components/scene/Sculpture.svelte`

**Current Issue:**

- Lathe mode rotates around Z-axis, but should rotate around X-axis (horizontal)
- Sculpture should spin like a rotisserie (horizontal axis rotation)
- Material should be centered on the horizontal axis

**Requirements:**

- **Rotation Axis:** Change from `rotation={[0, 0, orientationRotation]}` to proper horizontal rotation
- **Pottery (Vertical):** `rotation={[0, 0, 0]}` - no rotation, sits on wheel
- **Lathe (Horizontal):** `rotation={[orientationRotation, 0, 0]}` - rotate around X-axis
- **Pivot Point:** Ensure sculpture pivots around the horizontal axis (y=0, center of lathe)
- **Position:** Sculpture should be centered on the lathe axis, not floating

**Implementation:**

- Update `orientationRotation` calculation:
  - Vertical: `0` (no rotation)
  - Horizontal: `Math.PI / 2` (90 degrees around X-axis to lay flat)
- Update `T.Group` rotation to use `[orientationRotation, 0, 0]` instead of `[0, 0, orientationRotation]`
- Verify sculpture sits on the lathe axis (y=0) when horizontal
- Ensure base of sculpture aligns with lathe axis

**Code Changes:**

```svelte
// Current (WRONG):
let orientationRotation = $derived(uiStore.orientation === 'horizontal' ? -Math.PI / 2 : 0);
<T.Group rotation={[0, 0, orientationRotation]} ...>

// Fixed (CORRECT):
let orientationRotation = $derived(uiStore.orientation === 'horizontal' ? Math.PI / 2 : 0);
<T.Group rotation={[orientationRotation, 0, 0]} ...>
```

**Verification:**

- When switching to Lathe mode, sculpture should:
  - Rotate 90 degrees around X-axis (lay flat horizontally)
  - Sit centered on the lathe axis (y=0)
  - Align with the horizontal wireframe skeleton
  - Base should be at x=0, extending along positive X-axis

---

## Implementation Checklist

### Phase 1: Color System

- [ ] Add `glazeColor` to `SculptureSurface` interface
- [ ] Update ceramic material color blending logic
- [ ] Add Glaze Color picker to ParameterSliders UI
- [ ] Test ceramic glaze color blending
- [ ] Verify plastic color system works correctly

### Phase 2: Live Visualization

- [ ] Reposition AnalysisVisualizer ring to forming edge
- [ ] Calculate dynamic position based on orientation and sculpture state
- [ ] Match visualization color/style with live mesh
- [ ] Test positioning in both vertical and horizontal modes
- [ ] Ensure visualization doesn't occlude sculpture

### Phase 3: Wireframe Skeletons

- [ ] Create PotteryWheelSkeleton component
- [ ] Create LatheSkeleton component (two-ended rotisserie)
- [ ] Add skeletons to MainScene with conditional rendering
- [ ] Test visibility based on orientation
- [ ] Verify skeletons align with sculpture position

### Phase 4: Lathe Rotation Fix

- [ ] Change rotation axis from Z to X
- [ ] Update orientationRotation calculation
- [ ] Verify sculpture sits on lathe axis
- [ ] Test rotation in both modes
- [ ] Ensure alignment with lathe skeleton

---

## Testing Protocol

1. **Color System:**
   - Switch to Ceramic, adjust glaze color, verify blending
   - Switch to Plastic, adjust base color, verify immediate update
   - Test with various glaze transmission values (0-1)

2. **Live Visualization:**
   - Start recording, verify ring appears at forming edge
   - Switch between Pottery/Lathe modes, verify positioning updates
   - Check that visualization matches live mesh style

3. **Wireframe Skeletons:**
   - Switch to Pottery mode, verify wheel skeleton appears
   - Switch to Lathe mode, verify rotisserie skeleton appears
   - Verify skeletons align with sculpture position

4. **Lathe Rotation:**
   - Switch to Lathe mode, verify sculpture lays flat horizontally
   - Verify sculpture sits on lathe axis (y=0)
   - Verify base extends along X-axis
   - Check alignment with lathe skeleton

---

## Expected Outcomes

1. **Color System:** Users can apply colored glazes to ceramic and customize plastic colors
2. **Live Visualization:** Ring appears at the forming edge, matching the final sculpture style
3. **Wireframe Skeletons:** Contextual visual guides help users understand the sculpting context
4. **Lathe Rotation:** Sculpture correctly rotates around horizontal axis like a rotisserie

---

## Notes

- All wireframe skeletons should be subtle (low opacity, neutral color)
- Skeletons are visual guides only - they don't affect physics or rendering
- Color system should maintain backward compatibility (defaults for existing sculptures)
- Live visualization should enhance, not distract from, the sculpting experience
