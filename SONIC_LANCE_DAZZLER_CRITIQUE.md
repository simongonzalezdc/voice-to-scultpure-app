# ⚡ Sonic Lance, Dazzler & Ribbons - Critical Analysis & Improvements

**Reviewed by:** Apex Engineering Lead  
**Date:** November 2025  
**Status:** Deep Dive Analysis with Song Mode Integration

---

## Executive Summary

The spec proposes four powerful features that would significantly enhance the creative toolkit. However, several architectural and UX concerns need addressing before implementation. This document provides:

1. **Feature-by-feature critique** with risk assessment
2. **Song Mode integration** opportunities
3. **AI service expansion** to multi-provider architecture
4. **Priority-adjusted implementation plan**

---

## 1. 🗡️ Sonic Lance - CRITIQUE

### ✅ What Works Well
- **Clear UX distinction** between Brush (soft, additive) vs Lance (precise, subtractive)
- **Locked parameters** prevent accidental soft cuts (hardness=1.0 is correct)
- **Visual differentiation** (cyan vs standard) aids mode awareness

### ⚠️ Issues & Concerns

#### Issue 1: "Always Subtractive" is Too Restrictive
**Problem:** Locking to subtractive-only limits creative expression. What if users want to *add* fine detail (like embossing)?

**Improvement:**
```typescript
// Instead of forcing subtractive, offer TWO lance modes:
forceParams: {
    toolType: 'brush' | 'lance-carve' | 'lance-engrave';
}
// lance-carve: Always subtract (drilling, cutting)
// lance-engrave: Always add (embossing, raised detail)
```

#### Issue 2: Volume → Cut Depth Creates Unpredictable Results
**Problem:** Louder voice = deeper cuts sounds intuitive, but in practice, vocal volume fluctuates wildly. Users will accidentally gouge too deep when enthusiastically singing.

**Improvement:** Use **pitch** for depth instead:
- **High pitch** → shallow, surface scratches
- **Low pitch** → deep, structural cuts
- **Volume** → confirms/triggers the cut (threshold gate)

This is more controllable because:
1. Pitch is consciously chosen (you decide what note to sing)
2. Volume is often involuntary (room noise, breathing, etc.)

#### Issue 3: Missing "Preview Mode"
**Problem:** Users can't see where they're about to cut before committing.

**Improvement:** Add a **Ghost Line** preview:
```typescript
// In Sculpture.svelte, show a translucent cylinder at intersection point
// when Lance is selected but mic is below threshold
if (toolType.includes('lance') && micLevel < 0.1) {
    showLancePreview(intersectionPoint, lanceRadius);
}
```

### 🎵 Song Mode Integration

**Opportunity:** Link Lance activation to **formant detection**!

| Phoneme Type | Formant Signature | Lance Behavior |
|--------------|-------------------|----------------|
| Fricatives (S, F, SH) | High F2, noisy spectrum | **Auto-activate Lance** |
| Plosives (P, T, K) | Energy spike, short burst | **Single punch cut** |
| Vowels (A, E, O) | Clear F1/F2 | Return to Brush mode |

**Implementation:**
```typescript
// In songModeController.ts
function processFormant(): void {
    const { f1, f2 } = latestFrame.formant;
    
    // Detect fricatives (high frequency, noisy)
    const isFricative = f2 > 2200 && analysisStore.latestFrame.timbre.zcr > 0.4;
    
    if (songModeStore.layers.phonetic && isFricative) {
        // Auto-switch to Lance mode during S/SH sounds
        uiStore.forceParams.toolType = 'lance-carve';
    } else {
        uiStore.forceParams.toolType = 'brush';
    }
}
```

**Result:** Singing "Ssssserpent" naturally carves a snake-like groove, while "Ooooooh" smooths and shapes.

---

## 2. 💡 Dazzler Effect (Energy Material) - CRITIQUE

### ✅ What Works Well
- **Reactive emissive** is visually stunning and provides instant feedback
- **Dark base + glow** prevents visual overload
- **Bloom threshold adjustment** shows understanding of HDR pipeline

### ⚠️ Issues & Concerns

#### Issue 1: Single "Energy" Mode is Too Binary
**Problem:** Users might want *some* glow without going full neon.

**Improvement:** Replace binary mode with a **Glow Intensity** slider:
```typescript
activeGlaze: {
    // ... existing
    emissiveEnabled: boolean;       // Master toggle
    emissiveBase: number;           // 0-1, always-on glow
    emissiveReactivity: number;     // 0-1, how much voice adds
}
```

