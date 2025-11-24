# UI Wireframe Comparison: Before vs After

## CURRENT STATE (Before Refactor)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  HEADER: Voice-to-Sculpture Studio   [✨ Performance Mode] [Test Mesh]     │
│          [Sculpt] [Force] [Glaze] [Export]                                 │
└────────────────────────────────────────────────────────────────────────────┘
┌──────┬────────────────────────────────────────────────────────────┬────────┐
│      │                                                            │        │
│  📁  │                                                            │  🏺    │
│  🤖  │                                                            │  ━━━━  │
│  ↕️  │                3D VIEWPORT                                │  PARAM │
│  ⚙️  │                (Sculpture)                                │  PANEL │
│      │                                                            │        │
│      │                                                            │  788   │
│      │                                                            │  LINES │
│      │                                                            │        │
│      │                                                            │  Mixed │
│      │                                                            │  Props │
└──────┴────────────────────────────────────────────────────────────┴────────┘
┌────────────────────────────────────────────────────────────────────────────┐
│  FOOTER: [●REC] [▶] [⏹] │ Mic: 82% │ Pottery │ Recording                  │
└────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────┐
  │  🚨 NEW PROJECT MODAL (Blocks on first launch)  │
  │  ────────────────────────────────────────────    │
  │                                                  │
  │  📏 Target Height: [====○====] 150mm            │  ← DUPLICATE #1
  │                                                  │
  │  🎨 Material: [Ceramic] [Plastic]               │  ← DUPLICATE #1
  │                                                  │
  │  🎨 Base Color: [●] #D4A574                     │  ← DUPLICATE #1
  │                                                  │
  │  🔒 Constraints: [Digital][Ceramic][3D Print]   │  ← DUPLICATE #1
  │                                                  │
  │  [✨ Create Project]                            │
  │                                                  │
  │  💡 Customize all parameters anytime in Design  │  ← IRONIC!
  └──────────────────────────────────────────────────┘
```

### Parameter Panel (Current - 788 lines!)
```
┌─────────────────────────────────────┐
│  SCULPTURE PARAMETERS               │
├─────────────────────────────────────┤
│  Control Mode: [Standard][Melodic]  │
│  Base Shape: [Vase][Sphere][...]    │
│  Math Modifiers: [✓] Quantize       │
│                                      │
│  Height: [====○====] 150mm          │  ← DUPLICATE #2
│  Twist: [====○====] 0.5             │
│  Vertical Stretch: [====○====] 0    │
│  Resolution: [====○====] 0.9        │
│  Glaze: [====○====] 0.3             │  ← WRONG WORKSPACE!
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  FABRICATION CONSTRAINTS            │
│  [Digital][Ceramic][3D Print]       │  ← DUPLICATE #2
│  Full creative freedom...           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│                                      │
│  SCULPT MODE                         │
│  [Additive] [Subtractive]           │
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  MATERIAL                            │
│  [Ceramic] [Plastic]                │  ← DUPLICATE #2
│  Base Color: [●] #D4A574            │  ← DUPLICATE #2
│                                      │
└─────────────────────────────────────┘
```

### Fabrication Panel (Export Workspace)
```
┌─────────────────────────────────────┐
│  FABRICATION                        │
├─────────────────────────────────────┤
│  PHYSICS CONSTRAINTS                │
│  [Digital][Ceramic][3D Print]       │  ← DUPLICATE #3
│  [ ] Auto-Fix Geometry              │
│  Pottery wheel physics...           │
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  VIEW MODE (???)                    │  ← WRONG LOCATION
│  [ ] Pottery Wheel Mode             │
│  [Standard][X-Ray][Wireframe]       │
│                                      │
│  STUDIO LIGHTING (???)              │  ← WRONG LOCATION
│  [Studio][Neon][Darkroom]           │
│                                      │
│  GUIDES (???)                       │  ← WRONG LOCATION
│  [ ] Phantom Blueprint              │
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  PHYSICAL DIMENSIONS                │
│  Target Height: [150] mm            │  ← DUPLICATE #3
│  Wall Thickness: [3] mm             │
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  EXPORT                              │
│  [ Export GLB ]                     │
│  [ Export PLY ]                     │
│  [ Export STL ]                     │
│  [ Export SVG ]                     │
└─────────────────────────────────────┘
```

---

## PROPOSED STATE (After Refactor)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  HEADER: Voice-to-Sculpture Studio   [✨ Performance Mode] [New]           │
│          [Shape] [Push/Pull] [Paint] [Fabricate]  ← Renamed for clarity   │
└────────────────────────────────────────────────────────────────────────────┘
┌──────┬────────────────────────────────────────────────┬────────┬──────────┐
│      │                                                │        │          │
│  📁  │                                                │  🎛️    │  OBJECT  │
│  🤖  │                3D VIEWPORT                     │  ━━━━  │  PROPS   │
│  ⚙️  │                (Sculpture)                     │        │  ━━━━━━  │
│      │                                                │  SHAPE │  Always  │
│      │                              [🎥 View ▼]      │  TOOLS │  Visible │
│      │                                                │        │          │
│      │                                                │  ~300  │  Single  │
│      │                                                │  Lines │  Source  │
│      │                                                │        │  Truth   │
└──────┴────────────────────────────────────────────────┴────────┴──────────┘
┌────────────────────────────────────────────────────────────────────────────┐
│  FOOTER: [●REC] [▶] [⏹] │ Mic: 82% │ Pottery │ Recording                  │
└────────────────────────────────────────────────────────────────────────────┘

NO MODAL - Instant start with defaults!
```

