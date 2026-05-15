/**
 * Overlay + Command Engine Integration
 * 
 * Connects command execution to overlay rendering.
 * Does NOT touch viewer - uses overlay for UI feedback.
 */

import { 
  CadCommandType, 
  CommandContext, 
  CommandResult,
  ViewportCommand,
  executeStoreCommand,
  MeasurementResult 
} from './command-engine.js'
import { EntityStore } from './store.js'

import {
  OverlayManager,
  ViewportState,
  createOverlayManager
} from './overlay.js'

import { Point3D, BoundingBox } from './types.js'

// ============================================================================
// Integration Types
// ============================================================================

/** Integration configuration */
export interface OverlayCommandIntegrationConfig {
  /** Entity store */
  store: EntityStore
  /** Overlay manager */
  overlay: OverlayManager
  /** Get current viewport state */
  getViewport: () => ViewportState
}

/** Sync options */
export interface OverlaySyncOptions {
  /** Show handles for selected entities */
  showHandles?: boolean
  /** Show measurement on measure command */
  showMeasurement?: boolean
  /** Clear overlays before sync */
  clearFirst?: boolean
}

// ============================================================================
// Integration Class
// ============================================================================

/** Integrates command execution with overlay rendering */
export class OverlayCommandIntegration {
  private _store: EntityStore
  private _overlay: OverlayManager
  private _getViewport: () => ViewportState

  constructor(config: OverlayCommandIntegrationConfig) {
    this._store = config.store
    this._overlay = config.overlay
    this._getViewport = config.getViewport
  }

  // ============================================================================
  // Command Execution with Overlay
  // ============================================================================

/** Execute command and sync overlay */
  executeAndSync(
    command: CadCommandType,
    context: Omit<CommandContext, 'syncOptions'> & { syncOptions?: OverlaySyncOptions }
  ): { success: boolean; error?: string } {
    // Clear overlays if requested
    if (context.syncOptions?.clearFirst) {
      this._overlay.clear()
    }

    // Execute command
    const result = executeStoreCommand(context, command)

    if (!result.success) {
      return { success: false, error: result.error }
    }

    // Sync overlays based on command type
    if (result.viewport) {
      this._syncViewport(result.viewport)
    }

    if (result.measurement) {
      this._syncMeasurement(result.measurement)
    }

    // Sync selection handles
    if (result.store) {
      this._store = result.store
      this._syncSelectionHandles()
    }

    return { success: true }
  }

  // ============================================================================
  // Viewport Sync
  // ============================================================================

  /** Sync viewport changes to overlay */
  private _syncViewport(viewport: { zoom?: number; panX?: number; panY?: number }): void {
    const current = this._overlay.getViewport()
    this._overlay.setViewport({
      ...current,
      ...viewport
    })
  }

  // ============================================================================
  // Measurement Sync
  // ============================================================================

/** Sync measurement to overlay */
  private _syncMeasurement(measurement: MeasurementResult): void {
    if (!measurement.point1 || !measurement.point2) return

    this._overlay.setMeasurement(
      'command-measurement',
      measurement.point1,
      measurement.point2,
      measurement.distance,
      {
        label: measurement.label
      }
    )
  }

  // ============================================================================
  // Selection Handles
  // ============================================================================

  /** Sync selection to handles */
  private _syncSelectionHandles(): void {
    const selected = this._store.getSelected()

    // Clear existing handles
    this._overlay.clearByType('handle')

    // Add handles for selected entities
    for (const entity of selected) {
      if (entity.bbox) {
        const center = this._bboxCenter(entity.bbox)
        this._overlay.setHandle(
          `handle-${entity.id}`,
          center,
          {
            shape: 'circle',
            color: '#2196F3'
          }
        )
      }
    }
  }

  // ============================================================================
  // Direct Overlay Operations
  // ============================================================================

  /** Show entity in overlay */
  showEntity(entityId: string): void {
    const entity = this._store.get(entityId)
    if (!entity) return

    if (entity.bbox) {
      const center = this._bboxCenter(entity.bbox)
      this._overlay.setHandle(
        `handle-${entityId}`,
        center,
        { shape: 'circle', color: '#2196F3' }
      )
    }
  }

  /** Hide entity from overlay */
  hideEntity(entityId: string): void {
    this._overlay.removeHandle(`handle-${entityId}`)
  }

  /** Highlight entities in overlay */
  highlightEntities(entityIds: string[]): void {
    for (const id of entityIds) {
      this.showEntity(id)
    }
  }

  /** Clear highlights */
  clearHighlights(): void {
    this._overlay.clearByType('handle')
  }

  /** Show measurement */
  showMeasurementOverlay(
    start: Point3D,
    end: Point3D,
    distance: number,
    label?: string
  ): void {
    this._overlay.setMeasurement(
      'measurement',
      start,
      end,
      distance,
      { label }
    )
  }

  /** Hide measurement */
  hideMeasurementOverlay(): void {
    this._overlay.removeMeasurement('measurement')
  }

  // ============================================================================
  // Helpers
  // ============================================================================

/** Get bounding box center */
  private _bboxCenter(bbox: BoundingBox): Point3D {
    return {
      x: (bbox.minX + bbox.maxX) / 2,
      y: (bbox.minY + bbox.maxY) / 2,
      z: (bbox.minZ + bbox.maxZ) / 2
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/** Create overlay command integration */
export function createOverlayCommandIntegration(
  config: OverlayCommandIntegrationConfig
): OverlayCommandIntegration {
  return new OverlayCommandIntegration(config)
}

// ============================================================================
// Convenience: Build Full Integration
// ============================================================================

/** Full integration options */
export interface FullIntegrationOptions {
  /** DOM container for overlays */
  container: HTMLElement
  /** Initial viewport getter */
  getViewport: () => ViewportState
}

/** Build full integration from scratch */
export function buildFullIntegration(
  options: FullIntegrationOptions
): {
  store: EntityStore
  overlay: OverlayManager
  integration: OverlayCommandIntegration
} {
  // Create overlay
  const overlay = createOverlayManager({
    container: options.container
  })

  // Set initial viewport
  overlay.setViewport(options.getViewport())

  // Create store
  const store = new EntityStore()

  // Create integration
  const integration = new OverlayCommandIntegration({
    store,
    overlay,
    getViewport: options.getViewport
  })

  return { store, overlay, integration }
}
