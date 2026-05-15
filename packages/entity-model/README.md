# @mlightcad/entity-model

CAD Entity Model for selection, snapping, measurement, BOQ, and AI commands.

**Does NOT touch viewer rendering** - purely data model layer.

## Installation

```bash
npm install @mlightcad/entity-model
```

## Usage Patterns

### Pattern 1: Full Integration (Recommended)

```ts
import { 
  buildFullIntegration,
  createSelectEntityCommand,
  createMeasureCommand 
} from '@mlightcad/entity-model'

// Build with DOM container and viewport getter
const { store, overlay, integration } = buildFullIntegration({
  container: document.getElementById('overlay')!,
  getViewport: () => ({ zoom: 1, panX: 0, panY: 0, width: 800, height: 600 })
})

// Execute command + sync overlay
const selectCmd = createSelectEntityCommand('entity-1', true)
integration.executeAndSync(selectCmd, { 
  store, 
  syncOptions: { showHandles: true }
})

// Execute measurement command
const measureCmd = createMeasureCommand(
  { x: 0, y: 0, z: 0 },
  { x: 100, y: 50, z: 0 }
)
integration.executeAndSync(measureCmd, { 
  store, 
  syncOptions: { showMeasurement: true }
})
```

### Pattern 2: Store + Viewer Bridge

```ts
import { EntityStore, createSimpleViewerBridge } from '@mlightcad/entity-model'

// Create store
const store = new EntityStore()

// Add entities
store.addEntity({
  id: 'line-1',
  type: 'LINE',
  layer: '0',
  geometry: { start: { x: 0, y: 0, z: 0 }, end: { x: 100, y: 50, z: 0 } },
  bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 50, z: 0 } }
})

// Create bridge to viewer
const bridge = createSimpleViewerBridge({
  store,
  highlightEntities: (ids) => viewer.highlight(ids),
  clearHighlights: () => viewer.clearHighlight()
})

// Subscribe to changes
store.subscribe((event) => {
  if (event.type === 'selection') {
    bridge.syncToViewer()
  }
})

// Select entity
store.select('line-1')
```

### Pattern 3: Overlay Only

```ts
import { createOverlayManager, worldToScreen } from '@mlightcad/entity-model'

// Create overlay manager
const overlay = createOverlayManager({
  container: document.getElementById('overlay')!,
  classPrefix: 'cad-overlay'
})

// Set viewport
overlay.setViewport({ zoom: 1, panX: 0, panY: 0, width: 800, height: 600 })

// Add measurement
overlay.setMeasurement(
  'm1',
  { x: 0, y: 0, z: 0 },
  { x: 100, y: 50, z: 0 },
  111.8,
  { label: 'Distance: 111.80m', unit: 'm' }
)

// Add handle
overlay.setHandle(
  'h1',
  { x: 50, y: 25, z: 0 },
  { shape: 'circle', color: '#2196F3' }
)

// Update on viewer pan/zoom
viewer.on('pan', (panX, panY) => {
  overlay.setViewport({ ...overlay.getViewport(), panX, panY })
})

viewer.on('zoom', (zoom) => {
  overlay.setViewport({ ...overlay.getViewport(), zoom })
})
```

### Pattern 4: Command Engine Only

```ts
import { 
  EntityStore,
  createSelectEntityCommand,
  createHideLayerCommand,
  createZoomToEntityCommand,
  executeStoreCommand,
  validateCommand 
} from '@mlightcad/entity-model'

// Create store with entities
const store = new EntityStore()
// ... add entities

// Create command
const cmd = createHideLayerCommand('DIMENSIONS')

// Validate before execution
const validation = validateCommand(store, cmd)
if (!validation.valid) {
  console.error('Invalid command:', validation.error)
  return
}

// Execute
const result = executeStoreCommand(store, cmd)
if (result.success) {
  const newStore = result.store!
  // Use new store
}
```

### Pattern 5: Geometry Helpers

```ts
import { 
  distance, 
  midpoint, 
  nearestPointOnLine,
  lineLineIntersection 
} from '@mlightcad/entity-model'

// Distance between points
const d = distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }) // 5

// Midpoint
const mid = midpoint({ x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 0 })

// Nearest point on line
const nearest = nearestPointOnLine(
  { x: 5, y: 5, z: 0 },  // point
  { x: 0, y: 0, z: 0 },  // line start
  { x: 10, y: 10, z: 0 }  // line end
)

// Line intersection
const intersection = lineLineIntersection(
  { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 0 },
  { x: 0, y: 10, z: 0 }, { x: 10, y: 0, z: 0 }
)
```

## API Summary

### Types
- `CadEntityType` - LINE, POLYLINE, CIRCLE, ARC, TEXT, MTEXT, DIMENSION, BLOCK, INSERT
- `CadEntity` - id, type, layer, geometry, bbox, metadata
- `Point3D`, `Point2D`, `BoundingBox`

### Store
- `EntityStore` - immutable entity storage
- `get()`, `has()`, `getAll()` - query
- `select()`, `selectAdd()`, `selectRemove()` - selection
- `highlight()`, `unhighlight()` - highlights
- `hideLayer()`, `showLayer()` - layer visibility
- `subscribe()` - change listeners

### Commands
- `createSelectEntityCommand()` - select/deselect
- `createHighlightEntitiesCommand()` - highlight
- `createHideLayerCommand()` - hide layer
- `createShowLayerCommand()` - show layer
- `createMeasureCommand()` - measure distance
- `createClearSelectionCommand()` - clear selection
- `createZoomToEntityCommand()` - zoom to entity

### Overlay
- `OverlayManager` - DOM overlay rendering
- `setLabel()`, `removeLabel()`
- `setMeasurement()`, `removeMeasurement()`
- `setHandle()`, `setHandleActive()`, `removeHandle()`
- `setTooltip()`, `removeTooltip()`
- `clear()`, `clearByType()`

### Integration
- `buildFullIntegration()` - quick setup
- `OverlayCommandIntegration` - command + overlay sync

## Mobile Considerations

- Overlay uses DOM (not canvas) for touch-friendly rendering
- Pointer events pass through container
- Update overlay viewport on pan/zoom for correct positioning
- Use `clear()` to prevent accumulated DOM elements

## Testing

```bash
# Build
pnpm build

# Test
pnpm test
