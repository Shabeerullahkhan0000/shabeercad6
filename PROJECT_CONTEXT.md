# Project Context

## Overview

This is a monorepo CAD viewing application using pnpm workspaces, nx build system, and TypeScript. It provides CAD file viewing capabilities (DWG/DXF) in the browser.

## Packages Structure

### Core Packages
- **@mlightcad/cad-simple-viewer**: Core CAD rendering foundation (recommended)
- **@mlightcad/cad-viewer**: Vue-based wrapper with full UI components ❌ DEPRECATED - DO NOT USE

### Examples
- **cad-simple-viewer-example**: Vanilla JS example using cad-simple-viewer (recommended)
- **cad-viewer-example**: Vue example using cad-viewer ❌ DEPRECATED - DO NOT USE

### Renderers
- **three-renderer**: Three.js WebGL renderer
- **svg-renderer**: SVG renderer

## Key Findings

### ❌ Wrong Usage Found
1. **@mlightcad/cad-viewer package is heavily Vue-based** - All UI components use Vue (.vue files), Vue composables, vue-i18n
2. **cad-viewer-example** imports from @mlightcad/cad-viewer which depends on Vue
3. **Multiple dependencies on Vue**: 103+ files reference Vue in imports

### ✅ Correct Usage
1. **cad-simple-viewer-example** uses vanilla JS with @mlightcad/cad-simple-viewer
2. Provides pure TypeScript API without Vue dependencies

## Architecture

### Viewer Initialization (cad-simple-viewer-example)
- Uses `AcApDocManager.createInstance()` with config object
- Container: HTMLDivElement
- Options: autoResize, baseUrl, commandAliases, webworkerFileUrls
- Files loaded via `AcApDocManager.instance.openDocument()` or `openUrl()`

### Upload Flow
1. User selects file via HTML input
2. FileReader reads as ArrayBuffer
3. `AcApDocManager.instance.openDocument(fileName, fileContent, options)`
4. Supports DXF and DWG files

### Mobile Gesture Code
- Located in `cad-simple-viewer/src/view/AcTrView2d.ts`
- Pan/zoom operations handled by view modes: SELECTION, PAN
- Zoom commands in `AcApZoomCmd.ts` with window/extents/center/scale/previous branches

### Measurement Commands
- Distance: `AcApMeasureDistanceCmd.ts` - calculates Euclidean distance between two points
- Area: `AcApMeasureAreaCmd.ts`
- Angle: `AcApMeasureAngleCmd.ts`
- Uses transient entities + DOM overlays (badges/dots)

### Entity/Geometry
- Uses @mlightcad/data-model for AcDbEntity, AcGe geometry
- Entities rendered via `worldDraw(renderer)` returning THREE entities
- Scene manages entities, spatial indexing

## Build Configuration
- **Vite** for bundling (packages use vite.config.ts)
- **pnpm** for package management
- **Nx** for build orchestration
- **vercel.json** - Vercel deployment config added
- Build: `pnpm build` or `nx run-many -t build`

## Technical Debt / Risks
1. Vue dependencies tightly coupled in @mlightcad/cad-viewer
2. Worker paths may need adjustment for Vercel edge
3. Complex example uses deprecated packages
4. Mixed architecture (simple-viewer vs full viewer)
5. No Vite headers config in vite.config.ts for SharedArrayBuffer (need vercel.json headers)

## Verification Summary (All ✅)
- @mlightcad/cad-simple-viewer: Confirmed correct foundation
- @mlightcad/cad-viewer: Vue-based (deprecated), NOT used in simple-viewer packages
- Viewer init: AcApDocManager.createInstance() confirmed
- Upload flow: FileReader → ArrayBuffer → openDocument() confirmed
- Mobile gestures: Mouse events (mousedown/mousemove/mouseup) handle both desktop/mobile
- Measurements: Distance/Area/Angle/Arc via transient entities + DOM overlays
- Entity/geometry: @mlightcad/data-model, worldDraw(renderer)
- Build: Vite config, vercel.json added

## Mobile Performance Considerations
- Touch behavior in view modes
- Pan/zoom operations must be optimized
- Avoid re-rendering CAD canvas during drag
- Use overlay updates instead
