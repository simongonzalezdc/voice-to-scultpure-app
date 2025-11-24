export type OnboardingStep =
	| 'welcome'
	| 'mic-permission'
	| 'calibration'
	| 'first-recording'
	| 'ai-tutorial';

export type Workspace = 'sculpt' | 'glaze' | 'force' | 'export';

export const uiStore = $state<{
	panels: {
		aiPanel: boolean;
		projectList: boolean;
		settings: boolean;
	};
	workspace: Workspace;
	onboarding: {
		active: boolean;
		currentStep: OnboardingStep | null;
		completed: Set<OnboardingStep>;
	};
	orientation: 'vertical' | 'horizontal';
	sculptMode: 'additive' | 'subtractive';
	// toolMode deprecated in favor of workspace + local state
	controlMode: 'standard' | 'melodic'; // 'standard' = Volume->Radius, 'melodic' = Pitch->Radius
	forceParams: {
		damping: number; // 0-1
		hardness: number; // 0-1
		radius: number; // 0-1 (Focus)
		strength: number; // 0-1 (Power)
	};
	activeGlaze: {
		color: string; // Hex color
		roughness: number; // 0-1
	};
	view: {
		lightingAngle: number;
		zoom: number;
		mode: 'standard' | 'xray' | 'wireframe' | 'heatmap';
		environment: 'studio' | 'neon' | 'darkroom';
		blueprintId: string | null;
		showBlueprint: boolean;
	};
	modifiers: {
		quantize: boolean;
		symmetryCount: number;
	};
	showGhost: boolean;
	sculptZone: {
		min: number; // 0.0 = bottom
		max: number; // 1.0 = top
	};
	constraintMode: 'digital' | 'ceramic' | '3d_print';
	autoFixGeometry: boolean;
	// GENERATIVE PERFORMANCE: Wizard mode
	performanceWizardActive: boolean;
}>({
	panels: {
		aiPanel: false,
		projectList: false,
		settings: false
	},
	workspace: 'sculpt',
	onboarding: {
		active: false,
		currentStep: null,
		completed: new Set()
	},
	orientation: 'vertical',
	sculptMode: 'additive',
	controlMode: 'standard',
	forceParams: {
		damping: 0.5,
		hardness: 0.5,
		radius: 0.5,
		strength: 0.5
	},
	activeGlaze: {
		color: '#FFFFFF',
		roughness: 0.5
	},
	view: {
		lightingAngle: 0,
		zoom: 1.0,
		mode: 'standard',
		environment: 'studio',
		blueprintId: null,
		showBlueprint: false
	},
	modifiers: {
		quantize: false,
		symmetryCount: 0
	},
	showGhost: true,
	sculptZone: {
		min: 0.0, // Default: entire height (bottom)
		max: 1.0 // Default: entire height (top)
	},
	constraintMode: 'digital', // Default: no constraints
	autoFixGeometry: true, // Default: Auto-fix enabled
	performanceWizardActive: false // GENERATIVE PERFORMANCE: Wizard overlay
});

export function setAutoFixGeometry(enabled: boolean): void {
	uiStore.autoFixGeometry = enabled;
}

export function setWorkspace(workspace: Workspace): void {
	uiStore.workspace = workspace;
}

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

export function setViewMode(mode: 'standard' | 'xray' | 'wireframe' | 'heatmap'): void {
	uiStore.view.mode = mode;
}

export function setEnvironment(env: 'studio' | 'neon' | 'darkroom'): void {
	uiStore.view.environment = env;
}

export function setBlueprint(id: string | null): void {
	uiStore.view.blueprintId = id;
}

export function toggleBlueprintVisibility(): void {
	uiStore.view.showBlueprint = !uiStore.view.showBlueprint;
}

export function setQuantizeEnabled(enabled: boolean): void {
	uiStore.modifiers.quantize = enabled;
}

export function setSymmetryCount(count: number): void {
	uiStore.modifiers.symmetryCount = Math.max(0, Math.floor(count));
}

export function setSculptMode(mode: 'additive' | 'subtractive'): void {
	uiStore.sculptMode = mode;
}

export function setControlMode(mode: 'standard' | 'melodic'): void {
	uiStore.controlMode = mode;
}

export function setToolMode(mode: 'sculpt' | 'glaze-mix' | 'glaze-paint' | 'force'): void {
	// uiStore.toolMode = mode;
	if (mode === 'sculpt') uiStore.workspace = 'sculpt';
	else if (mode === 'force') uiStore.workspace = 'force';
	else uiStore.workspace = 'glaze';
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

// GENERATIVE PERFORMANCE: Wizard controls
export function openPerformanceWizard(): void {
	uiStore.performanceWizardActive = true;
}

export function closePerformanceWizard(): void {
	uiStore.performanceWizardActive = false;
}