### New: Object Properties Panel (Always Visible)
```
┌─────────────────────────────────────┐
│  OBJECT PROPERTIES                  │
├─────────────────────────────────────┤
│  Name: [My Sculpture        ]       │
│                                      │
│  Shape: [Vase ▼]                    │  ← Moved from buried location
│                                      │
│  PHYSICAL DIMENSIONS                │
│  Height: [150] mm ▼                 │  ← THE ONLY HEIGHT
│                                      │
│  MATERIAL                            │
│  Type: [Ceramic] [Plastic]          │  ← THE ONLY MATERIAL
│  Color: [●] #D4A574                 │  ← THE ONLY COLOR
│                                      │
│  FABRICATION                         │
│  Constraints: [Ceramic ▼]           │  ← THE ONLY CONSTRAINTS
│  [ ] Auto-Fix Geometry              │
│                                      │
└─────────────────────────────────────┘
```

### New: Shape Tools (Sculpt Workspace Only)
```
┌─────────────────────────────────────┐
│  DEFORMATION                        │
├─────────────────────────────────────┤
│  Control: [Standard] [Virtuoso]     │
│                                      │
│  Twist: [====○====] 0.5             │  ← Clean, focused
│  └─ -5 turns ←→ +5 turns            │
│                                      │
│  Vertical Stretch: [====○====] 0    │  ← Renamed!
│  └─ Stretched ←→ Compressed         │
│                                      │
│  Smoothness: [====○====] 0.9        │  ← Renamed!
│  └─ Blocky ←→ Smooth                │
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  MATH MODIFIERS                      │
│  [ ] Quantize (Lego Grid)           │
│  Symmetry: [====○====] 6 lobes      │
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  RECORDING MODE                      │
│  [Additive] [Subtractive]           │
│                                      │
└─────────────────────────────────────┘
```

### Paint Workspace (Glaze - Unchanged, Already Good!)
```
┌─────────────────────────────────────┐
│  LIVE COLOR MIXER                   │
├─────────────────────────────────────┤
│     ┌────────────────┐              │
│     │   3D SPHERE    │              │
│     │   (Preview)    │              │
│     └────────────────┘              │
│                                      │
│  Color: [●] #FF5733                 │
│  Surface: [====○====] 0.5           │  ← Renamed from "Roughness"
│                                      │
│  [  Save Glaze  ]                   │
│                                      │
│  PRESETS                             │  ← New feature!
│  [Earth] [Neon] [Ocean]             │
│                                      │
└─────────────────────────────────────┘
```

### Fabricate Workspace (Export Only)
```
┌─────────────────────────────────────┐
│  EXPORT & FABRICATION               │
├─────────────────────────────────────┤
│  EXPORT OPTIONS                      │
│  Wall Thickness: [3] mm             │  ← ONLY export-specific
│  [ ] Hollow (for ceramics)          │
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  FORMAT                              │
│  [ Export GLB (Universal) ]         │
│  [ Export PLY (Color 3D Print) ]    │
│  [ Export STL (Monochrome) ]        │
│  [ Export SVG (Blueprint) ]         │
│                                      │
│  💡 GLB includes vertex colors      │
│     from glaze painting             │
│                                      │
└─────────────────────────────────────┘
```

### New: Viewport Controls Dropdown
```
     ┌────────────────────────┐
     │  [🎥] VIEW             │
     │  ─────────────────────  │
     │  Display               │
     │  ● Standard            │
     │  ○ X-Ray               │
     │  ○ Wireframe           │
     │  ○ Heatmap             │
     │                        │
     │  Lighting              │
     │  ● Studio              │
     │  ○ Neon                │
     │  ○ Darkroom            │
     │                        │
     │  Guides                │
     │  [ ] Blueprint         │
     │  [ ] Grid              │
     │                        │
     │  Camera                │
     │  [✓] Pottery Mode      │
     │  [ Reset View ]        │
     │                        │
     └────────────────────────┘
```

---

## KEY IMPROVEMENTS

### 1. No More Modal Blocking
```
BEFORE: 
App Launch → 🚫 Modal Appears → Force 4 Decisions → ✨ Create Project

AFTER:
App Launch → ✅ Instant Start with Defaults → Discover Controls Organically
```

---

### 2. Single Source of Truth
```
BEFORE:
Height in 3 places ❌  Material in 2 places ❌  Constraints in 3 places ❌

AFTER:
Height in 1 place ✅  Material in 1 place ✅  Constraints in 1 place ✅
```

