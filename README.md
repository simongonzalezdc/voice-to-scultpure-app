# Voice-to-Sculpture Studio

**Turn your voice into 3D-printable ceramic sculptures in the browser — sing, hum, or speak and real-time audio analysis shapes the pottery. For makers, digital artists, and 3D-printing hobbyists.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-Three.js-ff3e00.svg)](https://kit.svelte.dev/)

## What it is

Voice-to-Sculpture Studio is a SvelteKit web app that maps live audio features — pitch, volume, timbre, and beat — onto the geometry of a 3D ceramic sculpture. You record your voice, the app sculpts a form from it in real time, and you can glaze it, apply deformations, and export the result as an STL (in real millimeters), GLTF/GLB, or a high-resolution render. It runs in the browser using WebGPU/WebGL and the Web Audio API, with optional AI assistance that can run locally via WebGPU (WebLLM) or against a cloud provider.

## Install / Quick start

```bash
npm install
npm run dev      # Vite dev server
```

Then open the printed local URL in Chrome or Edge (recommended for WebGPU) and grant microphone access. Build and preview a production bundle:

```bash
npm run build
npm run preview
```

> **Requirements:** Node.js 18+, a microphone, and a Chromium-based or Firefox browser. WebGPU is recommended for local AI acceleration (falls back to WebGL). SharedArrayBuffer features need COOP/COEP headers; Safari support is limited because SharedArrayBuffer is unavailable.

## Usage

1. Pick a recording mode — **Standard** (10–30s, quick shapes) or **Song** (1–5 min, high-resolution capture).
2. Record your voice; the live audio analysis drives the lathe geometry and deformations.
3. Move through the **Sculpt → Glaze → Force → Export** workspaces (the Performance Wizard guides this flow).
4. Choose a fabrication mode — Ceramic (pottery physics: 70mm hand access, clay smoothing, stable bases), 3D Print (FDM rules: 60° max overhang, contiguous geometry), or Digital — then export STL, GLTF/GLB, PNG, or WAV.

AI sculpture modifications are available through the in-app Settings panel: supply a cloud API key, or use the local WebLLM backend. No build-time environment variables or feature flags are required.

## Why / how it works

The interesting design point is the **voice-to-geometry mapping**. Audio is captured through the Web Audio API (AudioWorklet) and analyzed with [Meyda](https://meyda.js.org/); the extracted features become parameters of a lathe-based mesh, so the timbre and dynamics of a sound translate directly into a turned ceramic profile. **Voice Links** let you bind specific features to specific transforms (pitch → twist, timbre → roughness) for hands-free shaping. Rendering uses Threlte + Three.js with PBR ceramic materials (clearcoat glaze, sheen, subsurface approximation), three-point + HDRI lighting, and SSAO/bloom post-processing, and exports respect real fabrication constraints so what you make is actually printable or throwable.

**Stack:** SvelteKit + TypeScript · Threlte v8 / Three.js · Web Audio API (AudioWorklet) + Meyda · `@mlc-ai/web-llm` (WebGPU) and OpenAI for AI · OPFS for persistence · Vite, Vitest, and Playwright for tooling and tests.

## Best-fit searches

voice to 3D model · audio-driven 3D sculpture · turn voice into 3D print · web pottery / ceramics generator · SvelteKit Three.js audio visualization · STL export from sound · WebGPU local LLM web app · Meyda audio feature 3D geometry

## Links

- **Testing guide:** [TESTING_GUIDE.md](TESTING_GUIDE.md)
- **License:** [MIT](LICENSE)
- **KyaniteLabs:** [kyanitelabs.tech](https://kyanitelabs.tech)
- **Sibling projects:** [Print-OS](https://github.com/simongonzalezdc/Print-OS) · [GameStory-Lab](https://github.com/simongonzalezdc/GameStory-Lab) · [CyberWitches](https://github.com/simongonzalezdc/CyberWitches) · [grocery-flywheel](https://github.com/simongonzalezdc/grocery-flywheel) · [HealthAdvocate](https://github.com/simongonzalezdc/healthadvocate)
