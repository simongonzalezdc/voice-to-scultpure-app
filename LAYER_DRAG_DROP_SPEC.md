# 🎨 Layer Drag & Drop Reordering - Implementation Specification

**Date:** November 2025  
**Priority:** Medium  
**Estimated Effort:** 4-6 hours  
**Dependencies:** None (can be implemented standalone)

---

## 📋 Overview

This document specifies the implementation of drag-and-drop layer reordering for the Voice-to-Sculpture Studio. Layers control how voice recordings are composited into the final sculpture shape.

---

## 🎯 User Stories

1. **As a user**, I want to drag layers to reorder them so I can control how they blend together.
2. **As a user**, I want visual feedback during drag so I know where the layer will be dropped.
3. **As a user**, I want to undo accidental reorders so I don't lose my work.

---

## 🏗️ Architecture

### Current Layer System

```typescript
// src/lib/types.ts
interface SculptureLayer {
  id: string;
  name: string;
  type: LayerType;  // 'base' | 'deformation' | 'texture' | 'glaze' | 'distortion' | 'color'
  visible: boolean;
  locked: boolean;
  blendMode: BlendMode;  // 'add' | 'subtract' | 'multiply' | 'overwrite'
  opacity: number;
  data: Float32Array;
  mask: Float32Array;
}

// Layers are stored in order - first layer is bottom, last is top
interface SculptureDefinition {
  layers: SculptureLayer[];
  // ...
}
```

### Affected Files

| File | Changes Required |
|------|------------------|
| `src/lib/components/wizard/LayerPanel.svelte` | Add drag handlers, drop zones |
| `src/lib/stores/sculptureStore.svelte.ts` | Add `reorderLayers()` function |
| `src/lib/stores/historyStore.svelte.ts` | Push history before reorder |
| `src/lib/styles/jewel-theme.css` | Add drag/drop visual styles |

---

## 🖼️ UI Design

### Visual States

```
┌─────────────────────────────────────┐
│ LAYERS                          [+] │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ ⋮⋮ 👁 Base Layer        [🔒] ▼ │ │  ← Normal state
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ⋮⋮ 👁 Rhythm Layer           ▼ │ │  ← Dragging this
│ └─────────────────────────────────┘ │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   Drop here                        │  ← Drop indicator
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│ ┌─────────────────────────────────┐ │
│ │ ⋮⋮ 👁 Glaze Layer            ▼ │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Drag Handle

```svelte
<!-- Drag handle (grip icon) -->
<div class="drag-handle" draggable="true">
  <GripVertical size={14} />
</div>
```

### Visual Feedback Classes

```css
/* Layer being dragged */
.layer-item.dragging {
  opacity: 0.5;
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
}

/* Drop zone indicator */
.drop-indicator {
  height: 4px;
  background: var(--brand-primary);
  border-radius: 2px;
  margin: 4px 0;
  animation: pulse 0.5s ease-in-out infinite alternate;
}

/* Layer that can't be moved (locked) */
.layer-item.locked .drag-handle {
  opacity: 0.3;
  cursor: not-allowed;
}
```

---

## 💻 Implementation

### 1. Store Function

```typescript
// src/lib/stores/sculptureStore.svelte.ts

/**
 * Reorder layers by moving a layer from one index to another
 * @param fromIndex - Current index of the layer
 * @param toIndex - Target index for the layer
 */