This allows:
- `emissiveBase: 0.2, emissiveReactivity: 0` → Subtle constant glow (ceramic with inner light)
- `emissiveBase: 0, emissiveReactivity: 1` → Full Dazzler mode
- `emissiveBase: 0.5, emissiveReactivity: 0.5` → Hybrid (ambient + reactive)

#### Issue 2: Missing Glow Color Control
**Problem:** Spec assumes glow color = glaze color. But what if users want blue glaze with orange glow (like lava under ice)?

**Improvement:**
```typescript
activeGlaze: {
    color: string;           // Surface color
    emissiveColor: string;   // Glow color (defaults to `color` if not set)
}
```

#### Issue 3: Performance Concern - Bloom Threshold
**Problem:** Threshold `0.8 → 1.5` is mentioned but not explained. Too low = everything glows. Too high = nothing glows.

**Improvement:** Make it **adaptive**:
```typescript
// In PostProcessing.svelte
const bloomThreshold = $derived.by(() => {
    const hasEnergyMaterial = uiStore.activeGlaze.emissiveEnabled;
    const avgSceneIntensity = calculateAverageSceneIntensity(); // Sample HDR buffer
    
    // Adaptive threshold: higher when energy mode active
    return hasEnergyMaterial ? 1.2 : 0.8;
});
```

### 🎵 Song Mode Integration

**Opportunity:** Link emissive to **sentiment energy** from lyrics!

```typescript
// In songModeController.ts → applySentimentToGlaze
function applySentimentToGlaze(sentiment: SentimentScore): void {
    const hsl = sentimentToColor(sentiment);
    
    // Existing: Color from valence
    uiStore.activeGlaze.color = hslToHex(hsl.h, hsl.s, hsl.l);
    
    // NEW: Emissive intensity from energy
    if (uiStore.activeGlaze.emissiveEnabled) {
        // Energy: -1 (calm) to +1 (intense)
        // Map to emissive: 0 (no glow) to 1.5 (overdrive glow)
        const glowIntensity = (sentiment.energy + 1) * 0.75;
        uiStore.activeGlaze.emissiveIntensity = glowIntensity;
        
        // Shift emissive color toward white when very energetic
        if (sentiment.energy > 0.7) {
            uiStore.activeGlaze.emissiveColor = '#FFFFDD'; // Hot white
        }
    }
}
```

**Result:** Calm lyrics → subtle glow. "BURN IT DOWN!" → white-hot bloom explosion.

---

## 3. 〰️ Solid Sound Ribbons - CRITIQUE

### ✅ What Works Well
- **Paradigm shift** from pottery metaphor opens new creative territory
- **Pitch → X steering** is intuitive (high notes = up/right, low = down/left)
- **Time → Y extrusion** maintains the "voice draws shape" concept
- **Separate geometry manager** is architecturally correct

### ⚠️ Issues & Concerns

#### Issue 1: Pitch → X Can Cause Extreme Oscillation
**Problem:** Human pitch naturally warbles. Without smoothing, the ribbon will zigzag wildly.

**Improvement:** Heavy smoothing + dead zone:
```typescript
// In RibbonGeometryManager.ts
const PITCH_SMOOTHING = 0.92;  // High smoothing
const PITCH_DEAD_ZONE = 50;    // Hz - ignore small variations

let smoothedPitch = currentPitch;

function updatePitch(rawPitch: number): number {
    const diff = Math.abs(rawPitch - smoothedPitch);
    
    // Only update if pitch changed significantly
    if (diff > PITCH_DEAD_ZONE) {
        smoothedPitch = lerp(smoothedPitch, rawPitch, 1 - PITCH_SMOOTHING);
    }
    
    return smoothedPitch;
}
```

#### Issue 2: No Z-Depth Creates Flat Ribbons
**Problem:** Spec only uses X (pitch) and Y (time). The result is a flat ribbon (like a waveform) with no depth.

**Improvement:** Add **Timbre → Z depth**:
```typescript
// Ribbon vertices now use all 3 axes
const x = mapPitchToX(pitch);
const y = height; // Time
const z = mapTimbreToZ(spectralCentroid); // NEW: Brightness → depth

// Creates 3D ribbons that curve toward/away from camera based on timbre
```

**Visual Result:** Bright sounds (high spectral centroid) push the ribbon toward the viewer. Dark sounds recede. The ribbon gains actual 3D presence.

