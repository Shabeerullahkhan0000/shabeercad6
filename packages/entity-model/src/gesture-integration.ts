/**
 * @mlightcad/entity-model
 * 
 * Gesture Integration - Wires gesture handler to viewer canvas.
 * 
 * Purpose:
 * - Attaches mobile gesture handler to CAD viewer canvas
 * - Provides hitTest callback for pan-on-empty detection
 * - Keeps gesture logic separate from viewer
 * 
 * IMPORTANT: This module uses injection pattern to avoid importing viewer internals.
 * The caller must provide a canvas getter function from the application layer.
 */

// ============================================================================
// Viewer Instance Getter (injection pattern)
// ============================================================================

/** Callback to get the viewer canvas - set by application */
let _getViewerCanvas: (() => HTMLCanvasElement | null) | null = null

/** Set the canvas getter - must be called by application before use */
export function setCanvasGetter(getter: () => HTMLCanvasElement | null): void {
  _getViewerCanvas = getter
}

/** Get canvas via injected getter */
function getCanvas(): HTMLCanvasElement | null {
  if (_getViewerCanvas) {
    return _getViewerCanvas()
  }
  return null
}

// ============================================================================
// Imports
// ============================================================================

import {
  createMobileGestureHandler,
  attachGestureHandler,
  type GestureConfig,
  type MobileGestureHandler,
  type HitTestFn,
  type GestureEvent
} from './gesture.js'
import { EntityStore } from './store.js'

/**
 * Gesture + Viewer integration options
 */
export interface GestureViewerIntegrationOptions {
  /** Gesture handler config */
  gestureConfig?: Partial<GestureConfig>
  /** Entity store for hitTest */
  store?: EntityStore
  /** Callback when tap occurs */
  onTap?: (point: { x: number; y: number }) => void
  /** Callback when pan starts */
  onPanStart?: (point: { x: number; y: number }) => void
  /** Callback when pan moves */
  onPanMove?: (delta: { x: number; y: number }) => void
  /** Callback when pan ends */
  onPanEnd?: () => void
  /** Callback when pinch starts */
  onPinchStart?: (center: { x: number; y: number }) => void
  /** Callback when pinch moves (scale factor) */
  onPinchMove?: (scale: number, center: { x: number; y: number }) => void
  /** Callback when pinch ends */
  onPinchEnd?: () => void
}

/**
 * Gesture + Viewer integrated handler
 */
export interface GestureViewerIntegration {
  /** The gesture handler */
  handler: MobileGestureHandler
  /** Attach to canvas */
  attach: () => void
  /** Detach from canvas */
  detach: () => void
  /** Update hitTest function */
  setHitTest: (hitTest: HitTestFn) => void
}

/**
 * Create hitTest function from entity store
 * 
 * Returns true if point hits any entity (not empty space).
 * Used for pan-on-empty detection.
 */
export function createStoreHitTest(store: EntityStore): HitTestFn {
  return async (point) => {
    // TODO: Implement actual hit test using viewer pick
    // For now, check if any entity is selected/visible at point
    const entities = store.getAll()
    if (entities.length === 0) {
      return false // Empty canvas
    }
    // TODO: Use viewer.isPointInEntity(point) when available
    // For now, return true to prevent pan when entities exist
    return true
  }
}

/**
 * Create gesture + viewer integration
 * 
 * Usage:
 * ```ts
 * const integration = createGestureViewerIntegration({
 *   onTap: (point) => { ... },
 *   onPanMove: (delta) => { ... }
 * })
 * integration.attach()
 * ```
 */
