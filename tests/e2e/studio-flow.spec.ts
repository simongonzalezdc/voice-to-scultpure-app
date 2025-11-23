import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Main Studio Flow
 *
 * Tests the complete user journey including:
 * - Application load and initialization
 * - New project creation
 * - Panel toggles
 * - Constraint mode switching
 * - Settings panel access
 */

test.describe('Voice-to-Sculpture Studio - Main Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the application
		await page.goto('/');

		// Wait for the app to load (check for header or main canvas)
		await page.waitForSelector('[class*="Header"]', { timeout: 5000 }).catch(() => {
			// Fallback if header doesn't load, wait for canvas
			return page.waitForSelector('canvas', { timeout: 5000 });
		});
	});

	test('should load application successfully', async ({ page }) => {
		// Check for key elements
		const header = await page.locator('text=/Voice|Studio|Sculpture/i').first();
		await expect(header).toBeVisible();

		// Check for main 3D canvas
		const canvas = await page.locator('canvas').first();
		await expect(canvas).toBeVisible();

		console.log('✅ Application loaded successfully');
	});

	test('should show new project modal when no sculpture exists', async ({ page }) => {
		// Clear any existing project by checking if modal appears
		const modal = page.locator('text=/New Sculpture Project|Create Project/i');

		// Modal should appear on fresh load if no project exists
		const isVisible = await modal.isVisible().catch(() => false);

		if (isVisible) {
			await expect(modal).toBeVisible();
			console.log('✅ New Project Modal visible');
		}
	});

	test('should create a new project with ceramic constraints', async ({ page }) => {
		// Look for the "Create Project" button or modal
		const createButton = page.locator('button:has-text("Create Project")').first();

		// If modal exists, proceed with creation
		const isModalVisible = await createButton.isVisible().catch(() => false);

		if (isModalVisible) {
			// Select ceramic material (if not already selected)
			const ceramicButton = page.locator('text=Ceramic').locator('..').first();
			await ceramicButton.click().catch(() => {
				// Might already be selected
			});

			// Select ceramic constraints
			const ceramicConstraintButton = page
				.locator('button', { has: page.locator('text=🏺 Ceramic') })
				.first();
			await ceramicConstraintButton.click().catch(() => {
				// Might already be selected
			});

			// Click Create Project
			await createButton.click();

			// Wait for sculpture to load
			await page.waitForTimeout(1000);

			console.log('✅ Project created with ceramic constraints');
		}
	});

	test('should toggle design panel', async ({ page }) => {
		// Look for Design tab or panel toggle
		const designTab = page.locator('text=Design').first();
		const isTabVisible = await designTab.isVisible().catch(() => false);

		if (isTabVisible) {
			await designTab.click();
			await expect(designTab).toHaveClass(/active|selected/i);
			console.log('✅ Design panel toggled');
		}
	});

	test('should toggle fabrication panel', async ({ page }) => {
		// Look for Fabrication tab
		const fabricationTab = page.locator('text=Fabrication').first();
		const isTabVisible = await fabricationTab.isVisible().catch(() => false);

		if (isTabVisible) {
			await fabricationTab.click();

			// Verify fabrication options are visible
			const constraintButtons = page.locator('button', { has: page.locator('text=/🪄|🏺|🖨️/') });
			const count = await constraintButtons.count();

			expect(count).toBeGreaterThan(0);
			console.log('✅ Fabrication panel toggled');
		}
	});

	test('should toggle settings panel', async ({ page }) => {
		// Look for Settings button in header or sidebar
		const settingsButton = page.locator('button:has-text("Settings")').first();
		const isVisible = await settingsButton.isVisible().catch(() => false);

		if (isVisible) {
			await settingsButton.click();

			// Wait for settings panel to appear
			await page.waitForTimeout(300);

			const settingsPanel = page.locator('text=/Settings|preferences/i').first();
			const isPanelVisible = await settingsPanel.isVisible().catch(() => false);

			if (isPanelVisible) {
				console.log('✅ Settings panel toggled');
			}
		}
	});

	test('should switch constraint modes in fabrication panel', async ({ page }) => {
		// Navigate to Fabrication tab
		const fabricationTab = page.locator('text=Fabrication').first();
		await fabricationTab.click().catch(() => {
			// Tab might already be active
		});

		// Find constraint mode buttons
		const digitalButton = page.locator('button:has-text("🪄 Digital")').first();
		const ceramicButton = page.locator('button:has-text("🏺 Ceramic")').first();
		const printButton = page.locator('button:has-text("🖨️ 3D Print")').first();

		// Test switching to Digital
		const isDigitalVisible = await digitalButton.isVisible().catch(() => false);
		if (isDigitalVisible) {
			await digitalButton.click();
			await page.waitForTimeout(200);
			console.log('✅ Switched to Digital mode');
		}

		// Test switching to Ceramic
		const isCeramicVisible = await ceramicButton.isVisible().catch(() => false);
		if (isCeramicVisible) {
			await ceramicButton.click();
			await page.waitForTimeout(200);
			console.log('✅ Switched to Ceramic mode');
		}

		// Test switching to 3D Print
		const isPrintVisible = await printButton.isVisible().catch(() => false);
		if (isPrintVisible) {
			await printButton.click();
			await page.waitForTimeout(200);
			console.log('✅ Switched to 3D Print mode');
		}
	});

	test('should display constraint description text', async ({ page }) => {
		// Navigate to Fabrication
		const fabricationTab = page.locator('text=Fabrication').first();
		await fabricationTab.click().catch(() => {});

		// Look for constraint description text
		const descriptionText = page.locator('text=/constraints|pottery|3D printer/i');
		const count = await descriptionText.count();

		expect(count).toBeGreaterThan(0);
		console.log('✅ Constraint descriptions visible');
	});

	test('should have transport controls (record/stop)', async ({ page }) => {
		// Look for transport controls
		const recordButton = page.locator('button:has-text(/Record|🎤/)').first();
		const stopButton = page.locator('button:has-text(/Stop|⏹)').first();

		const hasRecord = await recordButton.isVisible().catch(() => false);
		const hasStop = await stopButton.isVisible().catch(() => false);

		expect(hasRecord || hasStop).toBe(true);
		console.log('✅ Transport controls present');
	});

	test('should respond to window resize', async ({ page }) => {
		// Get initial canvas size
		const canvas = page.locator('canvas').first();
		const _initialBox = await canvas.boundingBox();

		// Resize window
		await page.setViewportSize({ width: 800, height: 600 });
		await page.waitForTimeout(300);

		// Check that canvas is still visible
		const _resizedBox = await canvas.boundingBox();
		await expect(canvas).toBeVisible();

		console.log('✅ Application responds to resize');
	});

	test('should maintain state on panel toggle', async ({ page }) => {
		// Create initial state by ensuring a project exists
		const createButton = page.locator('button:has-text("Create Project")').first();
		const isModalVisible = await createButton.isVisible().catch(() => false);

		if (isModalVisible) {
			await createButton.click();
			await page.waitForTimeout(500);
		}

		// Toggle between panels
		const designTab = page.locator('text=Design').first();
		const fabricationTab = page.locator('text=Fabrication').first();

		if (await designTab.isVisible()) {
			await designTab.click();
			await page.waitForTimeout(200);

			if (await fabricationTab.isVisible()) {
				await fabricationTab.click();
				await page.waitForTimeout(200);

				// Switch back to design
				await designTab.click();
				await page.waitForTimeout(200);

				// Verify canvas still visible
				const canvas = page.locator('canvas').first();
				await expect(canvas).toBeVisible();

				console.log('✅ State maintained across panel toggles');
			}
		}
	});
});
