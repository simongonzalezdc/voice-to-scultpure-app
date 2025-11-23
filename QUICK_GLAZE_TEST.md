# 🎨 Quick GlazeMixer Test Guide

## 🎯 Test 1: Pitch-to-Color Rainbow (1 minute)

**Goal:** Verify full spectrum is accessible.

1. **Open GlazeMixer**
   - Click Settings button OR press `S` key
   - Navigate to glaze mixer panel

2. **Watch the Debug Panel** (black box below sphere)
   - Should show: `🎵 Pitch: XXXHz (Color Name)`

3. **Hum LOW** (deep voice, like a bass)
   - ✅ Expected: **RED** sphere
   - Debug shows: `80-150Hz (Red)`

4. **Hum MID** (normal speaking pitch)
   - ✅ Expected: **YELLOW-GREEN** sphere
   - Debug shows: `250-350Hz (Yellow/Green)`

5. **Sing HIGH** (falsetto, soprano range)
   - ✅ Expected: **BLUE-PURPLE** sphere
   - Debug shows: `450-600Hz (Purple)`

**Success:** You can produce the full rainbow from red to purple!

---

## 🎯 Test 2: Volume = Vibrancy (30 seconds)

**Goal:** Verify volume controls saturation (not opacity).

1. **Whisper** (very quiet)
   - ✅ Expected: **Muted, greyish** colors
   - Debug shows: `🔊 Vol: 10-20% (Quiet)`

2. **Normal voice**
   - ✅ Expected: **Moderate saturation**
   - Debug shows: `🔊 Vol: 40-60% (Medium)`

3. **SHOUT LOUD!**
   - ✅ Expected: **VIVID, bright colors**
   - Debug shows: `🔊 Vol: 80-100% (Loud - Vivid!)`

**Success:** Quiet = grey/pastel, Loud = vibrant/saturated!

---

## 🎯 Test 3: Debug Readout Works (30 seconds)

**Goal:** Verify real-time audio feedback.

1. **Stay silent** (don't make noise)
   - ✅ Expected:
     - `🎵 Pitch: 0Hz (Not detected)` ← RED text
     - `🔊 Vol: 0% (Silent)` ← RED text

2. **Hum (no clear pitch)**
   - ✅ Expected:
     - `🎵 Pitch: 0Hz (Not detected)` ← Still RED
     - `🔊 Vol: 30-50% (Medium)` ← Now BLUE (active)

3. **Sing clear note**
   - ✅ Expected:
     - `🎵 Pitch: 240Hz (Yellow)` ← GREEN (detected!)
     - `🔊 Vol: 60% (Loud - Vivid!)` ← BLUE
     - `🌬️ Timbre: 2500 → Roughness: 0.35` ← PURPLE

**Success:** All three values show real numbers (not NaN or errors)!

---

## 🚨 Troubleshooting

### "Pitch always shows 0Hz"

**Symptoms:**

- Debug shows: `🎵 Pitch: 0Hz (Not detected)` (RED)
- Even when singing clearly

**Possible Causes:**

1. Recording needs to be started first
2. Analysis worker not running
3. Pitch detection algorithm not triggering

**Fix:**

1. Try clicking "Record" button first to wake up audio
2. Check browser console for errors
3. Try refreshing page (Cmd+R)

---

### "Volume always 0%"

**Symptoms:**

- Debug shows: `🔊 Vol: 0% (Silent)` (RED)
- Even when speaking

**Possible Causes:**

1. Microphone permissions denied
2. Audio context suspended
3. Wrong microphone selected

**Fix:**

1. Click "🎤 Tap to Activate Mic" button if shown
2. Check browser permissions (should see mic icon in address bar)
3. Try speaking louder

---

### "Colors don't change"

**Symptoms:**

- Sphere stays one color
- Debug shows values changing but color stuck

**Possible Causes:**

1. HSL conversion issue
2. Material not reactive

**Fix:**

1. Refresh page
2. Check browser console for errors

---

## ✅ Success Checklist

| Feature                           | Working? |
| --------------------------------- | -------- |
| Low hum → Red sphere              | ⬜       |
| Mid singing → Yellow/Green sphere | ⬜       |
| High singing → Blue/Purple sphere | ⬜       |
| Quiet → Muted/grey colors         | ⬜       |
| Loud → Vivid/bright colors        | ⬜       |
| Debug shows real Hz values        | ⬜       |
| Debug shows volume %              | ⬜       |
| Pitch color name updates          | ⬜       |

---

## 🎨 Color Reference Chart

Use this to verify your pitch:

| Your Voice          | Frequency | Color            | Debug Text     |
| ------------------- | --------- | ---------------- | -------------- |
| **Deep Bass**       | 80-100Hz  | 🔴 Dark Red      | "Red"          |
| **Low Male**        | 100-150Hz | 🔴 Red           | "Red"          |
| **Male Speaking**   | 150-250Hz | 🟡 Orange-Yellow | "Yellow"       |
| **Female Speaking** | 250-350Hz | 🟢 Yellow-Green  | "Yellow/Green" |
| **Female Singing**  | 350-450Hz | 🔵 Cyan-Blue     | "Green/Blue"   |
| **High Female**     | 450-550Hz | 🟣 Blue-Purple   | "Purple"       |
| **Soprano**         | 550-600Hz | 🟣 Purple        | "Purple"       |

---

**Ready to test! 🚀**

The debug panel is your friend - it tells you EXACTLY what the system is detecting!
