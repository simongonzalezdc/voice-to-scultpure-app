# PROPOSED_REDESIGN_PLAN.md

## Phase 1: Navigation & Layout Unification
**Goal:** Eliminate the "Tab vs Modal" confusion and establish a single source of truth for navigation.

1.  **Create `WorkspaceSwitcher` Component:**
    *   A top-center or top-left pill selector: `[ Sculpt | Glaze | Export ]`.
    *   This replaces the `TabbedSidebar` top tabs AND the `Sculpt/Glaze` sub-toggle.
    *   It directly controls a new `uiStore.workspace` state.

2.  **Refactor Sidebar to "Inspector Panel":**
    *   The Sidebar acts as a context-aware "Inspector".
    *   If Workspace = **Sculpt**: Render `ParameterSliders` + `SculptZoneControls`.
    *   If Workspace = **Glaze**: Render `GlazeMixer`.
    *   If Workspace = **Export**: Render `FabricationPanel`.
    *   Remove the internal tabs from the sidebar entirely.

3.  **Create "Toolbar" (Left Rail):**
    *   Move persistent tools here:
        *   **Home/Library** (was ProjectList modal).
        *   **Orientation Toggle** (Pottery/Lathe).
        *   **AI Assistant** (was AI Panel modal).
        *   **Settings** (was Settings modal).

## Phase 2: Modal & Overlay Cleanup
**Goal:** Reduce "pop-up fatigue" and z-index fighting.

1.  **Remove Duplicate Panel Logic:**
    *   Delete `uiStore.panels.fabricationPanel`, `glazeMixer`. These are now Workspace states.
    *   Keep `uiStore.panels.settings` and `projectList` but bind them to the new Toolbar.

2.  **Fix Onboarding Flow:**
    *   Modify `+page.svelte` to **block** the `NewProjectModal` if `uiStore.onboarding.active` is true.
    *   Only trigger `NewProjectModal` if `!currentSculpture` AND `!onboarding`.

## Phase 3: Accessibility & Hygiene
**Goal:** Make the app usable by everyone.

1.  **Focus Management:**
    *   Implement a `useFocusTrap` action for the remaining true modals (New Project, Settings).
    *   Ensure closing a modal returns focus to the trigger button.

2.  **ARIA Labels:**
    *   Add `aria-label` to all icon-only buttons in `Transport.svelte` and the new Toolbar.
    *   Add a visually hidden "Live Region" that announces sculpture changes (e.g., "Sculpture regenerated: Height 150mm").

3.  **Keyboard Navigation:**
    *   Add a "Keyboard Shortcuts" cheat sheet modal (triggered by `?`).
    *   Ensure the 3D Canvas has a focus outline when active.

## Phase 4: Visual Polish (The "Pro Tool" Look)
1.  **Theme Consolidation:** Ensure all panels use the same `surface-panel` classes.
2.  **Z-Index System:** Define a strict z-index scale in CSS variables (e.g., `--z-canvas: 10`, `--z-ui: 100`, `--z-modal: 1000`).

## Proposed File Structure Changes
-   `src/lib/components/layout/WorkspaceSwitcher.svelte` (New)
-   `src/lib/components/layout/Toolbar.svelte` (New)
-   `src/lib/components/layout/Inspector.svelte` (Replaces TabbedSidebar)
-   `src/lib/stores/uiStore.svelte.ts` (Update to support `workspace` state)

