# ✅ Auto-Fix Geometry Implementation

**Date:** November 24, 2025  
**Issue:** #213 - Export files don't match viewport geometry

## Problem: Exports were broken

The user reported that exported files (PLY, STL, GLB) didn't match what was visible in the viewport. Looking at the exports, they showed simple, undeformed shapes, while the viewport showed complex, deformed sculptures.

### Root Cause

The export functions were using incomplete transformation pipelines:

1. **PLY export** - Only applied deformation, missing:
   - Layer composition
   - Modifiers (quantize, symmetry)
   - Constraints (auto-fix geometry)

2. **STL export** - Applied NO transformations at all:
   - No deformations
   - No layer composition
   - No modifiers
   - No constraints

3. **GLB export** - Same as PLY, only deformation

**Meanwhile, the viewport renderer (`Sculpture.svelte`) correctly applies:**
```
Compose Layers → Deform → Constrain → Modify → Generate Geometry
```

## Solution

### Created Shared Transformation Pipeline

**New File:** `src/lib/export/exportUtils.ts`

```typescript
export function generateFinalProfile(
	sculpture: SculptureDefinition,
	options: ExportOptions
): LathePoint[] {
	// Step 1: Compose layers or use legacy radiusCurve
	let profile = (sculpture.layers?.length > 0)
		? computeProfile(sculpture.layers)
		: sculpture.radiusCurve;

	// Step 2: Apply deformations (twist, compression, taper)
	if (sculpture.deformation) {
		profile = applyDeformation(profile, sculpture.deformation);
	}

	// Step 3: Apply fabrication constraints (if auto-fix is enabled)
	if (options.autoFixGeometry && options.constraintMode !== 'digital') {
		profile = applyConstraints(profile, options.constraintMode);
	}

	// Step 4: Apply modifiers (quantize, symmetry)
	if (options.modifiers) {
		profile = applyModifiers(profile, heightScale, options.modifiers);
	}

	return profile;
}
```

### Updated All Export Functions

**Modified Files:**
- `src/lib/export/ply.ts` - Now uses `generateFinalProfile()`
- `src/lib/export/stl.ts` - Now uses `generateFinalProfile()`
- `src/lib/export/gltf.ts` - Now uses `generateFinalProfile()`

All export functions now accept `ExportOptions`:
```typescript
export interface ExportOptions {
	autoFixGeometry: boolean;
	constraintMode: ConstraintMode;
	modifiers?: {
		quantize: boolean;
		quantizeSteps: number;
		symmetryCount: number;
	};
}
```

### Updated UI Components

**Modified Files:**
- `src/lib/components/panels/ExportTools.svelte`
- `src/lib/components/panels/FabricationPanel.svelte`

Both now:
1. Import `uiStore` to access current settings
2. Have a `getExportOptions()` helper that reads:
   - `uiStore.autoFixGeometry`
   - `uiStore.constraintMode`
   - `uiStore.modifiers`
3. Pass these options to all export functions

### Example: Before vs After

**Before (STL Export):**
```typescript
// Only used base radiusCurve, no transformations
const stlContent = lathePointsToSTL(sculpture);
```

**After (STL Export):**
```typescript
// Uses full transformation pipeline matching viewport
const options = {
	autoFixGeometry: uiStore.autoFixGeometry,
	constraintMode: uiStore.constraintMode,
	modifiers: uiStore.modifiers
};
const stlContent = lathePointsToSTL(sculpture, options);
```

## What This Fixes

✅ **Exports now match viewport** - All transformations applied  
✅ **Layer composition** - Multiple recorded layers correctly composited  
✅ **Deformations applied** - Twist, compression, taper all included  
✅ **Auto-fix constraints** - Physical limits enforced in exports  
✅ **Modifiers applied** - Quantize and symmetry effects included  

## Testing

1. Create a sculpture with:
   - Multiple layers
   - Deformations (twist + taper)
   - Auto-fix geometry enabled
   
2. Export as PLY, STL, and GLB

3. Verify exported files match viewport geometry exactly

## Files Changed

```
src/lib/export/
  - exportUtils.ts (NEW)
  - ply.ts (UPDATED)
  - stl.ts (UPDATED)
  - gltf.ts (UPDATED)

src/lib/components/panels/
  - ExportTools.svelte (UPDATED)
  - FabricationPanel.svelte (UPDATED)
```

## Technical Notes

- The transformation pipeline order is critical:
  1. Layer composition must happen first (base profile)
  2. Deformations modify the shape
  3. Constraints fix physical violations
  4. Modifiers apply artistic effects

- All export functions maintain backward compatibility with legacy `radiusCurve` sculptures

- Export options are read from UI store at export time, ensuring user sees exactly what they configured

## Result

🎉 **Exports are now fixed!** What you see in the viewport is exactly what you get in the exported file.
