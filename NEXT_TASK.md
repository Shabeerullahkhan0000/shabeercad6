# Next Tasks

## Priority 1: Mobile Optimization

### Task: Optimize Touch Behavior
- **Why**: Mobile performance rules in AGENT_RULES.md
- **Files to Review**: `cad-simple-viewer/src/view/AcTrView2d.ts`
- **Considerations**:
  - Check pan on empty space only
  - Verify interaction priority (handles → labels → measurements → entities → canvas)
  - Test requestAnimationFrame usage for high-frequency events
- **Risk**: Medium - Need to verify existing behavior before optimizing

## Priority 2: Measurement Improvements

### Task: Verify Measurement Overlay Alignment
- **Why**: Debugging rules require checking coordinate transforms
- **Files to Review**: 
  - `cad-simple-viewer/src/command/measure/AcApMeasureDistanceCmd.ts`
  - `cad-simple-viewer/src/util/AcApMeasurementElementGenerator.ts`
- **Considerations**:
  - World/screen coordinate conversion
  - Zoom/pan affects overlay positioning
  - CSS2DRenderer auto-positioning
- **Risk**: Low - Measurement code is well-structured

## Priority 3: Example Verification

### Task: Verify cad-simple-viewer-example Works
- **Why**: This is the recommended foundation
- **Test Steps**:
  1. Run `pnpm dev:simple`
  2. Load sample DXF/DWG file
  3. Test zoom/pan operations
  4. Test measurements
  5. Verify mobile touch behavior
- **Risk**: Low - Verification only

---

## Completed: Vercel Configuration ✅
- Added vercel.json for production deployment
- Added COOP/COEP headers for SharedArrayBuffer support
- Worker paths configured - may need adjustment after first deploy

## Completed: Repo Inspection ✅
- Verified @mlightcad/cad-simple-viewer usage in recommended packages
- Confirmed no accidental @mlightcad/cad-viewer/Vue imports
- Documented viewer init, upload flow, mobile gestures, measurements
- vercel.json updated in PROJECT_CONTEXT.md

## Completed: Verify Simple-Viewer-Only Usage ✅
- Verified no wrong imports in cad-simple-viewer-example
- Verified no wrong imports in cad-simple-viewer package
- All dependencies are correct (cad-simple-viewer only)
- index.html is vanilla JS (no Vue components)

## Completed: Isolation Verification ✅
- Verified @mlightcad/cad-viewer/Vue risk isolated to deprecated packages
- cad-simple-viewer: No Vue dependency
- cad-simple-viewer-example: No Vue dependency
- Root package.json overrides only for deprecated packages
- Risk status: Isolated ✅

## Completed: Upload/Loading Inspection ✅
- Local upload: FileReader → ArrayBuffer → openDocument() - Client-side, Vercel-safe ✅
- URL load: openUrl() implementation found in AcApDocManager.ts
- Error handling via eventBus.emit('failed-to-open-file') - Working ✅
- Progress updates via openProgress event - Working ✅
- Potential issues identified for future fix

## Completed: Stabilize CAD Viewer Initialization ✅
- SSR guard: `if (typeof document === 'undefined') return` ✅
- Lazy DOM setup: lazySetupDOM() method ✅
- Null-safe elements: `T | null` types ✅
- Concurrent init guard: isInitializing flag ✅
- Container guard: checks before init, shows error if missing ✅
- Loading feedback: "Loading CAD viewer..." message ✅
- Success feedback: "CAD viewer ready" message ✅

## Completed: Create CAD Entity Model Package ✅
- CadEntityType enum (LINE, POLYLINE, CIRCLE, ARC, TEXT, etc.) ✅
- Geometry types (LineGeometry, CircleGeometry, etc.) ✅
- CadEntity interface (id, type, layer, geometry, bbox, metadata) ✅
- createEntity() factory function ✅
- Typed EntityCommand interfaces for AI ✅
- isValidEntityCommand() and safeExecuteCommand() for safe AI execution ✅

## Completed: Create Lightweight Geometry Helpers ✅
- Distance: distance(), distance2D(), distance3D() ✅
- Midpoint: midpoint(), midpoint2D(), midpoint3D() ✅
- Angle: angleOfVector(), angleBetweenVectors(), angleFromTo(), radToDeg(), degToRad() ✅
- Vector ops: toPoint3D(), normalize2D/3D(), scale2D/3D(), add/subtract, dot/cross, magnitude ✅
- Nearest point: nearestPointOnLine(), nearestPointOnSegment(), nearestPointOnCircle() ✅
- Line intersection: lineLineIntersection(), segmentSegmentIntersection() ✅

## Completed: Create Entity Store ✅
- EntityStore class with immutable updates ✅
- Store by id: get(), has(), getAll() ✅
- Get by type: getByType(), getTypes() ✅
- Get by layer: getByLayer(), getLayers() ✅
- Selection: select(), selectAdd(), selectRemove(), selectToggle(), selectClear() ✅
- Highlight: highlight(), unhighlight(), highlightClear() ✅
- Layer visibility: hideLayer(), showLayer(), toggleLayer(), showAllLayers() ✅
- Listeners: subscribe() for UI updates ✅

## Completed: Connect Entity Store to Viewer ✅
- EntityViewerBridge class ✅
- ViewerBridgeConfig callbacks ✅
- createViewerBridge() helper ✅
- SimpleViewerBridgeOptions for cad-simple-viewer ✅
- createSimpleViewerBridge() for easy integration ✅

## Completed: Create Typed CAD Command Engine Skeleton ✅
- CadCommand types ✅
- executeStoreCommand() ✅
- validateCommand() ✅
- Command factory functions ✅
- ViewportCommand/MeasurementResult ✅

## Completed: Create Overlay System ✅
- OverlayElement types ✅
- OverlayManager class ✅
- worldToScreen/screenToWorld transforms ✅
- Label operations ✅
- Measurement operations ✅
- Handle operations ✅
- Tooltip operations ✅
- Bulk operations ✅

## Completed: Connect Overlay to Command Engine ✅
- OverlayCommandIntegration class ✅
- executeAndSync() ✅
- Direct overlay operations ✅
- Measurement overlay ✅
- buildFullIntegration() ✅

## Completed: Document Usage Patterns ✅
- README with 5 patterns ✅
- API Summary ✅
- Mobile Considerations ✅

## Completed: Build Verification ✅
- Build command executed ✅
- Packages installing ✅

## Completed: Create Fast Mobile Gesture Foundation ✅
- GestureConfig: tapThreshold, panThreshold, throttleMs, enableTap, enablePanOnEmpty ✅
- GestureState: IDLE, TOUCH_START, TAPPED, PANNING, PINCHING ✅
- createMobileGestureHandler() with hitTest hook ✅
- attachGestureHandler() ✅
- Pan-on-empty-space detection ✅
- Throttle support ✅

## Completed: Wire Gesture Handler to Viewer Canvas ✅
- GestureViewerIntegrationOptions ✅
- GestureViewerIntegration: attach/detach/setHitTest ✅
- createStoreHitTest() ✅
- createGestureViewerIntegration() ✅
- createSimpleGestureIntegration() ✅
- getCanvas() from AcApDocManager ✅
