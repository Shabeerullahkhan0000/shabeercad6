# TODO: Fix TypeScript Build Errors

## Status: FAILING BUILD - Need to fix ~30 TypeScript errors

## Build Error Summary

```
@mlightcad/entity-model:build error
- command-engine.ts: bbox.min/max property errors
- distancemeasurement.ts: unused 'worldToScreen' import
- factory.ts: unused 'EntityMetadata' import  
- geometry.ts: unused 'BoundingBox' import
- gesture-integration.ts: cannot find '@mlightcad/cad-simple-viewer'
- gesture.ts: unused 'element' and 'e' parameters
- overlay-integration.ts: EntityStore not exported from command-engine
- snap-engine.ts: multiple unused imports
- viewer-bridge.ts: multiple unused imports

@mlightcad/cad-simple-viewer-example:build error
- main.ts: HTMLElement type casting issues
```

## TODO Items

### Priority 1: Fix Unused Imports (TS6133)

- [x] 1. distancemeasurement.ts - Remove unused worldToScreen import
- [x] 2. factory.ts - Remove unused EntityMetadata import or use it
- [x] 3. geometry.ts - Remove unused BoundingBox import
- [x] 4. snap-engine.ts - Remove unused Point2D, isPointInBBox, distance2D, nearestPointOnLine, lineLineIntersection, worldToScreen
- [x] 5. viewer-bridge.ts - Remove unused SelectionChangeEvent, createSelectionChangeEvent, CadEntity
- [x] 6. gesture.ts - Fix unused element parameter in function

### Priority 2: Fix Missing Exports/Re-exports

- [x] 7. overlay-integration.ts - Re-export EntityStore from command-engine (or import from store)

### Priority 3: Fix Module Resolution

- [x] 8. gesture-integration.ts - Cannot find '@mlightcad/cad-simple-viewer'
  - Option A: Add as peer dependency in package.json
  - Option B: Remove the import and make integration purely optional

### Priority 4: Fix Property Access

- [x] 9. command-engine.ts - Check bbox.min/max access (line 242-243)

### Priority 5: Example Build Fix

- [x] 10. main.ts - Fix HTMLElement type casting

## Fix Commands

```bash
# Test build after fixes
cd cad-viewer && pnpm install && pnpm build