#### Issue 3: Missing Ribbon-Specific Export Considerations
**Problem:** Ribbons are fundamentally different from lathe geometry. STL export needs thickness, but ribbons are surfaces.

**Improvement:** Auto-thicken for export:
```typescript
// In stl.ts
function exportRibbon(geometry: BufferGeometry, targetThickness: number): Blob {
    // Duplicate ribbon surface, offset by thickness, create walls
    const thickenedGeometry = thickenRibbonForFabrication(geometry, targetThickness);
    return generateSTL(thickenedGeometry);
}
```

### 🎵 Song Mode Integration (CRITICAL!)

**Ribbons ARE Song Mode.** The lathe metaphor assumes short, cyclical vocalizations (like turning pottery). But songs are **linear narratives**.

**Ribbon Mode should AUTO-ACTIVATE when Song Mode is enabled:**

```typescript
// In songModeController.ts → startSongMode()
export function startSongMode(): void {
    // ...existing code...
    
    // Auto-switch to Ribbon geometry for songs
    if (uiStore.baseShape !== 'ribbon') {
        console.log('🎵 [SONG CTRL] Auto-switching to Ribbon mode for song recording');
        uiStore.baseShape = 'ribbon';
    }
}

export function stopSongMode(): void {
    // ...existing code...
    
    // Optionally restore lathe mode
    // uiStore.baseShape = 'lathe';
}
```

**Result:** When you start Song Mode, the app automatically knows you're about to create a long-form piece and switches to the appropriate geometry engine.

---

## 4. 👁️ POV Acoustic Projection - CRITIQUE

### ✅ What Works Well
- **Reinforces "voice as tool"** metaphor brilliantly
- **Mode-reactive visuals** (Brush = spherical waves, Lance = conical beam) are smart
- **Camera-parented** is the correct approach for POV effects

### ⚠️ Issues & Concerns

#### Issue 1: Could Occlude the Sculpture
**Problem:** Spec mentions fading near target, but "near" is vague. Waves might obscure important sculpting feedback.

**Improvement:** Use **inverse depth fade**:
```typescript
// In VoiceProjector shader
uniform float uSculptureDistance; // Distance from camera to sculpture center

void main() {
    float distanceToCamera = length(vWorldPosition - cameraPosition);
    
    // Fade out as we approach the sculpture
    float occlusionFade = smoothstep(0.0, uSculptureDistance * 0.5, distanceToCamera);
    
    // Also fade based on proximity to center of screen (don't block focal point)
    vec2 screenPos = gl_FragCoord.xy / resolution.xy;
    float centerFade = length(screenPos - 0.5) * 2.0; // 0 at center, 1 at edges
    
    gl_FragColor.a *= occlusionFade * max(0.3, centerFade);
}
```

#### Issue 2: Performance Overhead
**Problem:** Instanced meshes spawned every frame at high audio rates will thrash the GPU.

**Improvement:** Object pooling + decay:
```typescript
// VoiceProjector.ts
const WAVE_POOL_SIZE = 50;
const wavePool: THREE.InstancedMesh = createWavePool(WAVE_POOL_SIZE);

let waveIndex = 0;

function spawnWave(energy: number, pitch: number): void {
    // Reuse existing instance instead of creating new
    const matrix = new THREE.Matrix4();
    matrix.setPosition(cameraPosition);
    matrix.scale(new THREE.Vector3(energy, energy, energy));
    
    wavePool.setMatrixAt(waveIndex, matrix);
    wavePool.instanceMatrix.needsUpdate = true;
    
    waveIndex = (waveIndex + 1) % WAVE_POOL_SIZE;
}
```

#### Issue 3: Accessibility Concern
**Problem:** Bright, fast-moving visuals near the camera can trigger photosensitivity issues.

**Improvement:** Add a toggle and intensity control:
```typescript
uiStore.visualFeedback = {
    voiceProjection: 'full' | 'subtle' | 'off';
    motionIntensity: number; // 0-1
}
```

### 🎵 Song Mode Integration

**Opportunity:** Voice projector can visualize **lyrics in real-time**!

When Speech-to-Text captures a word, briefly flash the word as 3D text traveling along the voice stream:

```typescript
// In songModeController.ts
speechService = createBrowserSpeechToText({
    onResult: (text, isFinal) => {
        if (isFinal) {
            addLyricPhrase(text.trim());
        }
        
        // NEW: Show interim words in voice stream
        if (!isFinal && text.trim()) {
            voiceProjector.flashWord(text.trim());
        }
    }
});
```

