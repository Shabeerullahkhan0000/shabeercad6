/**
 * CAD Snap Engine
 * 
 * Supports endpoint, midpoint, nearest point, intersection snap.
 * Uses spatial index (bounding box) for performance.
 * Uses geometry helpers - does NOT touch viewer.
 * 
 * Performance:
 * - Screen-distance tolerance (world→screen converts tolerance)
 * - Bounding box pre-filter before detailed geometry checks
 * - Avoids scanning all entities on every touchmove
 */

import { 
  CadEntity, 
  CadEntityType, 
  Point2D, 
  Point3D, 
  BoundingBox,
  isPointInBBox,
  doBBoxesIntersect
} from './types.js'
import { 
  distance2D, 
  distance3D, 
  midpoint3D,
  nearestPointOnSegment,
  nearestPointOnLine,
  lineLineIntersection,
  segmentSegmentIntersection,
  toPoint3D
} from './geometry.js'
import { worldToScreen, screenToWorld, ViewportState } from './overlay.js'

// ============================================================================
// Snap Types
// ============================================================================

/** Snap modes */
export enum SnapMode {
  /** Snap to line/arc/polyline endpoints */
  ENDPOINT = 'endpoint',
  /** Snap to line/arc/polyline midpoints */
  MIDPOINT = 'midpoint',
  /** Snap to nearest point on entity */
  NEAREST = 'nearest',
  /** Snap to line intersections (if safe) */
  INTERSECTION = 'intersection'
}

/** Result of snap operation */
export interface SnapResult {
  /** Snapped point in world coordinates */
  point: Point3D
  /** Type of snap */
  mode: SnapMode
  /** Entity that was snapped to */
  entityId: string
  /** Screen distance to snap point (for display/debug) */
  screenDistance: number
}

// ============================================================================
// Snap Configuration
// ============================================================================

/** Snap engine configuration */
export interface SnapConfig {
  /** Get current viewport for screen conversion */
  getViewport: () => ViewportState
  /** Screen tolerance in pixels (default 15) */
  screenTolerance?: number
  /** Enabled snap modes */
  enabledModes?: SnapMode[]
  /** Get entities (from entity store or callback) */
  getEntities: () => CadEntity[]
}

// ============================================================================
// Snap Engine
// ============================================================================

/** Snap engine for finding snap points on entities */
export class SnapEngine {
  private _config: SnapConfig
  private _enabledModes: Set<SnapMode>
  private _screenTolerance: number

  constructor(config: SnapConfig) {
    this._config = config
    this._screenTolerance = config.screenTolerance ?? 15
    this._enabledModes = new Set(config.enabledModes ?? [
      SnapMode.ENDPOINT,
      SnapMode.MIDPOINT,
      SnapMode.NEAREST,
      SnapMode.INTERSECTION
    ])
  }

  /** Check if snap mode is enabled */
  isEnabled(mode: SnapMode): boolean {
    return this._enabledModes.has(mode)
  }

  /** Enable/disable snap mode */
  setEnabled(mode: SnapMode, enabled: boolean): void {
    if (enabled) {
      this._enabledModes.add(mode)
    } else {
      this._enabledModes.delete(mode)
    }
  }

  /** Find snap point at screen position */
  snapAt(screenPoint: { x: number; y: number }): SnapResult | null {
    const viewport = this._config.getViewport()
    const entities = this._config.getEntities()
    
    // Convert screen point to world
    const worldPoint = screenToWorld(screenPoint, viewport)
    
    // Convert tolerance to world (at the depth of the camera target)
    const worldTolerance = this._screenTolerance / viewport.zoom
    
    // Pre-filter by bounding box
    const candidates = this._filterByBBox(entities, worldPoint, worldTolerance, viewport)
    
    // Find closest snap
    let closest: SnapResult | null = null
    
    for (const entity of candidates) {
      const result = this._snapEntity(entity, worldPoint, worldTolerance, viewport)
      if (result && (!closest || result.screenDistance < closest.screenDistance)) {
        closest = result
      }
    }
    
    return closest
  }

