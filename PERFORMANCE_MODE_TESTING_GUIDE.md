# Performance Mode - Testing Guide

## How to Access

1. **Open the app** - You should see the main studio interface
2. **Look in the header** (top right) for a new gradient button:
   ```
   ✨ Performance Mode
   ```
3. **Click it** to launch the Performance Wizard

---

## Expected Behavior

### Step 1: The Body (Base Layer)
- **Icon:** 🏺
- **Instruction:** "Sing a long, steady note to define the shape"
- **What to do:** Sing "Ahhhh" for 5-10 seconds
- **Expected result:** Base layer created, cylinder/vase shape visible

### Step 2: The Pulse (Rhythm Layer)
- **Icon:** 🥁
- **Instruction:** "Make percussive sounds to add ribs or pulses"
- **What to do:** Make beat-box sounds "Ka-Ka-Ka" or "Ts-Ts-Ts"
- **Expected result:** 
  - Beats detected (console shows `🥁 [BEAT] Detected!`)
  - Visible ribs/pulses added to geometry

### Step 3: The Surface (Texture Layer)
- **Icon:** 🌊
- **Instruction:** "Whisper or growl to add texture"
- **What to do:** Whisper, growl, or make gritty vocal sounds
- **Expected result:** Surface roughness added

### Step 4: The Glaze (Color Layer)
- **Icon:** 🎨
- **Instruction:** "Sing a melody to paint"
- **What to do:** Sing C-D-E-F-G (or any melody)
- **Expected result:** Colors follow musical scale, harmonious palette

---

## Testing the Layer System

### Test 1: Layer Undo
1. Complete Step 1 (Base Layer)
2. Complete Step 2 (Rhythm Layer)
3. Click **"Undo Layer"**
4. **Expected:** Rhythm layer removed, back to smooth base

### Test 2: Layer Composition
1. Complete all 4 steps
2. **Expected:** Final sculpture combines:
   - Base shape (smooth)
   - Rhythmic ribs (beats)
   - Surface texture (roughness)
   - Musical colors (harmonized hues)

### Test 3: Multiple Recordings
1. Complete Step 1
2. Click **"Undo Layer"**
3. Record Step 1 again with different voice
4. **Expected:** New base replaces old one

---

## Console Output to Watch For

### Beat Detection
```
🥁 [BEAT] Detected! Energy: 0.823 vs Avg: 0.421 (threshold: 0.632)
```

### Layer Management
```
✨ [LAYER] Added base layer: Step 1: The Body
✨ [LAYER] Added distortion layer: Step 2: The Pulse
🗑️ [LAYER] Removed distortion layer: Step 2: The Pulse
```

### Harmonic Quantization
```
🎵 [PITCH] ✓ 220.0Hz detected (correlation: 0.892)
```

---

## Visual Indicators

### Recording Status
- **Idle:** Gray dot + "Ready"
- **Recording:** Red pulsing dot + "Recording..."
- **Processing:** Yellow pulsing dot + "Processing"

### Mic Level Meter
- Blue gradient bar shows current mic input
- Should animate when speaking/singing

### Pitch Display
- Shows detected Hz when singing
- Hidden when no pitch detected

---

## Troubleshooting

### Issue: No Beat Detection
- **Cause:** Sounds too quiet or not percussive enough
- **Fix:** Make sharper, louder sounds (Ka! Ka! Ka!)
- **Console check:** Look for energy spike messages

### Issue: No Pitch Detection
- **Cause:** Voice too quiet or notes too short
- **Fix:** Sing louder and hold notes longer (2+ seconds)
- **Console check:** Look for `[PITCH] ✓` messages

### Issue: Undo Doesn't Work
- **Cause:** No layers recorded yet
- **Fix:** Complete at least one step before undoing
- **Console check:** `⚠️ Layer not found`

### Issue: Colors Look Random
- **Cause:** Pitch detection failing, using fallback
- **Fix:** Sing clearer pitches in vocal range (80-800 Hz)
- **Console check:** Watch for detected frequencies

---

## Success Criteria

✅ **Layer System Working:**
- Can record 4 different layers
- Can undo specific layers without affecting others
- Final geometry is smooth blend of all layers

✅ **Beat Detection Working:**
- Console shows beat messages
- Visible ribs/pulses appear on percussive sounds
- ~150ms cooldown prevents double-triggering

✅ **Harmonic Quantizer Working:**
- Pitches snap to musical scale
- Colors look harmonious (not random/jarring)
- Console shows quantized frequencies

✅ **UI/UX Smooth:**
- Wizard guides user through steps
- Progress bar shows current position
- Can navigate back/forward between steps

---

## Known Limitations

1. **Layer Resolution:** All layers must have same point count
2. **Beat Cooldown:** Max ~400 BPM (150ms minimum between beats)
3. **Pitch Range:** 80-800 Hz (human vocal range)
4. **CPU Composition:** Layer blending happens on main thread (<5ms)

---

## Next Steps After Testing

If all tests pass:
1. ✅ Confirm layer undo works perfectly
2. ✅ Confirm beat pulses are visible
3. ✅ Confirm musical colors look good
4. ✅ Confirm wizard flow is intuitive

Then proceed to:
- Fine-tune beat detection threshold (currently 1.5x)
- Add more color palettes (Earth, Neon, Ocean)
- Consider GPU optimization for >10 layers
- Add export for multi-layer projects

---

**Happy Testing!** 🎨🎵

*If you encounter any issues, check the console for diagnostic messages.*