**Result:** As you sing, words physically fly from you toward the sculpture, creating a visual connection between voice and form.

---

## 5. 🤖 AI Service Expansion

### Current State
The `songModeAI.ts` is **hardcoded to OpenAI** and doesn't use the existing `MultiProviderAdapter`. This is a critical architectural debt.

### Problem Analysis

```typescript
// Current: Direct OpenAI call (BAD)
const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { Authorization: `Bearer ${apiKey}` }
});
```

This should use the multi-provider system already built in `MultiProviderAdapter.ts`.

### Proposed Fix: Unify AI Calls

#### Step 1: Add Missing Providers to `providers.ts`

```typescript
// Add to PROVIDER_CONFIGS in providers.ts

ollama: {
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/api',  // Default Ollama port
    authHeader: '',  // No auth for local
    authPrefix: '',
    keyFormat: '',   // No key needed
    models: [
        {
            id: 'llama3.2:3b',
            name: 'Llama 3.2 3B',
            contextWindow: 4096,
            maxOutput: 4096,
            supportsJson: true,
            cost: 'free'
        },
        {
            id: 'llama3.1:8b',
            name: 'Llama 3.1 8B',
            contextWindow: 8192,
            maxOutput: 4096,
            supportsJson: true,
            cost: 'free'
        },
        {
            id: 'mistral:7b',
            name: 'Mistral 7B',
            contextWindow: 8192,
            maxOutput: 4096,
            supportsJson: true,
            cost: 'free'
        },
        {
            id: 'phi3:mini',
            name: 'Phi-3 Mini',
            contextWindow: 4096,
            maxOutput: 2048,
            supportsJson: true,
            cost: 'free'
        }
    ]
},

together: {
    name: 'Together.ai',
    baseUrl: 'https://api.together.xyz/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    keyFormat: '^[a-f0-9]{64}$',
    models: [
        {
            id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
            name: 'Llama 3.3 70B Turbo',
            contextWindow: 131072,
            maxOutput: 4096,
            supportsJson: true,
            cost: 'low'
        },
        {
            id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
            name: 'Mixtral 8x7B',
            contextWindow: 32768,
            maxOutput: 4096,
            supportsJson: true,
            cost: 'low'
        },
        {
            id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
            name: 'Qwen 2.5 72B',
            contextWindow: 32768,
            maxOutput: 4096,
            supportsJson: true,
            cost: 'low'
        }
    ]
},

deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    keyFormat: '^sk-[a-zA-Z0-9]+$',
    models: [
        {
            id: 'deepseek-chat',
            name: 'DeepSeek Chat',
            contextWindow: 64000,
            maxOutput: 4096,
            supportsJson: true,
            cost: 'low'
        },
        {
            id: 'deepseek-coder',
            name: 'DeepSeek Coder',
            contextWindow: 64000,
            maxOutput: 4096,
            supportsJson: true,
            cost: 'low'
        }
    ]
}
```

#### Step 2: Add Ollama Handler to `MultiProviderAdapter.ts`

```typescript
// Add to callProvider switch statement

case 'ollama':
    ({ response, content } = await callOllama(
        config,
        messages,
        '', // No API key
        model,
        temperature,
        maxTokens
    ));
    break;

// New function
async function callOllama(
    config: ProviderConfig,
    messages: AIMessage[],
    _apiKey: string, // Ignored for local
    model: string,
    temperature: number,
    maxTokens: number
): Promise<{ response: Response; content: string }> {
    // Ollama uses different endpoint structure
    const response = await fetch(`${config.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content
            })),
            stream: false,
            options: {
                temperature,
                num_predict: maxTokens
            }
        })
    });

    const data = await response.json();
    return { response, content: data.message?.content || '' };
}
```

#### Step 3: Refactor `songModeAI.ts` to Use Multi-Provider

```typescript
// Replace the hardcoded callAI function with:

import { callProvider } from './MultiProviderAdapter';
import { appSettings } from '$lib/stores/appSettingsStore.svelte';

