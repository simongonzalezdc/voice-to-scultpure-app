/**
 * Real-time Feedback Mode Store
 * P1: Immediate visual feedback modes (Breath/Pulse/Flow)
 * Lets users feel the sculpture responding BEFORE committing to a recording
 */

export type FeedbackMode = 
	| 'none'      // No real-time feedback (standard mode)
	| 'breath'    // Sculpture breathes (scales) with volume
	| 'pulse'     // Beat detection triggers visible pulses
	| 'flow'      // Pitch bends the silhouette in real-time
	| 'mirror';   // Full real-time preview (all parameters)

export interface FeedbackConfig {
	mode: FeedbackMode;
	
	// Breath mode settings
	breath: {
		minScale: number;      // Scale when silent (0.8 = 80%)
		maxScale: number;      // Scale at max volume (1.3 = 130%)
		smoothing: number;     // How smooth the breathing (0-1, higher = smoother)
		axis: 'all' | 'y' | 'xz'; // Which axis to scale
	};
	
	// Pulse mode settings
	pulse: {
		intensity: number;     // How much to pulse (0-1)
		duration: number;      // Pulse duration in ms
		color: string;         // Flash color
		scaleOnBeat: number;   // Scale multiplier on beat
	};
	
	// Flow mode settings
	flow: {
		pitchInfluence: number;   // How much pitch affects shape (0-1)
		energyInfluence: number;  // How much energy affects shape (0-1)
		smoothing: number;        // Transition smoothing
		twistOnPitch: boolean;    // Rotate based on pitch changes
	};
}

interface FeedbackState {
	config: FeedbackConfig;
	
	// Current real-time values (computed from audio)
	currentScale: number;
	currentTwist: number;
	currentRadius: number;
	currentEmissive: number;
	
	// Beat pulse state
	pulseActive: boolean;
	pulseProgress: number; // 0-1, current pulse animation
	lastBeatTime: number;
	
	// Statistics
	enabled: boolean;
}

// Default configuration
const DEFAULT_CONFIG: FeedbackConfig = {
	mode: 'breath', // Default to breath for immediate feedback
	breath: {
		minScale: 0.85,
		maxScale: 1.2,
		smoothing: 0.15,
		axis: 'all'
	},
	pulse: {
		intensity: 0.8,
		duration: 300,
		color: '#ffffff',
		scaleOnBeat: 1.15
	},
	flow: {
		pitchInfluence: 0.7,
		energyInfluence: 0.5,
		smoothing: 0.2,
		twistOnPitch: true
	}
};

export const feedbackModeStore = $state<FeedbackState>({
	config: DEFAULT_CONFIG,
	currentScale: 1.0,
	currentTwist: 0,
	currentRadius: 0.5,
	currentEmissive: 0,
	pulseActive: false,
	pulseProgress: 0,
	lastBeatTime: 0,
	enabled: true
});

// ============================================================================
// FEEDBACK MODE CONTROLS
// ============================================================================

/**
 * Set the feedback mode
 */
export function setFeedbackMode(mode: FeedbackMode): void {
	feedbackModeStore.config.mode = mode;
	console.log(`🎭 [FEEDBACK] Mode set to: ${mode}`);
}

/**
 * Toggle feedback on/off
 */
