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
