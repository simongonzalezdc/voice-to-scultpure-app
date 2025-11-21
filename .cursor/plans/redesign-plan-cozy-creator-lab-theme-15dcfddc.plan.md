<!-- 15dcfddc-1fd7-4cb4-824f-045a3a340126 b66aeb1e-e660-490a-9c60-b6a84ad69c29 -->
# Redesign Plan: Cozy Creator Lab Theme

This plan overhauls the frontend aesthetics to match the "Cozy Creator Lab" vibe using the provided Jewel Engine Theme (Low-Contrast Garnet/Topaz). We will focus on tactile controls, soft lighting effects, and a modern, intentional UI without altering core functionality.

## 1. Theme & Foundation

- **Update Theme Source:** Overwrite `src/lib/styles/jewel-theme.css` with the provided `DEV Docs/jewel-engine-theme-lowcontrast-garnet-topaz.css`.
- **Tailwind Configuration:** Audit and update `tailwind.config.ts` to ensure all new CSS variables (e.g., `--brand-primary-outline`) are exposed as Tailwind utilities.
- **New "Lab" Utilities:** Create `src/lib/styles/cozy-lab.css` to implement:
- `.panel-glass`: refined surface with backdrop blur (glassmorphism), subtle borders, and soft shadows.
- `.input-slot`: "sunken" background style for text inputs and selects (neumorphism/skeuomorphism hybrid).
- `.control-tactile`: distinct, physical-feeling styles for buttons and knobs.
- `.slider-cozy`: custom CSS for range inputs (fader style).
- **Iconography:** Install `lucide-svelte` for modern, consistent icons (2025 standard).

## 2. Component Aesthetic Upgrades

### Global Layout (`src/routes/+layout.svelte`)

- **3D Environment:** Instead of a flat HTML background, upgrade the `MainScene` to include a "Studio" environment (soft lighting, infinite cyclorama, or subtle floating particles) using Threlte, blurring the line between app and 3D content.
- *Performance Note:* Use lightweight instances or simple geometry for environment details. Ensure we don't introduce heavy post-processing that kills FPS.
- Improve typography hierarchy and spacing.

### Controls Area (The "Workbench")

- **Transport (`src/lib/components/controls/Transport.svelte`):**
- Redesign as a high-quality audio deck module.
- **Tech Upgrade:** Replace the simple CSS volume bar with a **Canvas-based high-framerate Oscilloscope/Visualizer** that draws the waveform in real-time using the `analysisStore`.
- *Performance Note:* Use a `requestAnimationFrame` loop decoupled from Svelte state for the canvas drawing to ensure zero React/Svelte overhead.
- **Parameter Sliders (`src/lib/components/controls/ParameterSliders.svelte`):** Style standard HTML range inputs to look like professional mixing faders (custom track, thumb, and ticks). No heavy JS libraries for sliders, just pure CSS.

### Panels & Overlays

- **Header (`src/lib/components/layout/Header.svelte`):** make it a floating, minimal "status bar" rather than a full-width block.
- **Settings / AI Panels:** Apply the `.panel-glass` style with consistent rounded corners (`rounded-2xl`) and "sunken" form elements.
- *Performance Note:* Use `backdrop-filter` sparingly; it can be expensive on low-end GPUs. We will use a solid fallback color for lower-power modes if needed.

## 3. Implementation Steps

1. **Apply Theme:** Update CSS files and Tailwind config.
2. **Create Utilities:** Implement the "cozy" utility classes.
3. **Install Deps:** Install `lucide-svelte`.
4. **Style Controls:** Refactor `Transport` (add Canvas viz) and `ParameterSliders` CSS.
5. **Style Panels:** Update `SettingsPanel`, `AIPanel`, and `ProjectList` containers.
6. **Threlte Polish:** Update `MainScene` environment.