export function reorderLayers(fromIndex: number, toIndex: number): void {
  if (!sculptureStore.currentSculpture) return;
  
  const layers = [...sculptureStore.currentSculpture.layers];
  
  // Validate indices
  if (fromIndex < 0 || fromIndex >= layers.length) return;
  if (toIndex < 0 || toIndex >= layers.length) return;
  if (fromIndex === toIndex) return;
  
  // Check if layer is locked
  const layer = layers[fromIndex];
  if (layer?.locked) {
    console.warn('⚠️ [LAYERS] Cannot move locked layer');
    return;
  }
  
  // Remove from old position
  const [removed] = layers.splice(fromIndex, 1);
  if (!removed) return;
  
  // Insert at new position
  layers.splice(toIndex, 0, removed);
  
  // Update sculpture
  const updated: SculptureDefinition = {
    ...sculptureStore.currentSculpture,
    layers
  };
  
  setCurrentSculpture(updated);
  sculptureStore.geometryDirty = true;
  
  console.log(`🔄 [LAYERS] Moved "${removed.name}" from ${fromIndex} to ${toIndex}`);
}
```

### 2. LayerPanel Component

```svelte
<!-- src/lib/components/wizard/LayerPanel.svelte -->
<script lang="ts">
  import { sculptureStore, reorderLayers } from '$lib/stores/sculptureStore.svelte';
  import { pushHistory } from '$lib/stores/historyStore.svelte';
  import { GripVertical, Eye, EyeOff, Lock, Unlock } from 'lucide-svelte';
  
  let draggedIndex = $state<number | null>(null);
  let dropTargetIndex = $state<number | null>(null);
  
  function handleDragStart(e: DragEvent, index: number) {
    const layer = sculptureStore.currentSculpture?.layers[index];
    if (layer?.locked) {
      e.preventDefault();
      return;
    }
    
    draggedIndex = index;
    e.dataTransfer?.setData('text/plain', index.toString());
    e.dataTransfer!.effectAllowed = 'move';
  }
  
  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    dropTargetIndex = index;
  }
  
  function handleDragLeave() {
    dropTargetIndex = null;
  }
  
  function handleDrop(e: DragEvent, toIndex: number) {
    e.preventDefault();
    
    const fromIndex = draggedIndex;
    if (fromIndex === null || fromIndex === toIndex) {
      resetDragState();
      return;
    }
    
    // Push history before reorder
    pushHistory('Reorder layers');
    
    // Perform reorder
    reorderLayers(fromIndex, toIndex);
    
    resetDragState();
  }
  
  function handleDragEnd() {
    resetDragState();
  }
  
  function resetDragState() {
    draggedIndex = null;
    dropTargetIndex = null;
  }
</script>

