/**
 * Centralized constants for the Voice-to-Sculpture application
 * Extracted from various modules to eliminate magic numbers
 */

// Audio Configuration
export const AUDIO_SAMPLE_RATE = 44100;
export const AUDIO_RING_BUFFER_CAPACITY_SECONDS = 10; // 10 seconds of audio capacity

// Pitch Detection Range (Human Vocal Range)
export const MIN_PITCH_HZ = 80; // Low male voice
export const MAX_PITCH_HZ = 600; // High soprano

// Pitch Detection Thresholds
export const MIN_PITCH_HZ_THRESHOLD = 50; // Minimum valid pitch (below this is noise)
export const MIN_ENERGY_FOR_PITCH = 0.05; // Need at least 5% energy to trust pitch

// Noise Gate Configuration
export const NOISE_GATE_THRESHOLD = 0.15; // Ignore anything below 15% (background noise)
export const NOISE_FLOOR_DEFAULT = 0.02; // Default noise floor for energy range
export const SILENCE_THRESHOLD_MULTIPLIER = 1.5; // Add 50% safety margin to noise floor

// Audio Sensitivity
export const MIC_SENSITIVITY_MULTIPLIER = 3.0; // Increase mic sensitivity (1.0 = normal, 3.0 = 3x boost)
export const SMOOTHING_FACTOR = 0.15; // Volume smoothing (lower = smoother, 0.1-0.3 is good range)
export const SIGNAL_THRESHOLD = 0.02; // Minimum RMS for pitch detection (was 0.05, lowered for sensitivity)

// Sculpture Geometry Constants
export const SCULPTURE_BASE_RADIUS = 0.2; // Base radius for additive sculpting
export const SCULPTURE_MAX_RADIUS = 1.5; // Maximum radius (standard block size for subtractive mode)
export const SCULPTURE_MIN_RADIUS = 0.05; // Minimum radius (allows deeper cuts)
export const SCULPTURE_SENSITIVITY = 3.5; // Energy to radius multiplier (amplified from 2.0)

// Geometry Resolution
export const GEOMETRY_MIN_SEGMENTS = 6; // Low poly (hexagonal/blocky)
export const GEOMETRY_MAX_SEGMENTS = 64; // High poly (smooth)
export const GEOMETRY_MAX_POINTS = 200; // Maximum points in lathe curve (high res)

// Recording Mode Resolution (Option B: Song Mode)
export const STANDARD_MODE_RESOLUTION = 128; // Standard mode: 10-30 second recordings
export const SONG_MODE_RESOLUTION = 512; // Song mode: 1-5 minute recordings (4x detail)
export const COIL_MODE_RESOLUTION = 256; // Coil mode: Each coil layer (Option C)

// Timbre Range (Spectral Centroid)
export const TIMBRE_MIN_HZ = 1000; // Typical spectral centroid for silence/breathing
export const TIMBRE_MAX_HZ = 5000; // Typical spectral centroid for harsh sounds (Shhh, Ka!)

// Energy Range Defaults
export const ENERGY_MIN_DEFAULT = 0.05;
export const ENERGY_MAX_DEFAULT = 0.8;

// Pitch Range Defaults
export const PITCH_MIN_DEFAULT = 80;
export const PITCH_MAX_DEFAULT = 400;

// Default Physical Dimensions
export const DEFAULT_HEIGHT_MM = 150; // Default 150mm for mug/small vase

// Visual Feedback Constants
export const LIVE_BRIDGE_AMPLIFICATION = 5.0; // Amplification factor for live breathing effect
export const PITCH_TWIST_NORMALIZATION = 220; // A3 pitch reference for twist normalization
export const PITCH_TWIST_DIVISOR = 1000; // Divisor for pitch twist calculation

// Material Properties
export const PLASTIC_COLOR_LIGHTEN_FACTOR = '#EEEEEE'; // Lightened white for plastic material
export const ERROR_COLOR = '#FF00FF'; // Neon Pink for Missing Glaze/Error State
export const GHOST_OPACITY = 0.15; // Opacity for ghost mesh
export const GHOST_ROUGHNESS = 0.9; // Roughness for ghost mesh

