# Alpha Test Protocol - Voice-to-Sculpture Studio

## Pre-Flight Checklist

### Environment Verification
- [ ] Browser: Chrome/Edge (for SharedArrayBuffer support)
- [ ] Dev server running (`npm run dev`)
- [ ] Microphone connected and working
- [ ] Browser console open (F12) for error monitoring

---

## Phase 1: Initial Load & Gatekeeper Test

### Test 1.1: First-Time User Flow
**Expected:** Tutorial should block access to studio

**Actions:**
1. Clear browser localStorage (or use incognito mode)
2. Navigate to `http://localhost:5173`
3. **Verify:**
   - [ ] Tutorial modal appears with "Welcome" step
   - [ ] Studio interface is hidden (only tutorial visible)
   - [ ] DebugOverlay appears in bottom-right corner
   - [ ] DebugOverlay shows "AudioContext: not-initialized"
   - [ ] DebugOverlay shows "Calibration: Not Calibrated"

---

## Phase 2: Calibration Flow Test

### Test 2.1: Microphone Permission
**Actions:**
1. Click "Get Started" on welcome screen
2. Click "Next" on mic-permission step
3. **Verify:**
   - [ ] Browser prompts for microphone permission
   - [ ] After allowing, tutorial advances to calibration step

### Test 2.2: Calibration Recording
**Actions:**
1. On calibration step, click "Start Calibration"
2. **During 5-second countdown:**
   - [ ] Countdown timer displays (5, 4, 3, 2, 1)
   - [ ] Progress bar fills from 0% to 100%
   - [ ] Speak normally (hum, talk, sing)
   - [ ] DebugOverlay shows "AudioContext: running"
   - [ ] DebugOverlay shows Mic Level increasing (0-100%)
   - [ ] DebugOverlay shows Pitch values (if detected)
   - [ ] Ring visualizer appears in 3D scene (scales with voice)

3. **After countdown completes:**
   - [ ] "Processing calibration data..." message appears
   - [ ] Calibration completes successfully
   - [ ] Tutorial advances to "first-recording" step
   - [ ] DebugOverlay shows calibration ranges (e.g., "Pitch: 80-400Hz")

### Test 2.3: Calibration Persistence
**Actions:**
1. Complete calibration (reach "first-recording" step)
2. Refresh the page (F5)
3. **Verify:**
   - [ ] Page reloads
   - [ ] Tutorial does NOT reappear
   - [ ] Studio interface is visible
   - [ ] DebugOverlay shows saved calibration values
   - [ ] Calibration status persists in localStorage

---

## Phase 3: Audio Pipeline Verification

### Test 3.1: AudioContext State
**Actions:**
1. Click "Record" button in Transport component
2. **Verify:**
   - [ ] DebugOverlay shows "AudioContext: running" (green badge)
   - [ ] Mic Level bar responds to sound
   - [ ] Ring visualizer appears and scales with voice