<div class="layer-list">
  {#each sculptureStore.currentSculpture?.layers ?? [] as layer, index (layer.id)}
    <!-- Drop indicator above -->
    {#if dropTargetIndex === index && draggedIndex !== null && draggedIndex > index}
      <div class="drop-indicator"></div>
    {/if}
    
    <div
      class="layer-item"
      class:dragging={draggedIndex === index}
      class:locked={layer.locked}
      ondragover={(e) => handleDragOver(e, index)}
      ondragleave={handleDragLeave}
      ondrop={(e) => handleDrop(e, index)}
    >
      <!-- Drag Handle -->
      <div
        class="drag-handle"
        draggable={!layer.locked}
        ondragstart={(e) => handleDragStart(e, index)}
        ondragend={handleDragEnd}
      >
        <GripVertical size={14} />
      </div>
      
      <!-- Layer Content -->
      <button class="visibility-toggle">
        {#if layer.visible}
          <Eye size={14} />
        {:else}
          <EyeOff size={14} />
        {/if}
      </button>
      
      <span class="layer-name">{layer.name}</span>
      
      {#if layer.locked}
        <Lock size={12} class="lock-icon" />
      {/if}
    </div>
    
    <!-- Drop indicator below -->
    {#if dropTargetIndex === index && draggedIndex !== null && draggedIndex < index}
      <div class="drop-indicator"></div>
    {/if}
  {/each}
</div>

<style>
  .layer-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .layer-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-panel-alt);
    border-radius: 6px;
    border: 1px solid transparent;
    transition: all var(--transition-fast);
  }
  
  .layer-item:hover {
    border-color: var(--border-subtle);
  }
  
  .layer-item.dragging {
    opacity: 0.5;
    transform: scale(1.02);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
  
  .drag-handle {
    cursor: grab;
    color: var(--text-muted);
    padding: 4px;
    border-radius: 4px;
    transition: color var(--transition-fast);
  }
  
  .drag-handle:hover {
    color: var(--text-primary);
    background: var(--bg-panel);
  }
  
  .drag-handle:active {
    cursor: grabbing;
  }
  
  .layer-item.locked .drag-handle {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .drop-indicator {
    height: 4px;
    background: var(--brand-primary);
    border-radius: 2px;
    margin: 4px 0;
    animation: pulse 0.5s ease-in-out infinite alternate;
  }
  
  @keyframes pulse {
    from { opacity: 0.5; }
    to { opacity: 1; }
  }
  
  .layer-name {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .visibility-toggle {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }
  
  .visibility-toggle:hover {
    color: var(--text-primary);
    background: var(--bg-panel);
  }
  
  .lock-icon {
    color: var(--text-muted);
  }
</style>
```

### 3. Keyboard Support (Accessibility)

```typescript
// Additional keyboard handlers for accessibility
function handleKeyDown(e: KeyboardEvent, index: number) {
  const layers = sculptureStore.currentSculpture?.layers ?? [];
  
  if (e.key === 'ArrowUp' && e.altKey && index > 0) {
    e.preventDefault();
    pushHistory('Move layer up');
    reorderLayers(index, index - 1);
  }
  
  if (e.key === 'ArrowDown' && e.altKey && index < layers.length - 1) {
    e.preventDefault();
    pushHistory('Move layer down');
    reorderLayers(index, index + 1);
  }
}
```

---

## 🧪 Testing

### Unit Tests

```typescript
// src/lib/__tests__/layer-reorder.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sculptureStore, reorderLayers, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';

describe('Layer Reordering', () => {
  beforeEach(() => {
    // Setup test sculpture with 3 layers
    setCurrentSculpture({
      id: 'test',
      name: 'Test',
      createdAt: Date.now(),
      layers: [
        { id: 'a', name: 'Layer A', type: 'base', visible: true, locked: false, blendMode: 'overwrite', opacity: 1, data: new Float32Array(128), mask: new Float32Array(128) },
        { id: 'b', name: 'Layer B', type: 'distortion', visible: true, locked: false, blendMode: 'add', opacity: 1, data: new Float32Array(128), mask: new Float32Array(128) },
        { id: 'c', name: 'Layer C', type: 'glaze', visible: true, locked: false, blendMode: 'add', opacity: 1, data: new Float32Array(128), mask: new Float32Array(128) },
      ],
      physical: { height: 150, units: 'mm', wallThickness: 3, orientation: 'vertical', sculptMode: 'additive' }
    });
  });

  it('should move layer from index 0 to index 2', () => {
    reorderLayers(0, 2);
    const layers = sculptureStore.currentSculpture?.layers;
    expect(layers?.[0]?.id).toBe('b');
    expect(layers?.[1]?.id).toBe('c');
    expect(layers?.[2]?.id).toBe('a');
  });

  it('should not move locked layers', () => {
    sculptureStore.currentSculpture!.layers[0].locked = true;
    reorderLayers(0, 2);
    expect(sculptureStore.currentSculpture?.layers[0]?.id).toBe('a');
  });

  it('should handle invalid indices gracefully', () => {
    reorderLayers(-1, 2);
    reorderLayers(0, 10);
    expect(sculptureStore.currentSculpture?.layers.length).toBe(3);
  });
});
```

---

## 📱 Mobile Considerations

For touch devices, consider using a library like `@dnd-kit/sortable` or implementing touch events:

```typescript
// Touch event handlers
function handleTouchStart(e: TouchEvent, index: number) {
  const touch = e.touches[0];
  // Store initial position
  dragStartY = touch.clientY;
  draggedIndex = index;
}

function handleTouchMove(e: TouchEvent) {
  if (draggedIndex === null) return;
  const touch = e.touches[0];
  // Calculate new position based on touch movement
  // Update dropTargetIndex based on position
}

function handleTouchEnd() {
  if (draggedIndex !== null && dropTargetIndex !== null) {
    pushHistory('Reorder layers');
    reorderLayers(draggedIndex, dropTargetIndex);
  }
  resetDragState();
}
```

---

## 📊 Performance Considerations

1. **Geometry Recomputation**: After reorder, mark `geometryDirty = true` to trigger recomposition
2. **Debounce Rapid Reorders**: If user drags quickly through multiple positions, debounce the final reorder
3. **Virtual List**: For sculptures with many layers (10+), consider virtualizing the layer list

---

## ✅ Acceptance Criteria

- [ ] User can drag layers using the grip handle
- [ ] Visual feedback shows drop position
- [ ] Locked layers cannot be dragged
- [ ] Undo/redo works after reorder
- [ ] Keyboard shortcuts work (Alt+Arrow)
- [ ] Sculpture geometry updates after reorder
- [ ] Works on touch devices

---

*Document created for future implementation. Estimated completion: 4-6 hours.*

