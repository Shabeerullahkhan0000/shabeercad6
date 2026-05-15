/**
 * Two-Point Distance Measurement
 * 
 * Features:
 * - Basic: tap Point A, tap Point B, show line/distance
 * - Editable: P1/P2 handles, drag to update, distance updates live
 * - No snapping, no endpoint editing
 * 
 * Uses:
 * - @mlightcad/cad-simple-viewer for CAD rendering (not mutated)
 * - Overlay manager for DOM rendering + handles
 * - Geometry helpers for distance calculation
 */

import { Point2D, Point3D } from './types.js'
import { distance } from './geometry.js'
import {
  screenToWorld,
  OverlayManager,
  ViewportState
} from './overlay.js'

// ============================================================================
// Measurement State
// ============================================================================

/** Distance measurement state machine */
export enum MeasurementState {
  /** No points selected */
  IDLE = 'idle',
  /** First point (Point A) selected */
  POINT_A = 'point_a',
  /** Both points selected - measurement complete */
  COMPLETE = 'complete',
  /** Dragging P1 handle */
  DRAGGING_P1 = 'dragging_p1',
  /** Dragging P2 handle */
  DRAGGING_P2 = 'dragging_p2'
}

/** Distance measurement result */
export interface DistanceMeasurementResult {
  /** First point in world coordinates */
  pointA: Point3D
  /** Second point in world coordinates */
  pointB: Point3D
  /** Distance between points */
  distance: number
  /** Formatted distance string with unit */
  formatted: string
}

// ============================================================================
// Measurement Configuration
// ============================================================================

export interface DistanceMeasurementConfig {
  /** Overlay manager for rendering points and line */
  overlay: OverlayManager
  /** Get current viewport state (zoom, pan, dimensions) */
  getViewport: () => ViewportState
  /** Callback when measurement is complete */
  onComplete?: (result: DistanceMeasurementResult) => void
  /** Callback when distance changes during drag */
  onDrag?: (result: DistanceMeasurementResult) => void
  /** Distance unit: 'mm' | 'cm' | 'm' | 'in' | 'ft' */
  unit?: 'mm' | 'cm' | 'm' | 'in' | 'ft'
  /** Distance precision (decimal places) */
  precision?: number
  /** Handle size in pixels */
  handleSize?: number
  /** Enable handles for P1/P2 editing */
  enableHandles?: boolean
  /** Block pan when dragging handle */
  blockPanOnDrag?: boolean
}

const defaultConfig: Partial<DistanceMeasurementConfig> = {
  unit: 'm',
  precision: 2,
  handleSize: 12,
  enableHandles: true,
  blockPanOnDrag: true
}

// ============================================================================
// Measurement Manager
// ============================================================================

export interface DistanceMeasurementManager {
  /** Current state */
  state: MeasurementState
  /** Get current result (if complete) */
  getResult: () => DistanceMeasurementResult | null
  /** Handle screen tap */
  onTap: (screenPoint: Point2D) => void
  /** Handle screen drag start (for handles) */
  onDragStart: (screenPoint: Point2D) => boolean
  /** Handle screen drag move */
  onDragMove: (screenPoint: Point2D) => void
  /** Handle screen drag end */
  onDragEnd: () => void
  /** Cancel current measurement */
  cancel: () => void
  /** Reset for next measurement */
  reset: () => void
}

