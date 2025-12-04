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
		shortcuts: boolean;
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
	controlMode: 'standard' | 'melodic'; // 'standard' = Volume->Radius, 'melodic' = Pitch->Radius (Virtuoso)
	// Recording Mode (Option B: Song Mode)
	recordingMode: 'standard' | 'song'; // 'standard' = 10-30s, 'song' = 1-5min (coil postponed)
	// Base Shape for sculpture geometry (only lathe supported now)
	baseShape: 'lathe'; // 'lathe' = pottery wheel (ribbon mode removed)
	forceParams: {
		damping: number; // 0-1
		hardness: number; // 0-1
		radius: number; // 0-1 (Focus)
		strength: number; // 0-1 (Power)
		toolType: 'brush' | 'lance-carve' | 'lance-engrave'; // Sonic Lance feature
	};
	activeGlaze: {
		color: string; // Hex color
		roughness: number; // 0-1
		transmission: number; // 0-1 (glass-like transparency)
		materialType: 'ceramic' | 'plastic' | 'energy'; // Material type (energy = Dazzler)
		baseColor: string; // Base material color
		// Dazzler Effect (Emissive Controls)
		emissiveEnabled: boolean; // Master toggle for glow
		emissiveBase: number; // 0-1, always-on glow intensity
		emissiveReactivity: number; // 0-1, how much voice energy adds to glow
		emissiveColor: string; // Glow color (defaults to `color` if not set)
		emissiveIntensity: number; // Current emissive intensity (computed)
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
	deformation: {
		twist: number; // Degrees of twist (-360 to 360)
		compression: number; // Vertical stretch/compression (-1 to 1, 0 = no change)
		taper: number; // Radius taper top-to-bottom (-1 to 1, 0 = no change)
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
		settings: false,
		shortcuts: false
	},
	workspace: 'sculpt',
	onboarding: {
		active: false,
		currentStep: null,
		completed: new Set()
	},
	orientation: 'vertical',
	sculptMode: 'additive',
	controlMode: 'melodic', // Default: Virtuoso mode (Pitch->Radius)
	recordingMode: 'song', // Default: Song mode (1-5 min recordings)
	baseShape: 'lathe', // Only lathe supported (ribbon removed)
	forceParams: {
		damping: 0.5,
		hardness: 0.5,
		radius: 0.5,
		strength: 0.5,
		toolType: 'brush' // Default: soft brush mode
	},
	activeGlaze: {
		color: '#FFFFFF',
		roughness: 0.4,
		transmission: 0, // Solid ceramic - no transparency
		materialType: 'ceramic',
		baseColor: '#E0C9A6',
		// Dazzler Effect defaults
		emissiveEnabled: false,
		emissiveBase: 0,
		emissiveReactivity: 0,
		emissiveColor: '#FFFFFF',
		emissiveIntensity: 0
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
	deformation: {
		twist: 0,
		compression: 0,
		taper: 0
	},
	showGhost: true,
	sculptZone: {
		min: 0.0, // Default: entire height (bottom)
		max: 1.0 // Default: entire height (top)
	},
	constraintMode: 'digital', // Default: no constraints for maximum creative freedom
	autoFixGeometry: true, // Default: Auto-fix enabled
	performanceWizardActive: false // GENERATIVE PERFORMANCE: Wizard overlay
});

