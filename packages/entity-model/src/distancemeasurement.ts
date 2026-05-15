/**
 * Basic Two-Point Distance Measurement
 *
 * Mobile-first: tap Point A, tap Point B, show line/distance.
 * No snapping. No live preview after Point A on mobile. Fast response.
 * 
 * Uses:
 * - @mlightcad/cad-simple-viewer for CAD rendering (not mutated)
 * - Overlay manager for DOM rendering
 * - Geometry helpers for distance calculation
 */

import { Point2D, Point3D } from './types.js'
import { distance, worldToScreen, screenToWorld } from './geometry.js'
import { OverlayManager, MeasurementOverlay, ViewportState } from './overlay.js'

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
  COMPLETE = 'complete'
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
  /** Distance unit: 'mm' | 'cm' | 'm' | 'in' | 'ft' */
  unit?: 'mm' | 'cm' | 'm' | 'in' | 'ft'
  /** Distance precision (decimal places) */
  precision?: number
  /** Enable second tap immediately (no delay) */
  fastMode?: boolean
}

const defaultConfig: Partial<DistanceMeasurementConfig> = {
  unit: 'm',
  precision: 2,
  fastMode: true
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
  /** Cancel current measurement */
  cancel: () => void
  /** Reset for next measurement */
  reset: () => void
}

/** Create distance measurement manager */
export function createDistanceMeasurement(
  config: DistanceMeasurementConfig
): DistanceMeasurementManager {
  const { overlay, getViewport, onComplete } = {
    ...defaultConfig,
    ...config
  }

  let state: MeasurementState = MeasurementState.IDLE
  let pointA: Point3D | null = null
  let pointB: Point3D | null = null
  let result: DistanceMeasurementResult | null = null

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
    overlay.removeLabel('distance-label-a')
    overlay.removeLabel('distance-label-b')
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

        // Show Point A marker
        overlay.setLabel(
          'distance-label-a',
          pointA,
          'A',
          { color: '#2196F3', fontSize: 14 }
        )
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

        // Clear Point A marker
        overlay.removeLabel('distance-label-a')

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

        state = MeasurementState.COMPLETE

        // Callback
        if (onComplete) {
          onComplete(result)
        }

        // Auto-reset after short delay for fastMode
        if (config.fastMode) {
          setTimeout(() => {
            self.reset()
          }, 100)
        }
      }
    },

    cancel() {
      clearMeasurement()
      pointA = null
      pointB = null
      result = null
      state = MeasurementState.IDLE
    },

    reset() {
      clearMeasurement()
      pointA = null
      pointB = null
      result = null
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
  docManager: { activeLayoutView?: { internalCamera?: { zoom?: number } },
  view?: { width?: number, height?: number, pan?: { x: number, y: number } }
): ViewportState {
  const camera = docManager.activeLayoutView?.internalCamera
  const zoom = camera?.zoom ?? 1

  return {
    zoom,
    panX: view?.pan?.x ?? 0,
    panY: view?.pan?.y ?? 0,
    width: view?.width ?? 800,
    height: view?.height ?? 600
  }
}
