# 🧪 Quick Test Guide: Twist, Zone & Voice Amplification

## 🎯 Test 1: Twist Creates TRUE Spiral (30 seconds)

1. **Generate Test Mesh** (button in top-left)
2. **Open Parameter Sliders** (right panel)
3. **Drag Twist slider** from `-1.0` to `1.0`

**✅ Expected Result:**
- Sculpture spirals like a **corkscrew**
- NOT just rotating, but **twisting around the axis**
- Like a screw, DNA helix, or twisted tower

**❌ Fail Case:**
- Shape only rotates but doesn't spiral
- → Vertex twist not working

---

## 🎯 Test 2: Zone Sculpting Locks Areas (1 minute)

1. **Generate Test Mesh**
2. **Scroll down** in Parameter Sliders to **"Sculpt Zone"** section
3. **Set sliders:**
   - Focus Bottom: `70%`
   - Focus Top: `100%`

**✅ Visual Check:**
- Bottom 70% of sculpture appears **dark gray** (locked)
- Top 30% appears **white/normal** (active zone)

4. **Click Record** → **Speak for 3 seconds** → **Stop**

**✅ Expected Result:**
- Only the **top 30%** changes shape
- Bottom **70% remains unchanged**

**Use Cases:**
- Lock base, sculpt rim (pottery lip)
- Lock rim, sculpt body
- Focus on middle band only

---

## 🎯 Test 3: Voice is LOUD & CLEAR (2 minutes)

**Setup:** Set Zone to full range (0% - 100%)

### Test 3A: Loud vs Quiet
1. **Record** → **SHOUT:** "LOUD VOICE!" → **Stop**
2. **Expected:** Large, dramatic radius changes (thick → thin)

3. **Record** → **Whisper:** "quiet voice" → **Stop**
4. **Expected:** Subtle, delicate variations

### Test 3B: Sharp Consonants (Chisel Effect)
1. **Record** → **Say sharply:** "K! T! P! CHK!" → **Stop**
2. **Expected:** Visible **indentations** (chisel marks)

### Test 3C: Pitch Variation (Ripples)
1. **Record** → **Sing/hum** a melody → **Stop**
2. **Expected:** Wavy **ripples** along the height

---

## 📊 Success Criteria

| Feature | Metric | Pass |
|---------|--------|------|
| **Twist** | Creates spiral (not just rotation) | ⬜ |
| **Zone Visual** | Locked areas appear dark gray | ⬜ |
| **Zone Locking** | Only active zone changes shape | ⬜ |
| **Voice Visible** | Loud voice = dramatic changes | ⬜ |
| **Attack Cuts** | Sharp sounds = indentations | ⬜ |
| **Pitch Ripples** | Singing = wavy surface | ⬜ |

---

## 🚨 Known Issue

**Zone Sculpting Logic Not Yet Applied to Frame Processing**

Currently:
- ✅ Visual dimming works (dark gray locked areas)
- ❌ Frame capture doesn't filter by zone yet

**Workaround:** This will be fixed in the next iteration. For now, the visual feedback works to show where the zone *should* be applied.

---

## 🎨 Visual Amplification Summary

**BEFORE** (old values):
- Energy sensitivity: 2.0x
- Attack cuts: 0.2x depth
- Timbre noise: 0.15x
- Pitch ripple: 0.1x

**AFTER** (new values):
- Energy sensitivity: **3.5x** (75% increase)
- Attack cuts: **0.5x** depth (150% increase)
- Timbre noise: **0.3x** (100% increase)
- Pitch ripple: **0.25x** (150% increase)

**Result:** Your voice should now be **dramatically more visible** in the sculpture!

---

## 🔧 If Something Breaks

**Console Errors:**
- Open DevTools Console (Cmd+Option+J)
- Look for errors mentioning `applyVertexTwist` or `applyZoneVisualization`

**Twist Not Working:**
- Check console for errors
- Try refresh (Cmd+R)

**Zone Not Dimming:**
- Make sure you're in recording mode
- Zone sliders must be moved from default (0-100%)

---

**Ready to test! 🚀**

