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
	};
	onboarding: {
		active: boolean;
		currentStep: OnboardingStep | null;
		completed: Set<OnboardingStep>;
	};
}>({
	panels: {
		aiPanel: false,
		projectList: false,
		settings: false,
		fabricationPanel: false
	},
	onboarding: {
		active: false,
		currentStep: null,
		completed: new Set()
	}
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

export function startOnboarding(step: OnboardingStep = 'welcome'): void {
	uiStore.onboarding.active = true;
	uiStore.onboarding.currentStep = step;
}

export function completeOnboardingStep(step: OnboardingStep): void {
	uiStore.onboarding.completed.add(step);
}

export function nextOnboardingStep(): void {
	const steps: OnboardingStep[] = [
		'welcome',
		'mic-permission',
		'calibration',
		'first-recording',
		'ai-tutorial'
	];
	const current = uiStore.onboarding.currentStep;
	if (!current) {
		uiStore.onboarding.currentStep = 'welcome';
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

const steps: OnboardingStep[] = [
	'welcome',
	'mic-permission',
	'calibration',
	'first-recording',
	'ai-tutorial'
];

export function finishOnboarding(): void {
	uiStore.onboarding.active = false;
	uiStore.onboarding.currentStep = null;
	steps.forEach((step) => completeOnboardingStep(step));
}