/** Create distance measurement manager */
export function createDistanceMeasurement(
  config: DistanceMeasurementConfig
): DistanceMeasurementManager {
  const { 
    overlay, 
    getViewport, 
    onComplete,
    onDrag,
    handleSize = 12,
    enableHandles = true,
    blockPanOnDrag = true
  } = {
    ...defaultConfig,
    ...config
  }

  let state: MeasurementState = MeasurementState.IDLE
  let pointA: Point3D | null = null
  let pointB: Point3D | null = null
  let result: DistanceMeasurementResult | null = null
  let draggingHandle: 'p1' | 'p2' | null = null

  function formatDistance(dist: number, unit: string, precision: number): string {
    let value = dist
    let displayUnit = unit

    if (unit === 'mm') {
      value = dist * 1000
      displayUnit = 'mm'
    } else if (unit === 'cm') {
      value = dist * 100
      displayUnit = 'cm'
    } else if (unit === 'in') {
      value = dist * 39.3701
      displayUnit = 'in'
    } else if (unit === 'ft') {
      value = dist * 3.28084
      displayUnit = 'ft'
    }

    return `${value.toFixed(precision)} ${displayUnit}`
  }

  function clearMeasurement(): void {
    overlay.removeMeasurement('distance-line')
    overlay.removeHandle('distance-handle-p1')
    overlay.removeHandle('distance-handle-p2')
  }

  function updateMeasurement(): void {
    if (!pointA || !pointB) return

    const dist = distance(pointA, pointB)
    const formatted = formatDistance(dist, config.unit ?? 'm', config.precision ?? 2)

    result = {
      pointA,
      pointB,
      distance: dist,
      formatted
    }

    // Update line and label
    overlay.setMeasurement(
      'distance-line',
      pointA,
      pointB,
      dist,
      {
        label: formatted,
        precision: config.precision ?? 2,
        unit: config.unit ?? 'm'
      }
    )

    // Update handles
    if (enableHandles) {
      overlay.setHandle(
        'distance-handle-p1',
        pointA,
        { size: handleSize, shape: 'circle', color: '#2196F3' }
      )
      overlay.setHandle(
        'distance-handle-p2',
        pointB,
        { size: handleSize, shape: 'circle', color: '#4CAF50' }
      )
    }

    // Callback
    if (onDrag) {
      onDrag(result)
    }
  }

  const self: DistanceMeasurementManager = {
    get state() { return state },
    getResult() { return result },

    onTap(screenPoint: Point2D) {
      const viewport = getViewport()
      const worldPoint = screenToWorld(
        { x: screenPoint.x, y: screenPoint.y },
        viewport
      )

      if (state === MeasurementState.IDLE) {
        // First tap - set Point A
        pointA = worldPoint
        state = MeasurementState.POINT_A

        // Show P1 handle
        if (enableHandles) {
          overlay.setHandle(
            'distance-handle-p1',
            pointA,
            { size: handleSize, shape: 'circle', color: '#2196F3' }
          )
        }
      } else if (state === MeasurementState.POINT_A) {
        // Second tap - set Point B and show measurement
        pointB = worldPoint

        if (!pointA) return

        const dist = distance(pointA, pointB)
        const formatted = formatDistance(
          dist,
          config.unit ?? 'm',
          config.precision ?? 2
        )

        result = {
          pointA,
          pointB,
          distance: dist,
          formatted
        }

        // Show distance line and label
        overlay.setMeasurement(
          'distance-line',
          pointA,
          pointB,
          dist,
          {
            label: formatted,
            precision: config.precision ?? 2,
            unit: config.unit ?? 'm'
          }
        )

        // Show P2 handle
        if (enableHandles) {
          overlay.setHandle(
            'distance-handle-p2',
            pointB,
            { size: handleSize, shape: 'circle', color: '#4CAF50' }
          )
        }

        state = MeasurementState.COMPLETE

// Callback
        if (onComplete && result) {
          onComplete(result)
        }
      }
    },

    onDragStart(screenPoint: Point2D): boolean {
      if (state !== MeasurementState.COMPLETE || !enableHandles || !blockPanOnDrag) {
        return false
      }

      const viewport = getViewport()
      const worldPoint = screenToWorld(
        { x: screenPoint.x, y: screenPoint.y },
        viewport
      )

      // Hit test: check if near P1
      if (pointA) {
        const distA = distance(worldPoint, pointA)
        if (distA * viewport.zoom < handleSize * 1.5) {
          draggingHandle = 'p1'
          state = MeasurementState.DRAGGING_P1
          overlay.setHandleActive('distance-handle-p1', true)
          return true
        }
      }

      // Hit test: check if near P2
      if (pointB) {
        const distB = distance(worldPoint, pointB)
        if (distB * viewport.zoom < handleSize * 1.5) {
          draggingHandle = 'p2'
          state = MeasurementState.DRAGGING_P2
          overlay.setHandleActive('distance-handle-p2', true)
          return true
        }
      }

      return false
    },

    onDragMove(screenPoint: Point2D) {
      if (!draggingHandle) return

      const viewport = getViewport()
      const worldPoint = screenToWorld(
        { x: screenPoint.x, y: screenPoint.y },
        viewport
      )

      if (draggingHandle === 'p1' && pointA) {
        pointA = worldPoint
        updateMeasurement()
      } else if (draggingHandle === 'p2' && pointB) {
        pointB = worldPoint
        updateMeasurement()
      }
    },

    onDragEnd() {
      if (!draggingHandle) return

      if (draggingHandle === 'p1') {
        overlay.setHandleActive('distance-handle-p1', false)
      } else if (draggingHandle === 'p2') {
        overlay.setHandleActive('distance-handle-p2', false)
      }

      draggingHandle = null
      state = MeasurementState.COMPLETE
    },

    cancel() {
      clearMeasurement()
      pointA = null
      pointB = null
      result = null
      draggingHandle = null
      state = MeasurementState.IDLE
    },

    reset() {
      clearMeasurement()
      pointA = null
      pointB = null
      result = null
      draggingHandle = null
      state = MeasurementState.IDLE
    }
  }

  return self
}

// ============================================================================
// Viewport Helper
// ============================================================================

/**
 * Get viewport state from @mlightcad/cad-simple-viewer.
 * Call this in main.ts and pass to measurement manager.
 * 
 * @example
 * ```typescript
 * import { getViewerViewport } from '@mlightcad/entity-model'
 * 
 * const getViewport = () => getViewerViewport(AcApDocManager.instance)
 * const measurement = createDistanceMeasurement({ overlay, getViewport })
 * ```
 */
export function getViewerViewport(
  docManager: { 
    activeLayoutView?: { internalCamera?: { zoom?: number } },
    view?: { width?: number, height?: number, pan?: { x: number, y: number } }
  }
): ViewportState {
  const camera = docManager.activeLayoutView?.internalCamera
  const zoom = camera?.zoom ?? 1
  const view = docManager.view

  return {
    zoom,
    panX: view?.pan?.x ?? 0,
    panY: view?.pan?.y ?? 0,
    width: view?.width ?? 800,
    height: view?.height ?? 600
  }
}
