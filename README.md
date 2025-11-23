# Voice-to-Sculpture Studio

Transform your voice into beautiful 3D sculptures using real-time audio analysis and AI-powered modifications.

**📖 [Testing Guide](./TESTING_GUIDE.md) | [Test Implementation Summary](./TEST_IMPLEMENTATION_SUMMARY.md)**

## Features

- 🎤 Real-time voice capture and analysis
- 🎨 3D sculpture generation from audio features
- 🤖 AI-powered sculpture modifications (Cloud & Local)
- 💾 Project persistence with OPFS
- 📤 Export to PNG, SVG, and WAV

## Tech Stack

- **Framework:** SvelteKit (TypeScript)
- **3D Engine:** Threlte v9 + Three.js
- **Audio:** Web Audio API (AudioWorklet)
- **AI:** OpenAI API & @mlc-ai/web-llm (WebGPU)
- **Storage:** OPFS (Origin Private File System)

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

| Area | Coverage | Status |
|------|----------|--------|
| Store Logic | Recording, UI, Voice Links | ✅ Comprehensive |
| Constraints | All 3 modes + edge cases | ✅ Comprehensive |
| Physics | Lathe generation, deformation | ✅ Covered |
| E2E Flow | Main user workflows | ✅ Core paths |
| Audio | Ring buffer, analysis | ✅ Basic tests |

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

## License

MIT