export function setAutoFixGeometry(enabled: boolean): void {
	console.log(`🔧 [UI STORE] setAutoFixGeometry: ${uiStore.autoFixGeometry} → ${enabled}`);
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

export function startOnboarding(step?: OnboardingStep): void {
	uiStore.onboarding.active = true;
	uiStore.onboarding.currentStep = step ?? steps[0] ?? null;
}

export function completeOnboardingStep(step: OnboardingStep): void {
	uiStore.onboarding.completed.add(step);
}

export function nextOnboardingStep(): void {
	const current = uiStore.onboarding.currentStep;
	if (!current) {
		uiStore.onboarding.currentStep = steps[0] ?? null;
		return;
	}
	const currentIndex = steps.indexOf(current);
	if (currentIndex < steps.length - 1 && currentIndex >= 0) {
		const nextStep = steps[currentIndex + 1];
		if (nextStep) {
			uiStore.onboarding.currentStep = nextStep;
			completeOnboardingStep(current);
		} else {
			finishOnboarding();
		}
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

// Transition state for smooth cinematic changes
interface TransitionState {
	active: boolean;
	progress: number; // 0 to 1
	startTime: number;
	duration: number; // ms
	from: { lightingAngle: number; environment: string };
	to: { lightingAngle: number; environment: string };
}

let cinematicTransition = $state<TransitionState>({
	active: false,
	progress: 1,
	startTime: 0,
	duration: 1500, // 1.5s smooth transition
	from: { lightingAngle: 0, environment: 'studio' },
	to: { lightingAngle: 0, environment: 'studio' }
});

export function getCinematicTransition(): TransitionState {
	return cinematicTransition;
}

export function setLightingAngle(angle: number, smooth: boolean = false): void {
	if (smooth && cinematicTransition.active) {
		// Already transitioning - update target
		cinematicTransition.to.lightingAngle = angle;
	} else if (smooth) {
		// Start new transition
		cinematicTransition = {
			active: true,
			progress: 0,
			startTime: Date.now(),
			duration: 1500,
			from: { lightingAngle: uiStore.view.lightingAngle, environment: uiStore.view.environment },
			to: { lightingAngle: angle, environment: uiStore.view.environment }
		};
	} else {
		uiStore.view.lightingAngle = angle;
	}
}

export function setZoom(zoom: number): void {
	uiStore.view.zoom = Math.max(0.5, Math.min(3.0, zoom));
}

export function setViewMode(mode: 'standard' | 'xray' | 'wireframe' | 'heatmap'): void {
	uiStore.view.mode = mode;
}

export function setEnvironment(env: 'studio' | 'neon' | 'darkroom', smooth: boolean = false): void {
	if (smooth) {
		// Smooth environment transition
		cinematicTransition = {
			active: true,
			progress: 0,
			startTime: Date.now(),
			duration: 1500,
			from: { lightingAngle: uiStore.view.lightingAngle, environment: uiStore.view.environment },
			to: { lightingAngle: uiStore.view.lightingAngle, environment: env }
		};
	}
	uiStore.view.environment = env;
}

/**
 * Update cinematic transition progress (call from animation loop)
 */
export function updateCinematicTransition(): void {
	if (!cinematicTransition.active) return;

	const elapsed = Date.now() - cinematicTransition.startTime;
	const progress = Math.min(1, elapsed / cinematicTransition.duration);

	// Ease-out cubic
	const eased = 1 - Math.pow(1 - progress, 3);
	cinematicTransition.progress = eased;

	// Interpolate lighting angle
	const fromAngle = cinematicTransition.from.lightingAngle;
	const toAngle = cinematicTransition.to.lightingAngle;
	uiStore.view.lightingAngle = fromAngle + (toAngle - fromAngle) * eased;

	// Complete transition
	if (progress >= 1) {
		cinematicTransition.active = false;
		uiStore.view.lightingAngle = cinematicTransition.to.lightingAngle;
	}
}

export function setBlueprint(id: string | null): void {
	uiStore.view.blueprintId = id;
}

export function toggleBlueprintVisibility(): void {
	uiStore.view.showBlueprint = !uiStore.view.showBlueprint;
}

export function setQuantizeEnabled(enabled: boolean): void {
	console.log(`🔢 [UI STORE] setQuantizeEnabled: ${uiStore.modifiers.quantize} → ${enabled}`);
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

// Option B: Song Mode + Option C: Coil Mode
export function setRecordingMode(mode: 'standard' | 'song' | 'coil'): void {
	uiStore.recordingMode = mode;
	console.log(`🎵 [UI] Recording mode set to: ${mode}`);
}

// Base Shape (only lathe supported now - ribbon removed)
export function setBaseShape(shape: 'lathe'): void {
	uiStore.baseShape = shape;
	console.log(`📐 [UI] Base shape set to: ${shape}`);
}

export function setToolMode(mode: 'sculpt' | 'glaze-mix' | 'glaze-paint' | 'force'): void {
	// uiStore.toolMode = mode;
	if (mode === 'sculpt') uiStore.workspace = 'sculpt';
	else if (mode === 'force') uiStore.workspace = 'force';
	else uiStore.workspace = 'glaze';
}

export function setActiveGlaze(color: string, roughness: number): void {
	uiStore.activeGlaze = {
		...uiStore.activeGlaze,
		color,
		roughness
	};
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
	console.log(`🔧 [UI STORE] setConstraintMode called: "${uiStore.constraintMode}" → "${mode}"`);
	uiStore.constraintMode = mode;
}

// ============================================================================
// SONIC LANCE: Tool Type Controls
// ============================================================================

export type ForceToolType = 'brush' | 'lance-carve' | 'lance-engrave';

export function setForceToolType(toolType: ForceToolType): void {
	uiStore.forceParams.toolType = toolType;

	// Auto-adjust parameters for Lance modes
	if (toolType.startsWith('lance')) {
		// Lance: Fine point, hard edges
		uiStore.forceParams.hardness = 1.0;
		uiStore.forceParams.radius = 0.1; // Small, precise
	}

	console.log(`🗡️ [UI] Force tool type set to: ${toolType}`);
}

// ============================================================================
// DAZZLER EFFECT: Emissive Controls
// ============================================================================

export function setEmissiveEnabled(enabled: boolean): void {
	uiStore.activeGlaze.emissiveEnabled = enabled;

	// When enabling energy mode, set default reactivity
	if (enabled && uiStore.activeGlaze.emissiveReactivity === 0) {
		uiStore.activeGlaze.emissiveReactivity = 0.8;
	}

	// Auto-switch to energy material type
	if (enabled) {
		uiStore.activeGlaze.materialType = 'energy';
	}

	console.log(`💡 [UI] Emissive ${enabled ? 'enabled' : 'disabled'}`);
}

export function setEmissiveBase(base: number): void {
	uiStore.activeGlaze.emissiveBase = Math.max(0, Math.min(1, base));
}

export function setEmissiveReactivity(reactivity: number): void {
	uiStore.activeGlaze.emissiveReactivity = Math.max(0, Math.min(1, reactivity));
}

export function setEmissiveColor(color: string): void {
	uiStore.activeGlaze.emissiveColor = color;
}

export function setEmissiveIntensity(intensity: number): void {
	uiStore.activeGlaze.emissiveIntensity = Math.max(0, intensity);
}

export function setMaterialType(materialType: 'ceramic' | 'plastic' | 'energy'): void {
	uiStore.activeGlaze.materialType = materialType;

	// Auto-enable emissive for energy material
	if (materialType === 'energy' && !uiStore.activeGlaze.emissiveEnabled) {
		uiStore.activeGlaze.emissiveEnabled = true;
		uiStore.activeGlaze.emissiveReactivity = 1.0;
		uiStore.activeGlaze.emissiveBase = 0;
	}

	// Disable emissive when switching away from energy
	if (materialType !== 'energy') {
		uiStore.activeGlaze.emissiveEnabled = false;
	}
}

// GENERATIVE PERFORMANCE: Wizard controls
export function openPerformanceWizard(): void {
	uiStore.performanceWizardActive = true;
}

export function closePerformanceWizard(): void {
	uiStore.performanceWizardActive = false;
}