---

### 3. Context-Aware Panels
```
BEFORE (Sculpt Workspace):
✅ Twist, Stretch, Resolution
❌ Glaze (wrong workspace!)
❌ Height (in Properties now)
❌ Constraints (in Properties now)

AFTER (Shape Workspace):
✅ Twist, Stretch, Smoothness
✅ Math Modifiers
✅ Recording Mode
(ONLY relevant tools)
```

---

### 4. Semantic Clarity
```
BEFORE:
"Roughness" → User thinks: Surface texture
              Actually: Geometry resolution

"Compression" → User thinks: Squash
                Actually: Vertical stretch

AFTER:
"Smoothness" → User thinks: Blocky vs Smooth ✅
               Actually: Geometry resolution ✅

"Vertical Stretch" → User thinks: Stretch ✅
                     Actually: Vertical stretch ✅
```

---

## SIDE-BY-SIDE: Property Duplication

### BEFORE
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Modal          │  │  ParameterSlide │  │  Fabrication    │
│  ─────────────  │  │  ─────────────  │  │  ────────────── │
│  Height: 150mm  │  │  Height: 150mm  │  │  Height: 150mm  │
│  Material: Cera │  │  Material: Cera │  │  (not shown)    │
│  Color: #D4A574 │  │  Color: #D4A574 │  │  (not shown)    │
│  Constraints: C │  │  Constraints: C │  │  Constraints: C │
└─────────────────┘  └─────────────────┘  └─────────────────┘
      ❌                    ❌                    ❌
   DUPLICATE 1          DUPLICATE 2          DUPLICATE 3
```

### AFTER
```
┌─────────────────────────────┐
│  ObjectProperties (Sidebar) │
│  ───────────────────────── │
│  Height: 150mm              │  ← THE ONLY HEIGHT
│  Material: Ceramic          │  ← THE ONLY MATERIAL
│  Color: #D4A574             │  ← THE ONLY COLOR
│  Constraints: Ceramic       │  ← THE ONLY CONSTRAINTS
└─────────────────────────────┘
            ✅
    SINGLE SOURCE OF TRUTH
```

---

## COMPONENT LINE COUNT

### BEFORE
```
NewProjectModal.svelte:     330 lines  ❌ Delete
ParameterSliders.svelte:    788 lines  ❌ Too large
FabricationPanel.svelte:    498 lines  ⚠️  Refactor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:                     1,616 lines
```

### AFTER
```
ObjectProperties.svelte:    150 lines  ✅ New
ShapeTools.svelte:          300 lines  ✅ Focused
ExportTools.svelte:         200 lines  ✅ Focused
ViewportControls.svelte:    100 lines  ✅ Enhanced
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:                      750 lines

REDUCTION: -866 lines (-53%)
```

---

## USER JOURNEY: "I Want to Export My Sculpture"

### BEFORE (8 steps, 3 confusions)
```
1. Launch app → ⏸️ Modal blocks
2. Set Height to 150mm in modal
3. Click "Create Project"
4. Record audio → Generate shape
5. Switch to Export workspace
6. 😕 Confusion: "Why is Height here again? Is it different?"
7. 😕 Confusion: "What are View Mode settings doing in Export panel?"
8. 😕 Confusion: "Do I need to set Constraints again?"
9. Click "Export STL"
```

### AFTER (4 steps, 0 confusions)
```
1. Launch app → ✅ Instant start
2. Record audio → Generate shape
3. Switch to Fabricate workspace
4. Click "Export STL"

(Height, Material, Constraints set once in Properties, visible at all times)
```

---

## WORKSPACE CLARITY

### BEFORE (Confusing Names)
```
[Sculpt] [Force] [Glaze] [Export]
   ❌      ❌       ❌       ❌
Vague    Unclear  Jargon   Generic
```

### AFTER (Clear Actions)
```
[Shape] [Push/Pull] [Paint] [Fabricate]
   ✅       ✅         ✅         ✅
 Clear   Obvious   Intuitive  Specific
```

---

## SUMMARY: WHAT CHANGED?

### Deleted
- ❌ NewProjectModal.svelte (330 lines)
- ❌ 10 redundant controls

### Created
- ✅ ObjectProperties.svelte (150 lines)
- ✅ Enhanced ViewportControls (100 lines)

### Renamed
- ✅ ParameterSliders → ShapeTools
- ✅ FabricationPanel → ExportTools
- ✅ "Roughness" → "Smoothness"
- ✅ "Compression" → "Vertical Stretch"
- ✅ "Sculpt" → "Shape"

### Reorganized
- ✅ Height/Material/Color/Constraints → Single location
- ✅ View settings → Viewport dropdown
- ✅ Context-aware panel visibility

### Result
- ✅ 53% code reduction (866 lines)
- ✅ Zero redundancies
- ✅ Clear hierarchy
- ✅ Semantic clarity
- ✅ Faster app entry
- ✅ Less user confusion

---

**Ready for implementation!**

