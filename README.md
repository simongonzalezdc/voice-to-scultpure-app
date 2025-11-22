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

## License

MIT
