# Voice-to-Sculpture Studio

Transform your voice into beautiful 3D ceramic sculptures using real-time audio analysis. Sing, hum, or speak to shape pottery - your voice becomes the potter's hands.

**📖 [Testing Guide](./TESTING_GUIDE.md) | [Test Implementation Summary](./TEST_IMPLEMENTATION_SUMMARY.md)**

## Features

### Core Voice-to-Shape
- 🎤 **Real-time Voice Analysis** - Pitch, volume, timbre, and beat detection drive sculpture geometry
- 🏺 **Layer System** - Non-destructive stacking of base shapes, deformations, and glazes
- 🎨 **Workspaces** - Sculpt (shape), Glaze (color), Force (deformation), Export

### Recording Modes
- 🎵 **Standard Mode** - 10-30 second recordings for quick shapes
- 🎶 **Song Mode** - 1-5 minute recordings with 512-point resolution
- 🌀 **Coil Mode** - Build spiral pottery layer by layer (traditional coiling technique)

### Fabrication & Export
- 🏺 **Ceramic Constraints** - Pottery physics: hand access (70mm min), clay smoothing, stable bases
- 🖨️ **3D Print Constraints** - FDM rules: 60° max overhang, contiguous geometry
- 📦 **Export Formats** - STL (real millimeters), GLTF/GLB (with PBR materials), High-res PNG renders

### Visual Features
- ✨ **PBR Ceramic Materials** - Clearcoat glaze, sheen, subsurface scattering simulation
- 💡 **Professional 3-Point Lighting** - Key, fill, and rim lights with hemisphere ambient
- 🌈 **Dazzler Effect** - Voice-reactive emissive materials that glow with your voice
- 🎯 **Heatmap View** - Stress visualization for fabrication analysis

### AI & Automation
- 🤖 **AI Sculpture Modifications** - Cloud (OpenAI) and Local (WebLLM) AI assistants
- 🎭 **Performance Wizard** - Guided workflow: Shape → Detail → Glaze → Export
- 🔗 **Voice Links** - Map pitch to twist, timbre to roughness (hands-free control)

### Persistence
- 💾 **Project Management** - Save/load sculptures with OPFS
- 📤 **Multi-format Export** - PNG, SVG, WAV, STL, GLTF

## Tech Stack

- **Framework:** SvelteKit (TypeScript)
- **3D Engine:** Threlte v9 + Three.js
- **Audio:** Web Audio API (AudioWorklet)
- **AI:** OpenAI API & @mlc-ai/web-llm (WebGPU)
- **Storage:** OPFS (Origin Private File System)

## Prerequisites

- **Supported browsers:** Chrome/Edge (recommended for WebGPU), Firefox (full support), Safari (limited because SharedArrayBuffer is unavailable).
- **Platform capabilities:** WebGPU is recommended for local AI acceleration (falls back to WebGL when unavailable). Web Audio API access (with microphone permission) and OPFS support are required for recording and persistent storage.
- **Playwright browsers:** Install bundled browsers for end-to-end tests with `npx playwright install`.
- **AI/ML backends:** Provide a cloud API key via the in-app Settings panel when using the cloud provider. No build-time feature flags or environment variables are required; optional API endpoint overrides can also be set in Settings.

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build
npm run build

# Preview production build
npm run preview

# Type check
npm run check

# Format and lint
npm run format
npm run lint
```

## Testing

### Test Suite Overview

The project includes comprehensive testing coverage:

1. **Unit Tests** - Store logic, constraints, physics mapping
2. **Component Tests** - Svelte component behaviors and interactions
3. **E2E Tests** - Full studio workflow with Playwright

### Running Tests

```bash
# Run all tests (unit + integration)
npm run test

# Run only unit tests
npm run test:unit

# Run only E2E tests (requires dev server)
npm run test:integration

# Run unit tests in watch mode
npx vitest

# Run E2E tests with UI
npx playwright test --ui

# Run E2E tests for specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox

# View E2E test report
npx playwright show-report
```

### Test Files

**Unit Tests** (`src/lib/__tests__/`)

- `stores.test.ts` - Recording, UI, and Voice Links store state management
- `constraints.test.ts` - Fabrication constraint logic (ceramic, 3D print, digital modes)
- `physicsMapping.test.ts` - Lathe geometry generation and deformation
- `ringBuffer.test.ts` - Audio ring buffer operations
- `svgExport.test.ts` - SVG export functionality

**E2E Tests** (`tests/e2e/`)

- `studio-flow.spec.ts` - Main studio workflow:
  - Application load and initialization
  - New project creation with modal
  - Panel toggles (Design, Fabrication, Settings)
  - Constraint mode switching (Digital, Ceramic, 3D Print)
  - Transport controls (record/stop)
  - Window resize responsiveness
  - State persistence across interactions

### Test Coverage

| Area        | Coverage                      | Status           |
| ----------- | ----------------------------- | ---------------- |
| Store Logic | Recording, UI, Voice Links    | ✅ Comprehensive |
| Constraints | All 3 modes + edge cases      | ✅ Comprehensive |
| Physics     | Lathe generation, deformation | ✅ Covered       |
| E2E Flow    | Main user workflows           | ✅ Core paths    |
| Audio       | Ring buffer, analysis         | ✅ Basic tests   |

### Writing New Tests

**Unit Test Pattern:**

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature', () => {
	it('should do something', () => {
		const result = myFunction();
		expect(result).toBe(expected);
	});
});
```

**E2E Test Pattern:**

```typescript
import { test, expect } from '@playwright/test';

test('should interact with UI', async ({ page }) => {
	await page.goto('/');
	await page.click('button:has-text("Action")');
	await expect(page.locator('text=Result')).toBeVisible();
});
```

### CI/CD Integration

Tests are configured to run in CI environments:

- Unit tests run on every commit
- E2E tests run in headless mode
- Retries enabled for flaky tests
- Screenshots/videos captured on failure

### Performance Notes

- Unit tests: ~2-5 seconds
- E2E tests: ~20-30 seconds (includes dev server startup)
- Use `--watch` mode during development for fast iteration

### Debugging Tests

```bash
# Debug unit tests with inspector
node --inspect-brk ./node_modules/vitest/vitest.mjs run

# Debug E2E tests with Playwright Inspector
PWDEBUG=1 npx playwright test

# Run single test
npx vitest studio-flow.spec.ts
```

## Browser Support

- Chrome/Edge (recommended) - Full support
- Firefox - Full support
- Safari - Limited (no SharedArrayBuffer support)

## Requirements

- Node.js 18+ for development
- COOP/COEP headers for SharedArrayBuffer
- WebGPU for local AI (optional, falls back to WebGL)
- Microphone permissions

## Troubleshooting

- **Headless runs:** When running Playwright or browser automation in CI, ensure `npx playwright install` has been executed so Chromium/Firefox/WebKit binaries are available. Supply `--headless=new` for modern headless mode and include the required COOP/COEP headers in your server configuration.
- **Audio permissions:** If microphone capture fails, verify the browser has microphone access and that the page is served over HTTPS (or localhost). Clear blocked permission states and refresh, then restart recording.

## License

MIT
