# Testing Guide - Voice-to-Sculpture Studio

## Overview

The Voice-to-Sculpture Studio includes a comprehensive testing suite with:

- **Unit Tests** - Store logic, constraints, physics calculations (Vitest)
- **E2E Tests** - Complete user workflows (Playwright)
- **Integration Tests** - Audio pipeline, serialization (Vitest)

## Test Architecture

```
tests/
├── e2e/
│   └── studio-flow.spec.ts          # Main user workflow (Playwright)
└── (Playwright test directory)

src/lib/__tests__/
├── stores.test.ts                   # State management (Vitest)
├── constraints.test.ts              # Fabrication constraints (Vitest)
├── physicsMapping.test.ts           # Geometry generation (Vitest)
├── ringBuffer.test.ts               # Audio buffering (Vitest)
└── svgExport.test.ts                # SVG export (Vitest)
```

## Running Tests

### All Tests

```bash
npm run test
# Runs: npm run test:unit && npm run test:integration
```

### Unit Tests Only

```bash
npm run test:unit
# Runs Vitest for all .test.ts files
```

### E2E Tests Only

```bash
npm run test:integration
# Runs Playwright tests
```

### Watch Mode (Development)

```bash
npm run test:unit -- --watch
# or
npx vitest --watch
```

### E2E Tests with UI

```bash
npx playwright test --ui
# Opens Playwright Inspector for interactive debugging
```

### Single Test File

```bash
npx vitest src/lib/__tests__/constraints.test.ts
npx playwright test tests/e2e/studio-flow.spec.ts
```

### Specific Browser (E2E)

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
```

### View E2E Report

```bash
npx playwright show-report
# Opens HTML report of test results with screenshots/videos
```

## Test Coverage

### Unit Tests Coverage

| Module                             | Tests  | Coverage                                    |
| ---------------------------------- | ------ | ------------------------------------------- |
| `stores/uiStore.svelte.ts`         | 12     | Panel toggles, tool modes, constraint modes |
| `stores/recording.svelte.ts`       | 5      | State management, frame handling            |
| `stores/voiceLinksStore.svelte.ts` | 8      | Voice link toggles, pitch/timbre mapping    |
| `engine/constraints.ts`            | 18     | All 3 constraint modes + edge cases         |
| `engine/physicsMapping.ts`         | 3      | Lathe generation, deformation               |
| Total                              | **46** | Core state + physics logic                  |

### E2E Test Coverage

| Flow                 | Tests  | Features                                 |
| -------------------- | ------ | ---------------------------------------- |
| Application Load     | 2      | Initialization, header/canvas presence   |
| Project Creation     | 2      | Modal display, project setup             |
| Panel Interactions   | 4      | Design, Fabrication, Settings toggles    |
| Constraint Switching | 4      | Digital, Ceramic, 3D Print modes         |
| Transport Controls   | 2      | Record/Stop buttons, state tracking      |
| Window Events        | 2      | Resize responsiveness, state persistence |
| Total                | **16** | Main user workflows                      |

## Test Specifications

### Unit Test: Ceramic Constraints

Tests the hardened ceramic constraint logic:

- ✅ Hand Access Floor (minimum radius enforcement)
- ✅ Structural Smoothing (SMA filter)
- ✅ Topological Safe Mode (shape boost)
- ✅ Overhang Limitations (45° max)
- ✅ Base Stability (wide foundation)

### Unit Test: Voice Links

Tests hands-free voice control mapping:

- ✅ Pitch → Twist (80-400 Hz range)
- ✅ Timbre → Roughness (1000-8000 Hz spectral centroid)
- ✅ Toggle activation/deactivation
- ✅ Range clamping and boundary conditions

### E2E Test: Studio Flow

Tests complete user journey:

1. ✅ App loads successfully
2. ✅ New Project Modal appears (if no project)
3. ✅ Can create project with ceramic constraints
4. ✅ Can toggle Design/Fabrication/Settings panels
5. ✅ Can switch constraint modes
6. ✅ State persists across panel toggles
7. ✅ App responds to window resize

## Writing New Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Feature Name', () => {
	beforeEach(() => {
		// Setup
	});

	it('should do something specific', () => {
		const result = myFunction();
		expect(result).toBe(expected);
	});

	it('should handle edge case', () => {
		expect(() => myFunction(invalid)).toThrow();
	});
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('should perform user action', async ({ page }) => {
		// Find element
		const button = page.locator('button:has-text("Action")');

		// Interact
		await button.click();

		// Assert result
		await expect(page.locator('text=Success')).toBeVisible();
	});
});
```

## CI/CD Integration

Tests are configured for continuous integration:

```yaml
# .github/workflows/test.yml (example)
- name: Run Unit Tests
  run: npm run test:unit

- name: Run E2E Tests
  run: npm run test:integration
```

### CI Configuration

- Unit tests: Run on every commit
- E2E tests: Run before release builds
- Retries: 2 attempts on CI
- Parallelization: Disabled on CI for stability

## Debugging Tests

### Debug Unit Tests

```bash
# With Node Inspector
node --inspect-brk ./node_modules/vitest/vitest.mjs run

# Then open chrome://inspect in Chrome
```

### Debug E2E Tests

```bash
# With Playwright Inspector
PWDEBUG=1 npx playwright test tests/e2e/studio-flow.spec.ts
```

### View Test Output

```bash
# Verbose mode
npm run test:unit -- --reporter=verbose

# With coverage
npm run test:unit -- --coverage
```

### Screenshots on Failure

E2E tests automatically capture:

- Screenshots of failed assertions
- Videos of entire test run
- Network request logs
- Browser console output

Located in: `./test-results/` after `playwright test --ui`

## Performance

| Suite      | Time | Notes                       |
| ---------- | ---- | --------------------------- |
| Unit Tests | ~2s  | Fast, can be run frequently |
| E2E Tests  | ~30s | Includes server startup     |
| Full Suite | ~35s | Complete validation         |

## Troubleshooting

### Unit Tests Fail with "Cannot find module"

- Ensure dependencies are installed: `npm install`
- Clear cache: `rm -rf node_modules/.vitest`

### E2E Tests Timeout

- Check dev server is running: `npm run dev`
- Increase timeout: `test.setTimeout(30000)`
- Check network: Some tests may fail offline

### Import Resolution Errors

- Run `npm run check` to validate TypeScript
- Verify alias paths in `tsconfig.json`
- Clear `.svelte-kit` directory: `rm -rf .svelte-kit && npm run dev`

### Flaky Tests

- E2E tests retry twice on CI
- Add explicit waits for dynamic content
- Use `waitForLoadState('networkidle')`

## Adding New Tests

1. **Create test file** in `src/lib/__tests__/` (unit) or `tests/e2e/` (E2E)
2. **Follow naming convention:**
   - Unit: `feature.test.ts`
   - E2E: `feature.spec.ts`
3. **Run tests:** `npm run test` or `npm run test:unit`
4. **Update this guide** if adding new test categories

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Continuous Improvement

Tests should grow with the codebase:

- Add tests for new features
- Update tests when behavior changes
- Remove tests for deprecated features
- Refactor tests as patterns emerge

Target coverage: **80%+ for critical paths**
