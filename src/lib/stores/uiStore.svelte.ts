export type OnboardingStep =
	| 'welcome'
	| 'mic-permission'
	| 'calibration'
	| 'first-recording'
	| 'ai-tutorial';

export const uiStore = $state<{
	panels: {
		aiPanel: boolean;
		projectList: boolean;
		settings: boolean;
		fabricationPanel: boolean;
		glazeMixer: boolean;
	};
	onboarding: {
		active: boolean;
		currentStep: OnboardingStep | null;
		completed: Set<OnboardingStep>;
	};
	orientation: 'vertical' | 'horizontal';
	sculptMode: 'additive' | 'subtractive';
	toolMode: 'sculpt' | 'glaze-mix' | 'glaze-paint';
	activeGlaze: {
		color: string; // Hex color
		roughness: number; // 0-1
	};
	view: {
		lightingAngle: number;
		zoom: number;
	};
	sculptZone: {
		min: number; // 0.0 = bottom
		max: number; // 1.0 = top
	};
	constraintMode: 'digital' | 'ceramic' | '3d_print';
}>({
	panels: {
		aiPanel: false,
		projectList: false,
		settings: false,
		fabricationPanel: false,
		glazeMixer: false
	},
	onboarding: {
		active: false,
		currentStep: null,
		completed: new Set()
	},
	orientation: 'vertical',
	sculptMode: 'additive',
	toolMode: 'sculpt',
	activeGlaze: {
		color: '#FFFFFF',
		roughness: 0.5
	},
	view: {
		lightingAngle: 0,
		zoom: 1.0
	},
	sculptZone: {
		min: 0.0, // Default: entire height (bottom)
		max: 1.0 // Default: entire height (top)
	},
	constraintMode: 'digital' // Default: no constraints
});

export function togglePanel(panel: keyof typeof uiStore.panels): void {
	uiStore.panels[panel] = !uiStore.panels[panel];
}

export function openPanel(panel: keyof typeof uiStore.panels): void {
	uiStore.panels[panel] = true;
}

export function closePanel(panel: keyof typeof uiStore.panels): void {
	uiStore.panels[panel] = false;
}

const steps: OnboardingStep[] = [
	'welcome',
	'mic-permission',
	'calibration',
	'first-recording',
	'ai-tutorial'
];

export function startOnboarding(step: OnboardingStep = steps[0]): void {
	uiStore.onboarding.active = true;
	uiStore.onboarding.currentStep = step;
}

export function completeOnboardingStep(step: OnboardingStep): void {
	uiStore.onboarding.completed.add(step);
}

export function nextOnboardingStep(): void {
	const current = uiStore.onboarding.currentStep;
	if (!current) {
		uiStore.onboarding.currentStep = steps[0];
		return;
	}
	const currentIndex = steps.indexOf(current);
	if (currentIndex < steps.length - 1) {
		uiStore.onboarding.currentStep = steps[currentIndex + 1];
		completeOnboardingStep(current);
	} else {
		finishOnboarding();
	}
}

export function finishOnboarding(): void {
	uiStore.onboarding.active = false;
	uiStore.onboarding.currentStep = null;
	steps.forEach((step) => completeOnboardingStep(step));
}

export function toggleOrientation(): void {
	uiStore.orientation = uiStore.orientation === 'vertical' ? 'horizontal' : 'vertical';
}

export function setOrientation(orientation: 'vertical' | 'horizontal'): void {
	uiStore.orientation = orientation;
}

export function setLightingAngle(angle: number): void {
	uiStore.view.lightingAngle = angle;
}

export function setZoom(zoom: number): void {
	uiStore.view.zoom = Math.max(0.5, Math.min(3.0, zoom));
}

export function setSculptMode(mode: 'additive' | 'subtractive'): void {
	uiStore.sculptMode = mode;
}

export function setToolMode(mode: 'sculpt' | 'glaze-mix' | 'glaze-paint'): void {
	uiStore.toolMode = mode;
}

export function setActiveGlaze(color: string, roughness: number): void {
	uiStore.activeGlaze = { color, roughness };
}

export function setSculptZone(min: number, max: number): void {
	const clampedMin = Math.max(0, Math.min(1, min));
	const clampedMax = Math.max(0, Math.min(1, max));

	if (clampedMin > clampedMax) {
		console.warn?.('Sculpt zone min exceeds max; swapping values.', {
			min: clampedMin,
			max: clampedMax
		});
		uiStore.sculptZone = { min: clampedMax, max: clampedMin };
		return;
	}

	uiStore.sculptZone = {
		min: clampedMin,
		max: clampedMax
	};
}

export function setConstraintMode(mode: 'digital' | 'ceramic' | '3d_print'): void {
	uiStore.constraintMode = mode;
}