export function createGestureViewerIntegration(
  options: GestureViewerIntegrationOptions
): GestureViewerIntegration {
  const {
    gestureConfig,
    onTap,
    onPanStart,
    onPanMove,
    onPanEnd,
    onPinchStart,
    onPinchMove,
    onPinchEnd
  } = options

let handler: MobileGestureHandler | null = null
  let attached = false
  let canvas: HTMLCanvasElement | null = null

  /** Get canvas via injected getter */
  function getCanvas(): HTMLCanvasElement | null {
    // Use the injected getter (setCanvasGetter) instead of direct viewer import
    if (_getViewerCanvas) {
      return _getViewerCanvas()
    }
    return null
  }

/** Default hitTest - hit everything (prevents pan) */
  const defaultHitTest: HitTestFn = async () => true

  // Convert callback options to GestureConfig
  const gestureConfigResult: Partial<GestureConfig> = {
    ...gestureConfig,
    enableTap: gestureConfig?.enableTap ?? true,
    enablePanOnEmpty: gestureConfig?.enablePanOnEmpty ?? true,
    tapThreshold: gestureConfig?.tapThreshold ?? 10,
    panThreshold: gestureConfig?.panThreshold ?? 10,
    throttleMs: gestureConfig?.throttleMs ?? 0
  }

  handler = createMobileGestureHandler({
    config: gestureConfigResult
  })

  // Subscribe to gesture events and forward to callbacks
  if (handler) {
    handler.on((event) => {
      if (event.type === 'tap' && onTap) {
        onTap(event.point)
      } else if (event.type === 'pan_start' && onPanStart) {
        onPanStart(event.point)
      } else if (event.type === 'pan_move' && onPanMove) {
        onPanMove(event.delta!)
      } else if (event.type === 'pan_end' && onPanEnd) {
        onPanEnd()
      } else if (event.type === 'pinch_start' && onPinchStart) {
        onPinchStart(event.point)
      } else if (event.type === 'pinch_move' && onPinchMove) {
        onPinchMove(event.scale!, event.point)
      } else if (event.type === 'pinch_end' && onPinchEnd) {
        onPinchEnd()
      }
    })
  }

function attach() {
    if (attached) return
    
    canvas = getCanvas()
    if (!canvas || !handler) {
      console.warn('[gesture-integration] Canvas not ready')
      return
    }

    // Attach gesture handler to canvas
    attachGestureHandler(handler, canvas)

    attached = true
  }

/** Cleanup bound for beforeunload */
  function cleanup() {
    if (!attached) return
    detach()
  }

  function detach() {
    // Guard against double detach
    if (!attached || !canvas || !handler) {
      attached = false
      return
    }

    // Remove event listeners
    canvas.removeEventListener('touchstart', handler as any)
    canvas.removeEventListener('touchmove', handler as any)
    canvas.removeEventListener('touchend', handler as any)
    canvas.removeEventListener('touchcancel', handler as any)
    // Remove beforeunload fallback
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', cleanup)
    }

    attached = false
    canvas = null
  }

  function setHitTest(hitTest: HitTestFn) {
    // HitTest can be updated at runtime
    // Currently requires re-attach
    console.warn('[gesture-integration] setHitTest may require re-attach')
  }

  return {
    handler: handler,
    attach,
    detach,
    setHitTest
  }
}

/**
 * Create simple gesture integration for common use cases
 */
export interface SimpleGestureOptions {
  /** Enable tap selection */
  enableTap?: boolean
  /** Enable pan on empty space only */
  enablePanOnEmpty?: boolean
  /** Throttle ms for touchmove */
  throttleMs?: number
  /** Called when user taps (select entity) */
  onSelect?: (entityId: string) => void
  /** Called when user pans canvas */
  onPan?: (deltaX: number, deltaY: number) => void
  /** Called when user zooms (pinch) */
  onZoom?: (scale: number) => void
}

/**
 * Simple gesture integration factory
 * 
 * Usage:
 * ```ts
 * const gesture = createSimpleGestureIntegration({
 *   enableTap: true,
 *   enablePanOnEmpty: true,
 *   onSelect: (id) => console.log('selected:', id),
 *   onPan: (dx, dy) => view.pan(dx, dy)
 * })
 * gesture.attach()
 * ```
 */
export function createSimpleGestureIntegration(
  options: SimpleGestureOptions
): GestureViewerIntegration {
  return createGestureViewerIntegration({
    gestureConfig: {
      tapThreshold: 10,
      panThreshold: 10,
      throttleMs: options.throttleMs ?? 0,
      enableTap: options.enableTap ?? true,
      enablePanOnEmpty: options.enablePanOnEmpty ?? true
    },
    onTap: options.onSelect
      ? (point) => {
          // TODO: Convert screen point to entity selection
          console.log('[gesture] tap at', point)
        }
      : undefined,
    onPanMove: options.onPan
      ? (delta) => {
          options.onPan?.(delta.x, delta.y)
        }
      : undefined,
    onPinchMove: options.onZoom
      ? (scale) => {
          options.onZoom?.(scale)
        }
      : undefined
  })
}

// Re-export gesture types
export { 
  createMobileGestureHandler,
  attachGestureHandler 
} from './gesture.js'

export type {
  GestureConfig,
  MobileGestureHandler,
  HitTestFn,
  GestureEvent
} from './gesture.js'

export { GestureState } from './gesture.js'
