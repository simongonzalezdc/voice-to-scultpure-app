import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type OnboardingStep,
	finishOnboarding,
	nextOnboardingStep,
	setSculptZone,
	startOnboarding,
	uiStore
} from '../stores/uiStore.svelte';

const onboardingSteps: OnboardingStep[] = [
	'welcome',
	'mic-permission',
	'calibration',
	'first-recording',
	'ai-tutorial'
];

describe('uiStore onboarding flow', () => {
	beforeEach(() => {
		uiStore.onboarding.active = false;
		uiStore.onboarding.currentStep = null;
		uiStore.onboarding.completed = new Set();
	});

	it('defaults to the first step when onboarding has not started', () => {
		nextOnboardingStep();
		expect(uiStore.onboarding.currentStep).toBe(onboardingSteps[0]);
	});

	it('advances through onboarding steps and marks completion', () => {
		startOnboarding();
		expect(uiStore.onboarding.active).toBe(true);
		expect(uiStore.onboarding.currentStep).toBe(onboardingSteps[0]);

		onboardingSteps.forEach((step, index) => {
			expect(uiStore.onboarding.currentStep).toBe(step);
			nextOnboardingStep();

			if (index < onboardingSteps.length - 1) {
				expect(uiStore.onboarding.currentStep).toBe(onboardingSteps[index + 1]);
				expect(uiStore.onboarding.completed.has(step)).toBe(true);
			} else {
				expect(uiStore.onboarding.active).toBe(false);
				expect(uiStore.onboarding.currentStep).toBeNull();
			}
		});

		expect(uiStore.onboarding.completed).toEqual(new Set(onboardingSteps));
	});

	it('marks onboarding as finished explicitly', () => {
		startOnboarding('calibration');
		finishOnboarding();

		expect(uiStore.onboarding.active).toBe(false);
		expect(uiStore.onboarding.currentStep).toBeNull();
		expect(uiStore.onboarding.completed).toEqual(new Set(onboardingSteps));
	});
});

describe('uiStore sculpt zone validation', () => {
	let warnSpy: ReturnType<typeof vi.spyOn> | undefined;

	beforeEach(() => {
		uiStore.sculptZone = { min: 0, max: 1 };
		warnSpy?.mockRestore();
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => warnSpy?.mockRestore());

	it('clamps sculpt zone values to the valid range', () => {
		setSculptZone(-0.5, 1.5);
		expect(uiStore.sculptZone).toEqual({ min: 0, max: 1 });
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('swaps values when min exceeds max', () => {
		setSculptZone(0.8, 0.2);
		expect(uiStore.sculptZone).toEqual({ min: 0.2, max: 0.8 });
		expect(warnSpy).toHaveBeenCalled();
	});

	it('swaps after clamping out-of-range values', () => {
		setSculptZone(1.2, -0.1);
		expect(uiStore.sculptZone).toEqual({ min: 0, max: 1 });
		expect(warnSpy).toHaveBeenCalled();
	});
});
