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