3. Click "Stop"
4. **Verify:**
   - [ ] AudioContext remains "running" (doesn't close)
   - [ ] Mic Level returns to 0%
   - [ ] Ring visualizer disappears

### Test 3.2: Real-Time Audio Feedback
**Actions:**
1. Start recording
2. **Perform these vocal tests:**
   - [ ] **Hum a low note** (80-150 Hz)
     - Verify: Pitch shows ~80-150 Hz in DebugOverlay
     - Verify: Ring visualizer responds
   - [ ] **Whistle** (high frequency, 1000+ Hz)
     - Verify: Pitch shows ~1000+ Hz
     - Verify: Ring visualizer scales differently
   - [ ] **Speak normally** (conversational tone)
     - Verify: Pitch varies with speech
     - Verify: Mic Level fluctuates with volume
   - [ ] **Make a loud sound** (clap, shout)
     - Verify: Mic Level spikes to near 100%
     - Verify: Ring visualizer scales dramatically
   - [ ] **Stay silent**
     - Verify: Mic Level drops to near 0%
     - Verify: Ring visualizer shrinks

---

## Phase 4: Sculpture Generation Test

### Test 4.1: First Recording
**Actions:**
1. Complete tutorial (click through to "Finish")
2. Click "Record" button
3. **Record for 3-5 seconds:**
   - Hum a melody
   - Vary pitch and volume
   - Speak or sing

4. Click "Stop"
5. **Verify:**
   - [ ] Button shows "Processing..."
   - [ ] After processing, sculpture appears in 3D scene
   - [ ] DebugOverlay shows vertex count (e.g., "Vertices: 1,024")
   - [ ] Sculpture geometry matches recorded audio characteristics

### Test 4.2: Sculpture Characteristics
**Actions:**
1. Record a new sculpture with:
   - **Low, steady hum** (constant pitch, low energy)
2. **Verify:**
   - [ ] Sculpture has consistent radius (low variation)
   - [ ] Height corresponds to pitch range

3. Record another with:
   - **Loud, varied singing** (high energy, varying pitch)
4. **Verify:**
   - [ ] Sculpture has dramatic radius variations
   - [ ] Surface reflects energy patterns

---

## Phase 5: Parameter Controls Test

### Test 5.1: Real-Time Parameter Updates
**Actions:**
1. Ensure a sculpture is visible
2. **Drag "Twist" slider:**
   - [ ] Ghost sculpture (wireframe) appears immediately
   - [ ] Ghost sculpture rotates/twists in real-time
   - [ ] Changes reflect as you drag (not just on release)

3. **Drag "Compression" slider:**
   - [ ] Ghost sculpture compresses vertically
   - [ ] Updates happen in real-time

4. **Drag "Roughness" slider:**
   - [ ] Ghost sculpture material changes
   - [ ] Surface appearance updates

5. **Drag "Glaze" slider:**
   - [ ] Transparency/glaze effect changes
   - [ ] Material updates in real-time

6. **Release slider:**
   - [ ] Ghost sculpture disappears
   - [ ] Actual sculpture updates to match
   - [ ] Changes persist

### Test 5.2: Parameter Persistence
**Actions:**
1. Adjust parameters to specific values
2. Record a new sculpture
3. **Verify:**
   - [ ] New sculpture uses default parameters
   - [ ] Previous sculpture retains its parameters

---

## Phase 6: Error Handling & Edge Cases

### Test 6.1: No Microphone Access
**Actions:**
1. Block microphone permission in browser
2. Try to start calibration
3. **Verify:**
   - [ ] Error message appears
   - [ ] App doesn't crash
   - [ ] User can retry

### Test 6.2: Silent Recording
**Actions:**
1. Start recording
2. Stay completely silent
3. Stop recording
4. **Verify:**
   - [ ] Sculpture still generates (with minimal geometry)
   - [ ] No errors in console
   - [ ] DebugOverlay shows appropriate values

### Test 6.3: Very Short Recording
**Actions:**
1. Start recording
2. Stop immediately (< 0.5 seconds)
3. **Verify:**
   - [ ] App handles gracefully
   - [ ] Sculpture generates (may be minimal)

---

## Phase 7: Performance Verification

### Test 7.1: Vertex Count Monitoring
**Actions:**
1. Record a long audio sample (10+ seconds)
2. **Verify:**
   - [ ] DebugOverlay shows vertex count
   - [ ] Vertex count is reasonable (< 50,000 for typical recording)
   - [ ] No performance degradation

### Test 7.2: Multiple Recordings
**Actions:**
1. Record 3-5 sculptures in succession
2. **Verify:**
   - [ ] No memory leaks (check browser DevTools Memory tab)
   - [ ] Each sculpture renders correctly
   - [ ] Previous sculptures don't interfere

---

## Success Criteria

### Critical (Must Pass)
- [ ] Calibration flow completes successfully
- [ ] Calibration persists across page reloads
- [ ] Audio pipeline shows real-time feedback
- [ ] Sculptures generate from recorded audio
- [ ] Parameter sliders update in real-time
- [ ] No crashes or console errors

### Important (Should Pass)
- [ ] Ring visualizer responds to all vocal inputs
- [ ] Pitch detection works for various frequencies
- [ ] DebugOverlay shows accurate telemetry
- [ ] Gatekeeper prevents access without calibration

### Nice-to-Have
- [ ] Smooth visual transitions
- [ ] Accurate pitch detection for musical notes
- [ ] Sculpture geometry reflects audio characteristics

---

## Known Issues to Document

**If you encounter any of these, document them:**

1. **AudioContext State Issues:**
   - Does it stay "running" after stop?
   - Does it suspend unexpectedly?

2. **Calibration Problems:**
   - Does calibration fail silently?
   - Are ranges saved correctly?

3. **Visual Feedback Issues:**
   - Does ring visualizer lag?
   - Does it respond to all sounds?

4. **Sculpture Generation:**
   - Are sculptures too simple/complex?
   - Do they match audio characteristics?

---

## Test Environment Notes

- **Browser:** ________________
- **OS:** ________________
- **Microphone:** ________________
- **Date:** ________________
- **Tester:** ________________

---

## Post-Test Actions

1. Document any failures in the "Known Issues" section
2. Take screenshots of DebugOverlay during various states
3. Record a short video of the ring visualizer responding
4. Check browser console for any warnings/errors
5. Verify localStorage contains calibration data

