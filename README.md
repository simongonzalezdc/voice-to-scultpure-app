# Voice-to-Sculpture Studio

Transform your voice into beautiful 3D sculptures using real-time audio analysis and AI-powered modifications.

## Features

- 🎤 Real-time voice capture and analysis
- 🎨 3D sculpture generation from audio features
- 🤖 AI-powered sculpture modifications (Cloud & Local)
- 💾 Project persistence with OPFS
- 📤 Export to PNG, SVG, and WAV

## Tech Stack

- **Framework:** SvelteKit (TypeScript)
- **3D Engine:** Threlte v9 + Three.js
- **Audio:** Web Audio API (AudioWorklet)
- **AI:** OpenAI API & @mlc-ai/web-llm (WebGPU)
- **Storage:** OPFS (Origin Private File System)

## Prerequisites

- **Supported browsers:** Chrome/Edge (recommended for WebGPU), Firefox (full support), Safari (limited because SharedArrayBuffer is unavailable).
- **Platform capabilities:** WebGPU is recommended for local AI acceleration (falls back to WebGL when unavailable). Web Audio API access (with microphone permission) and OPFS support are required for recording and persistent storage.
- **Playwright browsers:** Install bundled browsers for end-to-end tests with `npx playwright install`.
- **AI/ML backends:** Provide a cloud API key via the in-app Settings panel when using the cloud provider. No build-time feature flags or environment variables are required; optional API endpoint overrides can also be set in Settings.

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Type check
npm run check
```

## Browser Support

- Chrome/Edge (recommended) - Full support
- Firefox - Full support
- Safari - Limited (no SharedArrayBuffer support)

## Requirements

- COOP/COEP headers for SharedArrayBuffer
- WebGPU for local AI (optional, falls back to WebGL)
- Microphone permissions

## Troubleshooting

- **Headless runs:** When running Playwright or browser automation in CI, ensure `npx playwright install` has been executed so Chromium/Firefox/WebKit binaries are available. Supply `--headless=new` for modern headless mode and include the required COOP/COEP headers in your server configuration.
- **Audio permissions:** If microphone capture fails, verify the browser has microphone access and that the page is served over HTTPS (or localhost). Clear blocked permission states and refresh, then restart recording.

## License

MIT