async function callAI(prompt: string, lyrics: string): Promise<AIResponse> {
    const provider = appSettings.cloudProvider || 'openai';
    const apiKey = appSettings.apiKeys?.[provider] || appSettings.aiApiKey;
    const model = appSettings.selectedModel || getDefaultModelForProvider(provider);

    if (!apiKey && provider !== 'ollama') {
        return { success: false, error: 'No API key configured' };
    }

    try {
        const result = await callProvider(
            [
                { role: 'system', content: prompt },
                { role: 'user', content: `Lyrics: "${lyrics}"` }
            ],
            {
                provider,
                apiKey,
                model,
                temperature: 0.3,
                maxTokens: 150
            }
        );

        // Parse JSON from response
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { success: false, error: 'No JSON in response' };
        }

        const data = JSON.parse(jsonMatch[0]);
        return { success: true, data };
    } catch (error) {
        return { success: false, error: `Request failed: ${error}` };
    }
}

function getDefaultModelForProvider(provider: CloudProvider): string {
    const models = {
        openai: 'gpt-4o-mini',
        anthropic: 'claude-3-haiku-20240307',
        google: 'gemini-1.5-flash',
        groq: 'llama-3.1-8b-instant',
        openrouter: 'meta-llama/llama-3.3-70b-instruct',
        ollama: 'llama3.2:3b',
        together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        deepseek: 'deepseek-chat'
    };
    return models[provider] || 'gpt-4o-mini';
}
```

### Provider Comparison Matrix

| Provider | Speed | Cost | Privacy | Best For |
|----------|-------|------|---------|----------|
| **OpenAI** | Fast | Medium | Cloud | Accuracy |
| **Anthropic** | Fast | Medium | Cloud | Nuance |
| **Groq** | ⚡ Blazing | Low | Cloud | Real-time |
| **OpenRouter** | Varies | Varies | Cloud | Model variety |
| **Together.ai** | Fast | Low | Cloud | Budget |
| **DeepSeek** | Fast | Very Low | Cloud | Value |
| **Ollama** | Varies | Free | ✅ Local | Privacy |
| **Local (WebLLM)** | Slow | Free | ✅ Local | Offline |

### Recommended Default: **Groq**
For Song Mode's real-time sentiment analysis, Groq's sub-100ms inference is ideal. It's also free-tier friendly.

---

## 6. 📋 Revised Implementation Priority

### Phase 1: Foundation (Week 1) ✅ IMPLEMENTED
| Task | Priority | Effort | Risk | Status |
|------|----------|--------|------|--------|
| Add Ollama + Together.ai providers | High | 2h | Low | ✅ Done |
| Refactor `songModeAI.ts` to MultiProvider | High | 1h | Low | ✅ Done |
| Add emissive controls to Glaze | High | 2h | Low | ✅ Done |

### Phase 2: Dazzler + Lance (Week 2) ✅ IMPLEMENTED
| Task | Priority | Effort | Risk | Status |
|------|----------|--------|------|--------|
| Implement Energy material with reactivity | High | 3h | Medium | ✅ Done |
| Lance tool with preview | Medium | 4h | Medium | ✅ Done |
| Phonetic Lance trigger (Song Mode) | Low | 2h | Low | ✅ Done |

### Phase 3: Ribbon Architecture (Week 3-4)
| Task | Priority | Effort | Risk |
|------|----------|--------|------|
| Create `RibbonGeometryManager.ts` | High | 8h | High |
| Add pitch smoothing + Z-depth | Medium | 3h | Medium |
| Ribbon ↔ Song Mode auto-link | Medium | 1h | Low |
| Ribbon export with thickening | Medium | 4h | Medium |

### Phase 4: Voice Projector (Week 5)
| Task | Priority | Effort | Risk |
|------|----------|--------|------|
| Basic wave particles | Medium | 4h | Medium |
| Accessibility controls | Medium | 1h | Low |
| Word flash integration | Low | 3h | Low |

---

## 7. Summary: Go/No-Go Assessment

| Feature | Verdict | Reason |
|---------|---------|--------|
| **Sonic Lance** | ✅ GO (with fixes) | Adds meaningful tool diversity |
| **Dazzler Effect** | ✅ GO (enhanced) | High visual impact, low risk |
| **Sound Ribbons** | ✅ GO (phased) | Essential for Song Mode, but high effort |
| **Voice Projector** | ⚠️ DEFER | Nice-to-have, low priority vs. core features |
| **AI Expansion** | ✅ CRITICAL | Unify architecture, add Ollama/Together |

---

*Document prepared by Apex Engineering Lead. All recommendations follow the Single Source of Truth, Radical Observability, and Non-Destructive Workflow principles.*

