# Next Tasks

## Priority 1: Build Verification (CRITICAL)

### Task: Verify pnpm build works
- **Why**: Ensure entity-model package compiles correctly
- **Files**: packages/entity-model/*
- **Test Steps**:
  1. `cd cad-viewer && pnpm install`
  2. `pnpm build` or `cd packages/entity-model && pnpm build`
  3. Check for TypeScript errors in dist output
- **Risk**: Medium - Need manual verification

### Task: Verify Nx build includes entity-model
- **Why**: Ensure package is in build graph
- **Files**: nx.json, packages/entity-model/tsconfig.json
- **Test Steps**:
  1. `npx nx graph` to see build graph
  2. Verify entity-model is included
- **Risk**: Low - Graph visualization only

## Priority 2: Vercel Deployment

### Task: Verify Vercel deployment works
- **Why**: Ensure build order correct for deployment
- **Test Steps**:
  1. Push to main branch
  2. Check Vercel build logs
  3. Verify deployment succeeds
- **Risk**: Medium - Network dependent

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
