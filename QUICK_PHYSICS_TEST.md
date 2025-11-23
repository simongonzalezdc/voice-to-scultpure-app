# ⚡ Quick Physics Test Guide

## 🎯 Test 1: Elastic Normalization (30 seconds)

**Hypothesis:** Recording duration doesn't affect height, only detail/resolution.

1. **Short Recording (1 second):**
   - Click Record → Say "HI" (quick) → Stop
   - ✅ **Expected:** Full-height vase (bottom to top)

2. **Long Recording (10 seconds):**
   - Click Record → Speak continuously for 10 seconds → Stop
   - ✅ **Expected:** Full-height vase (same height, smoother/more detail)

**Success Criteria:** Both sculptures have the same height, only resolution differs.

---

## 🎯 Test 2: Extreme Sliders (1 minute)

**Goal:** Verify unlocked ranges allow radical deformations.

### Height Test

1. Generate Test Mesh
2. **Miniature:** Set height to `10mm`
   - ✅ Expected: Tiny 1cm sculpture (espresso cup size)
3. **Monumental:** Set height to `1000mm`
   - ✅ Expected: 1-meter tall sculpture (life-size vase)

### Twist Test

4. **Extreme Spiral:** Set twist to `5.0`
   - ✅ Expected: 5 full rotations (extreme DNA helix)
   - Label should show `(1800°)`

### Compression Test

5. **Super Stretch:** Set compression to `-2.0`
   - ✅ Expected: Stretched 3x taller (elongated)
6. **Pancake:** Set compression to `0.95`
   - ✅ Expected: Nearly flat disk (squashed)

---

## 🎯 Test 3: Zone Sculpting (THE BIG ONE - 2 minutes)

**Goal:** Verify zone sculpting locks areas and only sculpts the active zone.

### Setup

1. Generate Test Mesh (hourglass)
2. Open Parameter Sliders
3. Scroll to **"Sculpt Zone"** section

### Test A: Lock the Base, Sculpt the Rim

4. Set sliders:
   - **Focus Bottom:** `70%`
   - **Focus Top:** `100%`

5. **Visual Check:**
   - ✅ Bottom 70% appears **DARK GRAY** (locked)
   - ✅ Top 30% appears **WHITE** (active zone)

6. **Record:**
   - Click Record
   - Speak for 3 seconds: "TESTING ZONE"
   - Click Stop

7. **Verify:**
   - ✅ **Bottom 70% unchanged** (still hourglass shape)
   - ✅ **Top 30% changed** (reflects your voice)

### Test B: Lock Everything Except Middle Band

8. Set sliders:
   - **Focus Bottom:** `40%`
   - **Focus Top:** `60%`

9. **Visual Check:**
   - ✅ Bottom 40% dark gray (locked)
   - ✅ Middle 20% white (active)
   - ✅ Top 40% dark gray (locked)

10. **Record:**
    - Click Record
    - Speak: "MIDDLE BAND"
    - Click Stop

11. **Verify:**
    - ✅ Only the middle 20% changed
    - ✅ Top and bottom remain unchanged

---

## 🎯 Test 4: Voice Amplification (30 seconds)

**Goal:** Verify voice is highly visible (amplified 75-150%).

1. Set zone to full: `0% - 100%`

2. **Loud Test:**
   - Record → **SHOUT:** "LOUD VOICE!" → Stop
   - ✅ Expected: Dramatic radius swells (thick → thin)

3. **Attack Test:**
   - Record → **Sharp sounds:** "K! T! P! CHK!" → Stop
   - ✅ Expected: Deep chisel marks (visible indentations)

4. **Pitch Test:**
   - Record → **Sing/hum** a melody → Stop
   - ✅ Expected: Wavy ripples along height

---

## ✅ Success Checklist

| Feature            | Test                                    | Pass? |
| ------------------ | --------------------------------------- | ----- |
| Elastic Height     | 1s recording = full vase                | ⬜    |
| Elastic Height     | 10s recording = full vase (more detail) | ⬜    |
| Height Slider      | 10mm = tiny                             | ⬜    |
| Height Slider      | 1000mm = 1 meter                        | ⬜    |
| Twist Slider       | 5.0 = 5 full rotations                  | ⬜    |
| Compression        | -2.0 = super stretch                    | ⬜    |
| Compression        | 0.95 = pancake                          | ⬜    |
| Zone Visual        | Locked areas = dark gray                | ⬜    |
| **Zone Sculpting** | **Only active zone changes**            | ⬜    |
| Voice Loud         | Dramatic radius changes                 | ⬜    |
| Voice Attack       | Deep chisel marks                       | ⬜    |
| Voice Pitch        | Wavy ripples                            | ⬜    |

---

## 🐛 If Something Doesn't Work

### Zone Sculpting Not Working?

**Symptoms:**

- Recording affects entire sculpture despite zone restriction
- Zone dimming doesn't show up

**Checks:**

1. Open Console (Cmd+Option+J)
2. Look for zone logging: `"zone: 70%-100%"`
3. Verify zone is actually restricted (sliders moved from 0-100%)
4. Make sure you're in **Recording** mode (not just viewing)

### Sliders Don't Go to Extreme Values?

**Fix:** Clear cache and hard reload (Cmd+Shift+R)

### Voice Still Not Visible?

**Check:**

1. Microphone permissions granted
2. Mic level bar showing activity
3. Console shows "I HEAR YOU: [energy]" logs

---

**Ready to test! 🚀**

The most important test is **Test 3: Zone Sculpting** - this is the NEW feature that allows layer-by-layer sculpting.