export function toggleFeedback(): void {
	feedbackModeStore.enabled = !feedbackModeStore.enabled;
	console.log(`🎭 [FEEDBACK] ${feedbackModeStore.enabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Update breath mode settings
 */
export function setBreathConfig(config: Partial<FeedbackConfig['breath']>): void {
	feedbackModeStore.config.breath = {
		...feedbackModeStore.config.breath,
		...config
	};
}

/**
 * Update pulse mode settings
 */
export function setPulseConfig(config: Partial<FeedbackConfig['pulse']>): void {
	feedbackModeStore.config.pulse = {
		...feedbackModeStore.config.pulse,
		...config
	};
}

/**
 * Update flow mode settings
 */
export function setFlowConfig(config: Partial<FeedbackConfig['flow']>): void {
	feedbackModeStore.config.flow = {
		...feedbackModeStore.config.flow,
		...config
	};
}

// ============================================================================
// REAL-TIME UPDATE FUNCTIONS
// ============================================================================

// Smoothed values for interpolation
let smoothedEnergy = 0;
let smoothedPitch = 0;
let smoothedRadius = 0.5;

/**
 * Update feedback values based on current audio analysis
 * Call this from the main render loop
 */
export function updateFeedback(energy: number, pitch: number, beat: boolean): void {
	if (!feedbackModeStore.enabled) return;
	
	const { mode, breath, pulse, flow } = feedbackModeStore.config;
	
	// Apply smoothing to raw values
	const smoothingFactor = mode === 'breath' ? breath.smoothing : 
		mode === 'flow' ? flow.smoothing : 0.1;
	
	smoothedEnergy = smoothedEnergy * (1 - smoothingFactor) + energy * smoothingFactor;
	smoothedPitch = pitch > 0 ? smoothedPitch * 0.9 + pitch * 0.1 : smoothedPitch;
	
	// Calculate mode-specific feedback
	switch (mode) {
		case 'breath':
			updateBreathFeedback(smoothedEnergy);
			break;
		case 'pulse':
			updatePulseFeedback(smoothedEnergy, beat);
			break;
		case 'flow':
			updateFlowFeedback(smoothedEnergy, smoothedPitch);
			break;
		case 'mirror':
			// Full mirror mode combines all
			updateBreathFeedback(smoothedEnergy);
			updateFlowFeedback(smoothedEnergy, smoothedPitch);
			updatePulseFeedback(smoothedEnergy, beat);
			break;
		case 'none':
			// Reset to defaults
			feedbackModeStore.currentScale = 1.0;
			feedbackModeStore.currentTwist = 0;
			feedbackModeStore.currentRadius = 0.5;
			break;
	}
	
	// Update emissive based on energy (all modes)
	feedbackModeStore.currentEmissive = smoothedEnergy;
}

/**
 * Breath mode: Scale sculpture based on volume
 */
function updateBreathFeedback(energy: number): void {
	const { minScale, maxScale } = feedbackModeStore.config.breath;
	
	// Map energy (0-1) to scale range
	const scale = minScale + energy * (maxScale - minScale);
	feedbackModeStore.currentScale = scale;
}

/**
 * Pulse mode: Trigger pulses on beat
 */
function updatePulseFeedback(energy: number, beat: boolean): void {
	const { intensity, duration, scaleOnBeat } = feedbackModeStore.config.pulse;
	const now = Date.now();
	
	// Check for new beat
	if (beat && now - feedbackModeStore.lastBeatTime > 100) {
		feedbackModeStore.pulseActive = true;
		feedbackModeStore.pulseProgress = 0;
		feedbackModeStore.lastBeatTime = now;
	}
	
	// Update pulse animation
	if (feedbackModeStore.pulseActive) {
		const elapsed = now - feedbackModeStore.lastBeatTime;
		feedbackModeStore.pulseProgress = Math.min(1, elapsed / duration);
		
		// Ease-out curve for pulse decay
		const eased = 1 - Math.pow(feedbackModeStore.pulseProgress, 2);
		
		// Apply pulse to scale
		const pulseScale = 1 + (scaleOnBeat - 1) * eased * intensity;
		feedbackModeStore.currentScale = pulseScale;
		
		// Apply pulse to emissive
		feedbackModeStore.currentEmissive = energy + eased * intensity * 0.5;
		
		if (feedbackModeStore.pulseProgress >= 1) {
			feedbackModeStore.pulseActive = false;
		}
	} else {
		// Subtle breathing between beats
		feedbackModeStore.currentScale = 1 + energy * 0.1;
	}
}

/**
 * Flow mode: Morph shape based on pitch and energy
 */
function updateFlowFeedback(energy: number, pitch: number): void {
	const { pitchInfluence, energyInfluence, twistOnPitch } = feedbackModeStore.config.flow;
	
	// Map pitch to radius (inverted: low pitch = wide, high pitch = narrow)
	const pitchNormalized = pitch > 0 ? Math.max(0, Math.min(1, (pitch - 80) / 520)) : 0.5;
	const pitchRadius = 1 - pitchNormalized; // Inverted
	
	// Combine pitch and energy influence
	const targetRadius = pitchRadius * pitchInfluence + energy * energyInfluence;
	
	// Smooth the radius change
	smoothedRadius = smoothedRadius * 0.9 + targetRadius * 0.1;
	feedbackModeStore.currentRadius = smoothedRadius;
	
	// Twist based on pitch changes
	if (twistOnPitch && pitch > 0) {
		const pitchDelta = pitch - smoothedPitch;
		const twistDelta = (pitchDelta / 100) * pitchInfluence; // Degrees
		feedbackModeStore.currentTwist += twistDelta;
		
		// Clamp twist
		feedbackModeStore.currentTwist = Math.max(-180, Math.min(180, feedbackModeStore.currentTwist));
	}
	
	// Subtle scale based on energy
	feedbackModeStore.currentScale = 1 + energy * energyInfluence * 0.2;
}

/**
 * Reset all feedback values to defaults
 */
export function resetFeedback(): void {
	feedbackModeStore.currentScale = 1.0;
	feedbackModeStore.currentTwist = 0;
	feedbackModeStore.currentRadius = 0.5;
	feedbackModeStore.currentEmissive = 0;
	feedbackModeStore.pulseActive = false;
	feedbackModeStore.pulseProgress = 0;
	smoothedEnergy = 0;
	smoothedPitch = 0;
	smoothedRadius = 0.5;
}

// ============================================================================
// GETTERS FOR SCULPTURE COMPONENT
// ============================================================================

/**
 * Get the current scale transform for the sculpture
 */
export function getScaleTransform(): { x: number; y: number; z: number } {
	const scale = feedbackModeStore.currentScale;
	const { axis } = feedbackModeStore.config.breath;
	
	switch (axis) {
		case 'y':
			return { x: 1, y: scale, z: 1 };
		case 'xz':
			return { x: scale, y: 1, z: scale };
		default:
			return { x: scale, y: scale, z: scale };
	}
}

/**
 * Get the current twist rotation
 */
export function getTwistRotation(): number {
	return feedbackModeStore.currentTwist * (Math.PI / 180); // Convert to radians
}

/**
 * Check if pulse flash should be shown
 */
export function shouldShowPulseFlash(): boolean {
	return feedbackModeStore.pulseActive && feedbackModeStore.pulseProgress < 0.3;
}

/**
 * Get pulse color with current intensity
 */
export function getPulseColor(): string {
	if (!feedbackModeStore.pulseActive) return 'transparent';
	
	const { color, intensity } = feedbackModeStore.config.pulse;
	const alpha = (1 - feedbackModeStore.pulseProgress) * intensity;
	
	// Convert hex to rgba
	const r = parseInt(color.slice(1, 3), 16);
	const g = parseInt(color.slice(3, 5), 16);
	const b = parseInt(color.slice(5, 7), 16);
	
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