// Geometry Defaults
export const DEFAULT_CYLINDER_RADIUS = 0.5; // Default radius for cylinder fallback
export const DEFAULT_CYLINDER_SEGMENTS = 32; // Default segments for cylinder geometry
export const DEFAULT_ICOSAHEDRON_RADIUS = 0.5; // Default radius for error sphere
export const DEFAULT_ICOSAHEDRON_DETAIL = 2; // Default detail level for error sphere

// Animation and Transitions
export const ORIENTATION_SPRING_STIFFNESS = 0.05; // Spring stiffness for orientation animation
export const ORIENTATION_SPRING_DAMPING = 0.25; // Spring damping for orientation animation
export const RECORDING_IMPLOSION_SCALE = 0.1; // Scale factor when recording with no frames

// Voice Links Constants
export const VOICE_LINK_PITCH_MIN = 80; // Minimum pitch for voice links
export const VOICE_LINK_PITCH_MAX = 400; // Maximum pitch for voice links
export const VOICE_LINK_TIMBRE_SMOOTH_MIN = 1000; // Minimum spectral centroid for smooth sounds
export const VOICE_LINK_TIMBRE_RASPY_MAX = 8000; // Maximum spectral centroid for raspy sounds

// Calibration Defaults
export const CALIBRATION_ATTACK_THRESHOLD_DEFAULT = 0.15; // Default attack threshold
export const CALIBRATION_ATTACK_THRESHOLD_MIN = 0.05; // Minimum attack threshold
export const CALIBRATION_ATTACK_THRESHOLD_MAX = 0.5; // Maximum attack threshold
export const CALIBRATION_ENERGY_DELTA_STDDEV_MULTIPLIER = 2; // Multiplier for std dev in attack threshold

// Geometry Creation Constants (from Sculpture.svelte)
export const GEOMETRY_LATHE_SEGMENTS = 64; // Default segments for LatheGeometry
export const GEOMETRY_RESOLUTION_COMPOSITOR = 128; // Resolution used by compositor for layer data
export const SYMMETRY_DISTORTION_AMPLITUDE = 0.2; // Max distortion amplitude for symmetry effect
export const HEATMAP_STRESS_COLOR_AMPLITUDE = 1.0; // Amplitude scaling for stress colors

// Compositor Frame Rate Limiting (from Sculpture.svelte)
export const COMPOSITOR_TARGET_FPS = 30; // Target FPS for geometry updates (30fps sufficient for smooth sculpture)
export const COMPOSITOR_FRAME_TIME_MS = 1000 / 30; // Pre-calculated frame time in milliseconds

// Voice-Reactive Material Constants (from Sculpture.svelte)
export const VOICE_REACTION_GLOW_MULTIPLIER = 2.0; // Pitch to glow amplification (was 2.0 * 3.0)
export const VOICE_REACTION_GLOW_BASE = 0.1; // Minimum mic level before glow activates
export const EMISSION_SMOOTHING_FACTOR = 0.15; // Exponential smoothing for emission (lower = smoother)
export const VOICE_REACTION_IDLE_PULSE_AMPLITUDE = 0.2; // Amplitude of idle pulsing effect
export const VOICE_REACTION_IDLE_PULSE_BASE = 0.2; // Base level for idle pulse

// Force Mode Constants (from Sculpture.svelte)
export const FORCE_MODE_PITCH_MIN_HZ = 80; // Minimum pitch for force mode target
export const FORCE_MODE_PITCH_MAX_HZ = 800; // Maximum pitch for force mode target
export const FORCE_MODE_MIC_LEVEL_THRESHOLD = 0.05; // Minimum mic level to show force target
export const FORCE_MODE_FALLBACK_RADIUS = 0.5; // Fallback radius when geometry sampling fails

// =============================================================================
// AUDIT FIX: Extracted Magic Numbers
// =============================================================================

// Physics Mapping Constants
export const BEAT_DECAY_TIME_MS = 300; // How long beat effect lasts
export const DEFAULT_PITCH_A4_HZ = 440; // A4 reference pitch
export const PITCH_RANGE_HZ = 720; // Pitch normalization range (was MAX - MIN)
export const TIMBRE_NOISE_AMPLITUDE = 0.3; // Amplified timbre noise (was 0.15)
export const PITCH_JITTER_AMPLITUDE = 0.25; // Amplified pitch ripple (was 0.1)
export const QUANTIZE_STEP = 0.15; // 15% increments for Lego filter (~7 distinct levels)
export const TIMBRE_NORMALIZATION_HZ = 5000; // Timbre normalization divisor
export const PHYSICS_LOG_INTERVAL_MS = 3000; // Rate limit for physics logging

