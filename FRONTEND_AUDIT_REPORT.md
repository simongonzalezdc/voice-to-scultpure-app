# Frontend UI/UX & Accessibility Audit Report

## 1. Executive Summary

**Status: Fragmented & Conflicting**
The user's assessment that "tools are all over the place" is accurate. The application currently employs three competing navigation models simultaneously:

1.  **Tabbed Sidebar** (Design/Fabrication/Settings)
2.  **Mode Switcher** (Sculpt/Glaze - nested _inside_ the sidebar)
3.  **Modal Overlays** (Fabrication, AI, Settings - triggered via shortcuts or hidden buttons)

This redundancy creates cognitive load. A user doesn't know if "Fabrication" is a tab, a modal, or a separate workspace.

## 2. Heuristic Analysis (Nielsen's 10 Usability Heuristics)

### ❌ H4: Consistency and Standards

- **Violation:** The "Fabrication" panel exists as both a Sidebar Tab and a Modal Overlay.
- **Violation:** "Sculpt" and "Glaze" are major application states (Workspaces), but are presented as small toggle buttons inside a secondary panel. In industry tools (Blender, Cinema 4D), these are top-level layouts.

### ❌ H7: Flexibility and Efficiency of Use

- **Violation:** Critical "Export" actions are buried in a tab or a modal, while "Generate Test Mesh" (a debug tool) has prime real estate in the header.
- **Violation:** Keyboard shortcuts exist but are undiscoverable (no tooltips or legend).

### ❌ H8: Aesthetic and Minimalist Design

- **Violation:** On application load, the user is presented with a "Welcome" tutorial overlay AND a "New Project" modal simultaneously. This "modal stacking" forces the user to dismiss multiple dialogs before seeing the app.

## 3. Accessibility Audit (WCAG 2.1 AA)

### ⚠️ Focus Management

- **Issue:** When modals open, focus is not consistently trapped within them.
- **Issue:** The 3D Viewport does not clearly indicate keyboard focus state.

### ⚠️ Screen Reader Support

- **Issue:** The `<Canvas>` element is a "black box" to screen readers. While common in 3D web apps, there is no alternative text description or ARIA live region announcing the state of the sculpture (e.g., "Cylinder, height 150mm").

### ✅ Color & Contrast

- **Pass:** The high-contrast dark mode theme generally meets contrast ratios.
- **Pass:** Recording states use both Color (Red/Green) and Text labels/Icons, satisfying "Use of Color" requirements.

## 4. Industry Standard Comparison

| Feature        | Voice-to-Sculpture App | Industry Standard (Blender/Spline)       | Recommendation                         |
| :------------- | :--------------------- | :--------------------------------------- | :------------------------------------- |
| **Workspaces** | Toggle inside sidebar  | Top-level Tabs (Layout, Sculpt, Shading) | Move Sculpt/Glaze to Top Center        |
| **Properties** | Mixed with Mode Switch | Right Sidebar (Context Sensitive)        | Keep Right Sidebar, remove Mode Toggle |
| **Tools**      | Hidden in "Design" tab | Left Toolbar (Persistent)                | Create Left Toolbar for Brushes/Zones  |
| **Transport**  | Bottom Left            | Bottom Center (Timeline)                 | Move to Bottom Center (Hero placement) |

## 5. Recommended Redesign: "The Studio Layout"

We should move to a **Single-Source-of-Truth Layout** that mimics a DAW (Digital Audio Workstation) meets 3D Modeler.

### Zone 1: The Workbench (Center)

- **3D Viewport:** Takes maximum space.
- **Heads-Up Display (HUD):** Mic level and Recording State floating unobtrusively or in a status bar.

### Zone 2: The Tool Belt (Left)

- **Vertical Toolbar:** Persistent access to primary interactions.
  - Tool 1: **Voice Chisel** (Sculpt Mode)
  - Tool 2: **Glaze Brush** (Glaze Mode)
  - Tool 3: **Zone Selector** (Focus area)

### Zone 3: The Inspector (Right)

- **Context Aware Panel:**
  - If _Sculpting_: Shows Parametric Sliders (Twist, Taper, Physics).
  - If _Glazing_: Shows Color Mixer and Kiln settings.
  - If _Exporting_: Shows Format options (STL, GLB).

### Zone 4: The Timeline (Bottom)

- **Unified Transport:** Record/Stop/Play buttons centered.
- **Waveform Visualization:** (Future) Visual history of the recording.

## 6. Implementation Plan

1.  **Navigation Refactor:** Remove `TabbedSidebar`. Replace with a top-level `WorkspaceSwitcher` state (`sculpt` | `glaze` | `export`).
2.  **Sidebar Consolidation:** The Right Sidebar solely renders the "Inspector" for the active workspace. No tabs.
3.  **Modal Cleanup:** Remove redundant modals. "Settings" can remain a modal (rare access), but "Fabrication" should be the "Export" workspace.
4.  **Onboarding Flow:** Serialize the start-up experience. Tutorial -> (Complete) -> New Project Modal. Never both.