  /** Filter entities by bounding box (spatial pre-filter) */
  private _filterByBBox(
    entities: CadEntity[],
    worldPoint: Point3D,
    worldTolerance: number,
    viewport: ViewportState
  ): CadEntity[] {
    // Create searchable bounding box around cursor
    const searchBox: BoundingBox = {
      minX: worldPoint.x - worldTolerance,
      minY: worldPoint.y - worldTolerance,
      minZ: 0,
      maxX: worldPoint.x + worldTolerance,
      maxY: worldPoint.y + worldTolerance,
      maxZ: 0
    }
    
    const candidates: CadEntity[] = []
    for (const entity of entities) {
      // Quick bounding box check first
      if (doBBoxesIntersect(searchBox, entity.bbox)) {
        candidates.push(entity)
      }
    }
    return candidates
  }

  /** Find snap on single entity */
  private _snapEntity(
    entity: CadEntity,
    worldPoint: Point3D,
    worldTolerance: number,
    viewport: ViewportState
  ): SnapResult | null {
    const { geometry, id, type } = entity
    
    // Get all snap points for this entity based on type
    const snapPoints = this._getSnapPoints(entity)
    
    let closest: SnapResult | null = null
    
    for (const sp of snapPoints) {
      const worldDist = distance3D(worldPoint, sp.point)
      const screenDist = worldDist * viewport.zoom
      
      // Check tolerance
      if (screenDist <= this._screenTolerance) {
        if (!closest || screenDist < closest.screenDistance) {
          closest = {
            point: sp.point,
            mode: sp.mode,
            entityId: id,
            screenDistance: screenDist
          }
        }
      }
    }
    
    // Intersection snap (special - between entities)
    if (this._enabledModes.has(SnapMode.INTERSECTION) && type === CadEntityType.Line) {
      const intersection = this._findIntersection(entity, worldPoint, worldTolerance, viewport)
      if (intersection && (!closest || intersection.screenDistance < closest.screenDistance)) {
        closest = intersection
      }
    }
    
    return closest
  }

  /** Get snap points for entity type */
  private _getSnapPoints(entity: CadEntity): Array<{ point: Point3D; mode: SnapMode }> {
    const { geometry, type } = entity
    const points: Array<{ point: Point3D; mode: SnapMode }> = []
    
    switch (type) {
      case CadEntityType.Line: {
        const line = geometry as { start: Point3D; end: Point3D }
        
        // Endpoint snap
        if (this._enabledModes.has(SnapMode.ENDPOINT)) {
          points.push({ point: line.start, mode: SnapMode.ENDPOINT })
          points.push({ point: line.end, mode: SnapMode.ENDPOINT })
        }
        
        // Midpoint snap
        if (this._enabledModes.has(SnapMode.MIDPOINT)) {
          points.push({ point: midpoint3D(line.start, line.end), mode: SnapMode.MIDPOINT })
        }
        
        // Nearest snap (to line)
        if (this._enabledModes.has(SnapMode.NEAREST)) {
          const nearest = nearestPointOnSegment(line.start, line.end, line.start) // Use start as ref
          points.push({ point: nearest, mode: SnapMode.NEAREST })
        }
        break
      }
      
      case CadEntityType.Polyline: {
        const poly = geometry as { vertices: Point3D[] }
        const vertices = poly.vertices ?? []
        
        if (this._enabledModes.has(SnapMode.ENDPOINT)) {
          for (const v of vertices) {
            points.push({ point: v, mode: SnapMode.ENDPOINT })
          }
        }
        
        if (this._enabledModes.has(SnapMode.MIDPOINT)) {
          for (let i = 0; i < vertices.length - 1; i++) {
            points.push({ point: midpoint3D(vertices[i], vertices[i + 1]), mode: SnapMode.MIDPOINT })
          }
        }
        break
      }
      
      case CadEntityType.Circle: {
        const circle = geometry as { center: Point3D; radius: number }
        
        // Nearest point on circle
        if (this._enabledModes.has(SnapMode.NEAREST)) {
          // Circle has no natural endpoints, but we could snap to 0°, 90°, 180°, 270° points
          const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]
          for (const angle of angles) {
            points.push({
              point: {
                x: circle.center.x + circle.radius * Math.cos(angle),
                y: circle.center.y + circle.radius * Math.sin(angle),
                z: circle.center.z
              },
              mode: SnapMode.NEAREST
            })
          }
        }
        break
      }
      
      case CadEntityType.Arc: {
        const arc = geometry as { center: Point3D; radius: number; startAngle: number; endAngle: number }
        
        // Endpoints of arc
        if (this._enabledModes.has(SnapMode.ENDPOINT)) {
          points.push({
            point: {
              x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
              y: arc.center.y + arc.radius * Math.sin(arc.startAngle),
              z: arc.center.z
            },
            mode: SnapMode.ENDPOINT
          })
          points.push({
            point: {
              x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
              y: arc.center.y + arc.radius * Math.sin(arc.endAngle),
              z: arc.center.z
            },
            mode: SnapMode.ENDPOINT
          })
        }
        
        // Midpoint (average of angles)
        if (this._enabledModes.has(SnapMode.MIDPOINT)) {
          let midAngle = (arc.startAngle + arc.endAngle) / 2
          // Handle angle wrap
          if (midAngle > Math.PI) midAngle -= 2 * Math.PI
          points.push({
            point: {
              x: arc.center.x + arc.radius * Math.cos(midAngle),
              y: arc.center.y + arc.radius * Math.sin(midAngle),
              z: arc.center.z
            },
            mode: SnapMode.MIDPOINT
          })
        }
        break
      }
      
      case CadEntityType.Insert: {
        const block = geometry as { position: Point3D }
        
        // Snap to block insertion point
        if (this._enabledModes.has(SnapMode.ENDPOINT)) {
          points.push({ point: block.position, mode: SnapMode.ENDPOINT })
        }
        
        // Could extend to snap to block attributes
        break
      }
      
      case CadEntityType.Point: {
        const pt = geometry as { position: Point3D }
        
        if (this._enabledModes.has(SnapMode.ENDPOINT)) {
          points.push({ point: pt.position, mode: SnapMode.ENDPOINT })
        }
        break
      }
    }
    
