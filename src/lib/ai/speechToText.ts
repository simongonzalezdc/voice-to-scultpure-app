/**
 * Speech-to-Text Service
 *
 * Uses the Web Speech API for browser-native voice recognition.
 * Falls back to OpenAI Whisper API if available and preferred.
 */

export interface SpeechToTextOptions {
	continuous?: boolean;
	interimResults?: boolean;
	lang?: string;
	onResult?: (text: string, isFinal: boolean) => void;
	onError?: (error: string) => void;
	onEnd?: () => void;
}

export interface SpeechToTextService {
	start(): void;
	stop(): void;
	isListening(): boolean;
	isSupported(): boolean;
}

// Type declarations for Web Speech API (not fully typed in TypeScript)
interface SpeechRecognitionResult {
	readonly isFinal: boolean;
	readonly length: number;
	item(index: number): SpeechRecognitionAlternative;
	[index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
	readonly transcript: string;
	readonly confidence: number;
}

interface SpeechRecognitionResultList {
	readonly length: number;
	item(index: number): SpeechRecognitionResult;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventInit extends EventInit {
	results?: SpeechRecognitionResultList;
}

interface WebSpeechRecognitionEvent extends Event {
	readonly results: SpeechRecognitionResultList;
}

interface WebSpeechRecognitionErrorEvent extends Event {
	readonly error: string;
}

interface WebSpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
	onerror: ((event: WebSpeechRecognitionErrorEvent) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
}

/**
 * Browser-native Speech Recognition using Web Speech API
 */
export function createBrowserSpeechToText(options: SpeechToTextOptions = {}): SpeechToTextService {
	const {
		continuous = true,
		interimResults = true,
		lang = 'en-US',
		onResult,
		onError,
		onEnd
	} = options;

	let recognition: WebSpeechRecognition | null = null;
	let listening = false;

	// Check if supported
	const SpeechRecognitionConstructor =
		(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
	const supported = !!SpeechRecognitionConstructor;

	if (supported) {
		recognition = new SpeechRecognitionConstructor() as WebSpeechRecognition;
		recognition.continuous = continuous;
		recognition.interimResults = interimResults;
		recognition.lang = lang;

		recognition.onresult = (event: WebSpeechRecognitionEvent) => {
			const results = event.results;
			const lastResult = results[results.length - 1];
			if (lastResult) {
				const transcript = lastResult[0]?.transcript ?? '';
				const isFinal = lastResult.isFinal;
				onResult?.(transcript, isFinal);
			}
		};

		recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
			console.error('[SPEECH] Recognition error:', event.error);
			onError?.(event.error);
		};

		recognition.onend = () => {
			listening = false;
			onEnd?.();
		};
	}

	return {
		start() {
			if (!recognition) {
				onError?.('Speech recognition not supported');
				return;
			}
			try {
				recognition.start();
				listening = true;
				console.log('[SPEECH] Started listening...');
			} catch (e) {
				// Already started or permission denied
				console.warn('[SPEECH] Could not start:', e);
			}
		},

		stop() {
			if (recognition && listening) {
				recognition.stop();
				listening = false;
				console.log('[SPEECH] Stopped listening');
			}
		},

		isListening() {
			return listening;
		},

		isSupported() {
			return supported;
		}
	};
}

/**
 * OpenAI Whisper API Speech-to-Text
 * For higher accuracy transcription
 */
export async function transcribeWithWhisper(audioBlob: Blob, apiKey: string): Promise<string> {
	const formData = new FormData();
	formData.append('file', audioBlob, 'audio.webm');
	formData.append('model', 'whisper-1');
	formData.append('language', 'en');
	formData.append('response_format', 'text');

	// Add sculpture-specific context prompt
	formData.append(
		'prompt',
		'Transcribing voice commands for 3D sculpture: twist, taper, compress, glaze, color, sculpt, force, layer, height, smooth, rough, ceramic, plastic.'
	);

	const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`
		},
		body: formData
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Whisper API error: ${error}`);
	}

	return response.text();
}

/**
 * Check if Web Speech API is available
 */
export function isSpeechRecognitionSupported(): boolean {
	return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/**
 * Predefined sculpture command patterns for better recognition
 */
export const SCULPTURE_COMMAND_HINTS = [
	// Deformation
	'twist',
	'more twist',
	'less twist',
	'no twist',
	'compress',
	'compression',
	'squish',
	'flatten',
	'taper',
	'narrow',
	'widen',

	// Colors
	'red',
	'blue',
	'green',
	'yellow',
	'orange',
	'purple',
	'pink',
	'white',
	'black',
	'gray',
	'gold',
	'silver',
	'bronze',
	'ocean blue',
	'forest green',
	'sunset orange',

	// Materials
	'ceramic',
	'plastic',
	'metal',
	'glass',
	'matte',
	'glossy',
	'shiny',
	'rough',
	'smooth',

	// Shapes
	'taller',
	'shorter',
	'wider',
	'thinner',
	'bigger',
	'smaller',
	'vase',
	'bowl',
	'cup',
	'cylinder',
	'sphere',

	// Actions
	'record',
	'stop',
	'undo',
	'reset',
	'export',
	'save',

	// Modes
	'sculpt mode',
	'glaze mode',
	'force mode',
	'export mode',

	// Layers
	'add layer',
	'remove layer',
	'new layer',
	'delete layer',

	// View
	'zoom in',
	'zoom out',
	'wireframe',
	'x-ray',
	'standard view'
];
