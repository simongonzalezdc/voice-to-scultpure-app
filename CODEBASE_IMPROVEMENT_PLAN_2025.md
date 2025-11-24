# 🚀 Codebase Improvement Plan 2025 (Master Execution Strategy)

**Date:** 2025-11-24
**Status:** 🟡 **Phase 1 Complete / Planning Phase 2**
**Auditor:** Apex Engineering Lead

---

## 📋 Executive Summary

**Current State:**
*   ✅ **Phase 1 (Critical Stability)** is **COMPLETE**. Memory thrashing is solved, types are strict, and geometry disposal is safe.
*   🟡 **Phase 2 (Architecture)** is ready to begin. The focus shifts from "fixing bugs" to "professionalizing architecture."

**Goal:** Transform `Sculpture.svelte` from a "God Component" into a streamlined View layer by extracting logic into pure TypeScript domains.

---

## 🗓️ Implementation Roadmap (Next Steps)

### ✅ Phase 1: Stability & Performance (COMPLETED)
*   [x] **Stop Memory Thrashing:** Implemented Buffer Pooling in `Sculpture.svelte`.
*   [x] **Safety:** Wrapped Geometry disposal in `try/catch` blocks.
*   [x] **Strictness:** Enabled `noUncheckedIndexedAccess` in `tsconfig.json` and patched resulting type errors.

---

### 🟡 Phase 2: Architectural Hygiene (The "De-Clutter")
**Goal:** Reduce `Sculpture.svelte` complexity by 40% by extracting logic into "Engine" files.

#### 2.1 Extract Geometry Engine
*   **Target:** `src/lib/components/scene/Sculpture.svelte` -> `src/lib/engine/geometryFactory.ts`
*   **Action:** Move `createGeometryFromProfile` and `generateLathe` logic (where mixed) into a pure functional module.
*   **Why:** `Sculpture.svelte` should only *display* geometry, not *calculate* math.
*   **Risk:** Low. Pure refactor.

#### 2.2 Extract Material Logic
*   **Target:** `src/lib/components/scene/Sculpture.svelte` -> `src/lib/engine/materialFactory.ts`
*   **Action:** Extract `generateGlaze`, `applyHeatmapColors`, and material property derivation.
*   **Why:** Material logic is becoming complex (Bioluminescence, Heatmaps, Glazes). It needs its own domain.

#### 2.3 Standardize "Magic Numbers"
*   **Target:** `src/lib/config/constants.ts`
*   **Action:** Scan `Sculpture.svelte` for any remaining inline numbers (e.g., `0.15` smoothing, `30` fps) and move them to constants.
*   **Why:** Tuning the "feel" of the app should happen in one config file, not inside components.

---

### 🔵 Phase 3: Radical Observability ("No Silent Failures")
**Goal:** If the engine hiccups, the user should see it.

#### 3.1 Audio State Visualizer
*   **Requirement:** Create a tiny status indicator (traffic light) for the AudioWorklet.
    *   🟢 Running
    *   🟡 Suspended (Auto-resume needed)
    *   🔴 Disconnected/Error
*   **Why:** Users currently don't know if the mic is dead or if the app is just quiet.

#### 3.2 "Blindness Check" for Exports
*   **Requirement:** Add Toast Notifications for all file operations (Save, Export STL, Export GLTF).
*   **Why:** "Did it save?" should never be a question.

---

### 🟣 Phase 4: Robustness & Testing
**Goal:** Lock in the stability.

#### 4.1 Unit Tests for Geometry Engine
*   **Target:** `src/lib/engine/geometryFactory.ts`
*   **Action:** Write Vitest tests to ensure `createGeometryFromProfile` never returns `NaN` or malformed buffers.

#### 4.2 E2E Critical Path
*   **Target:** Playwright
*   **Action:** Verify the "Record -> Stop -> Export" flow still works after the refactors.

---

## 📝 Decision Log

*   **2025-11-24:** Rejected WebGPU migration due to experimental instability.
*   **2025-11-24:** Prioritized Memory Leaks (Buffer Reuse) over Component Splitting.
*   **2025-11-24:** Enforced `noUncheckedIndexedAccess` for Aerospace-grade type safety.

---

**Ready to Proceed with Phase 2?**