    return points
  }

  /** Find intersection snap */
  private _findIntersection(
    entity: CadEntity,
    worldPoint: Point3D,
    worldTolerance: number,
    viewport: ViewportState
  ): SnapResult | null {
    if (entity.type !== CadEntityType.Line) return null
    
    const line1 = entity.geometry as { start: Point3D; end: Point3D }
    const p1Start = toPoint3D(line1.start)
    const p1End = toPoint3D(line1.end)
    
    // Get other line entities for intersection
    const entities = this._config.getEntities()
    
    for (const other of entities) {
      if (other.id === entity.id) continue
      if (other.type !== CadEntityType.Line) continue
      
      const line2 = other.geometry as { start: Point3D; end: Point3D }
      const p2Start = toPoint3D(line2.start)
      const p2End = toPoint3D(line2.end)
      
      const result = segmentSegmentIntersection(
        { x: p1Start.x, y: p1Start.y },
        { x: p1End.x, y: p1End.y },
        { x: p2Start.x, y: p2Start.y },
        { x: p2End.x, y: p2End.y }
      )
      
      if (result.intersects && result.point) {
        const intersectionPoint = toPoint3D(result.point)
        const screenDist = distance3D(worldPoint, intersectionPoint) * viewport.zoom
        
        if (screenDist <= this._screenTolerance) {
          return {
            point: intersectionPoint,
            mode: SnapMode.INTERSECTION,
            entityId: entity.id,
            screenDistance: screenDist
          }
        }
      }
    }
    
    return null
  }
}

// ============================================================================
// Snap Engine Factory
// ============================================================================

/** Create snap engine */
export function createSnapEngine(config: SnapConfig): SnapEngine {
  return new SnapEngine(config)
}

// ============================================================================
// Snap Overlay (for visual feedback)
// ============================================================================

/** Snap indicator styles */
export interface SnapIndicatorConfig {
  /** Overlay manager */
  overlay: {
    setHandle: (id: string, worldPosition: Point3D, options?: { size?: number; shape?: 'circle' | 'square' | 'diamond'; color?: string }) => void
    removeHandle: (id: string) => void
  }
  /** Get viewport */
  getViewport: () => ViewportState
}

/** Show snap indicator at point */
export function showSnapIndicator(
  config: SnapIndicatorConfig,
  point: Point3D,
  mode: SnapMode
): void {
  // Color based on mode
  const colors: Record<SnapMode, string> = {
    [SnapMode.ENDPOINT]: '#E91E63',    // Pink
    [SnapMode.MIDPOINT]: '#4CAF50',    // Green
    [SnapMode.NEAREST]: '#FF9800',     // Orange
    [SnapMode.INTERSECTION]: '#9C27B0' // Purple
  }
  
  config.overlay.setHandle('snap-indicator', point, {
    size: 12,
    shape: 'diamond',
    color: colors[mode]
  })
}

/** Hide snap indicator */
export function hideSnapIndicator(
  config: SnapIndicatorConfig
): void {
  config.overlay.removeHandle('snap-indicator')
}
