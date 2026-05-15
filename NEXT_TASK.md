# Next Tasks

## Priority 1: Vercel Deployment

### Task: Verify live Vercel deployment after main push
- **Why**: Ensure GitHub main triggers the Vercel build and worker assets are served
- **Files**: vercel.json, package.json
- **Test Steps**:
  1. Push to GitHub main branch
  2. Check Vercel build logs
  3. Verify deployment succeeds
  4. Open the deployed app and load a small DXF/DWG file
- **Risk**: Medium - Network dependent

## Priority 2: Code Quality Improvements

### Task: Clean up unused code in entity-model
- **Why**: Several utility functions are declared but never used
- **Files**: packages/entity-model/src/*
- **Items**:
  - `defaultHitTest` in gesture-integration.ts (commented out)
  - `_getViewport` in overlay-integration.ts (removed, was unused)
  - `initError` and `retryInitialization` in main.ts (flagged by noUnusedLocals)
- **Risk**: Low - unused code removal

---

## Completed: Documentation Audit ✅
- Corrected AGENT_RULES.md: TypeScript/Vite/pnpm/Nx
- Corrected PROJECT_CONTEXT.md: Build config details
- Verified pnpm-workspace.yaml includes entity-model via packages/*
- Verified nx.json build orchestration
- Verified cad-simple-viewer-example uses @mlightcad/cad-simple-viewer
- Verified cad-viewer is isolated (deprecated)

## Completed: Gesture Integration Fixes ✅
- Fixed GestureHandler type error
- Added GestureState/GestureEvent exports
- Added snap-engine module
- Pushed to GitHub

## Completed: Vercel Configuration ✅
- vercel.json with Vite framework
- COOP/COEP headers for SharedArrayBuffer
- SPA fallback configured
- Vercel build now uses `pnpm build:vercel`
- Root postinstall now avoids the deprecated full monorepo build path

## Completed: Entity Model Package ✅
- packages/entity-model created
- Types, geometry, store, commands, overlays
- Gestures, gesture integration
- Distance measurement module
- Snap engine module

## Completed: Repository Inspection ✅
- @mlightcad/cad-simple-viewer confirmed as foundation
- @mlightcad/cad-viewer/Vue isolated to deprecated packages
- No Vue imports in cad-simple-viewer-example