// Glaze Generation Constants
export const GLAZE_MAX_POINTS = 200; // Maximum points for glaze color generation
export const GLAZE_PITCH_HUE_MAX = 280; // 0° (red) to 280° (purple) hue range
export const GLAZE_SATURATION_BASE = 0.5; // Base saturation (50%)
export const GLAZE_SATURATION_RANGE = 0.5; // Saturation range added by energy

// Ceramic Material PBR Constants (from materialFactory.ts)
export const CERAMIC_DEFAULT_ROUGHNESS = 0.35; // Semi-matte ceramic body
export const CERAMIC_CLEARCOAT = 0.9; // Base clearcoat for glossy glazes
export const CERAMIC_CLEARCOAT_ROUGHNESS = 0.15; // Slightly textured glaze
export const CERAMIC_SHEEN = 0.3; // Subtle ceramic sheen
export const CERAMIC_SHEEN_ROUGHNESS = 0.4; // Sheen roughness
export const CERAMIC_SHEEN_COLOR = '#E8DCC8'; // Warm ceramic undertone
export const CERAMIC_IOR = 1.52; // Glass-like index of refraction for glaze
export const CERAMIC_THICKNESS = 0.5; // Subsurface scatter distance
export const CERAMIC_ENV_MAP_INTENSITY = 1.2; // Environment reflection strength
export const CERAMIC_ATTENUATION_COLOR = '#D4C4A8'; // Warm clay shows through
export const CERAMIC_ATTENUATION_DISTANCE = 0.5; // Attenuation distance

// Energy/Dazzler Material Constants
export const ENERGY_MATERIAL_BASE_COLOR = '#111111'; // Dark charcoal base
export const ENERGY_MATERIAL_ROUGHNESS = 0.8; // Matte to prevent reflection interference

// Fabrication Constraint Constants
export const CONSTRAINT_DIFF_THRESHOLD = 0.001; // Threshold for detecting constraint changes
export const CERAMIC_MIN_HAND_RADIUS = 0.2; // ~24mm radius for finger access
export const CERAMIC_MAX_OVERHANG_ANGLE = 45; // Maximum outward overhang (degrees)
export const CERAMIC_BASE_STABILITY_RATIO = 1.2; // Base should be 1.2x wider than average
export const CERAMIC_TOP_EXEMPT_THRESHOLD = 0.95; // Top 5% exempt from min radius (rim)
export const CERAMIC_CRITICAL_MIN_RADIUS = 0.05; // Absolute minimum to prevent degenerate geometry
export const CERAMIC_SMOOTH_WINDOW = 7; // SMA window size for clay smoothing
export const CERAMIC_BASE_HEIGHT_THRESHOLD = 0.1; // Bottom 10% is base zone

// 3D Print Constraint Constants
export const PRINT_3D_MAX_OVERHANG_ANGLE = 60; // FDM typical max overhang (degrees)
export const PRINT_3D_MIN_RADIUS = 0.001; // 1mm minimum to prevent zero-radius gaps
export const PRINT_3D_STEEP_INWARD_ANGLE = 75; // Allow steep inward slopes (degrees)
export const PRINT_3D_FIRST_LAYER_MIN_RADIUS = 0.01; // 10mm minimum first layer for adhesion

// Compositor Constants
export const COMPOSITOR_MIN_RADIUS = 0.01; // Minimum radius constraint in compositor
export const COMPOSITOR_LOG_INTERVAL_MS = 2000; // Rate limit for compositor logging
export const COMPOSITOR_DEFAULT_RESOLUTION = 128; // Default resolution if not specified

// Dynamic Geometry Manager Constants
export const NORMAL_LENGTH_THRESHOLD = 0.0001; // Minimum normal length before normalization

// High-Res Export Constants
export const EXPORT_SEGMENTS_HIGH = 128; // 4x higher than preview (32)
export const EXPORT_SUPER_SAMPLE_FACTOR = 2; // 2x super-sampling for AA
export const EXPORT_TONE_MAPPING_EXPOSURE = 1.2; // ACES tone mapping exposure
