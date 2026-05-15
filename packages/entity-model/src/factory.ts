/**
 * CAD Entity Factory
 * 
 * Creates typed entity objects for future AI commands.
 * AI must only create safe typed commands - no direct canvas mutations.
 */

import {
  CadEntity,
  CadEntityType,
  CreateEntityOptions,
  EntityGeometry,
  LineGeometry,
  PolylineGeometry,
  CircleGeometry,
  ArcGeometry,
  TextGeometry,
  MTextGeometry,
  DimensionGeometry,
  BlockGeometry,
  BoundingBox,
  EntityMetadata,
  createBoundingBox
} from './types.js'

/** Generate unique entity ID */
function generateId(type: CadEntityType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Create entity from options */
export function createEntity(options: CreateEntityOptions): CadEntity {
  return {
    id: options.id ?? generateId(options.type),
    type: options.type,
    layer: options.layer,
    geometry: options.geometry,
    bbox: calculateBBox(options.type, options.geometry),
    metadata: options.metadata ?? {}
  }
}

/** Calculate bounding box from geometry */
function calculateBBox(type: CadEntityType, geometry: EntityGeometry): BoundingBox {
  switch (type) {
    case CadEntityType.Line: {
      const g = geometry as LineGeometry
      return createBoundingBox([g.start, g.end])
    }
    case CadEntityType.Polyline: {
      const g = geometry as PolylineGeometry
      return createBoundingBox(g.vertices)
    }
    case CadEntityType.Circle: {
      const g = geometry as CircleGeometry
      return {
        minX: g.center.x - g.radius,
        minY: g.center.y - g.radius,
        minZ: g.center.z,
        maxX: g.center.x + g.radius,
        maxY: g.center.y + g.radius,
        maxZ: g.center.z
      }
    }
    case CadEntityType.Arc: {
      const g = geometry as ArcGeometry
      return {
        minX: g.center.x - g.radius,
        minY: g.center.y - g.radius,
        minZ: g.center.z,
        maxX: g.center.x + g.radius,
        maxY: g.center.y + g.radius,
        maxZ: g.center.z
      }
    }
case CadEntityType.Text: {
      const g = geometry as TextGeometry
      const h = g.height
      return {
        minX: g.position.x,
        minY: g.position.y,
        minZ: g.position.z,
        maxX: g.position.x + g.text.length * h * 0.8,
        maxY: g.position.y + h,
        maxZ: g.position.z
      }
    }
    case CadEntityType.MText: {
      const g = geometry as MTextGeometry
      const h = g.height ?? 1
      return {
        minX: g.corner.x,
        minY: g.corner.y,
        minZ: g.corner.z,
        maxX: g.corner.x + (g.text?.length ?? 1) * h * 0.8,
        maxY: g.corner.y + h,
        maxZ: g.corner.z
      }
    }
    case CadEntityType.Dimension: {
      const g = geometry as DimensionGeometry
      return createBoundingBox([g.defPoint, g.dimPoint, g.arrowPoint])
    }
    case CadEntityType.Block:
    case CadEntityType.Insert: {
      const g = geometry as BlockGeometry
      const px = g.position.x
      const py = g.position.y
      const pz = g.position.z
      const scale = typeof g.scale === 'number' ? g.scale : (g.scale?.x ?? 1)
      return {
        minX: px - scale,
        minY: py - scale,
        minZ: pz - scale,
        maxX: px + scale,
        maxY: py + scale,
        maxZ: pz + scale
      }
    }
    default:
      return createBoundingBox([])
  }
}

// ============================================================================
// Typed Entity Creation Helpers (for AI commands)
// ============================================================================

export interface CreateLineCommand {
  type: 'create-line'
  layer: string
  start: { x: number; y: number; z?: number }
  end: { x: number; y: number; z?: number }
}

export interface CreatePolylineCommand {
  type: 'create-polyline'
  layer: string
  vertices: Array<{ x: number; y: number; z?: number }>
  closed?: boolean
}

export interface CreateCircleCommand {
  type: 'create-circle'
  layer: string
  center: { x: number; y: number; z?: number }
  radius: number
}

export interface CreateArcCommand {
  type: 'create-arc'
  layer: string
  center: { x: number; y: number; z?: number }
  radius: number
  startAngle: number // radians
  endAngle: number // radians
}

export interface CreateTextCommand {
  type: 'create-text'
  layer: string
  position: { x: number; y: number; z?: number }
  text: string
  height: number
  rotation?: number
}

export interface CreateDimensionCommand {
  type: 'create-dimension'
  layer: string
  defPoint: { x: number; y: number; z?: number }
  dimPoint: { x: number; y: number; z?: number }
  text?: string
}

export interface CreateBlockCommand {
  type: 'create-block'
  layer: string
  name: string
  position: { x: number; y: number; z?: number }
  rotation?: number
  scale?: number
}

/** Union of all typed entity commands */
export type EntityCommand =
  | CreateLineCommand
  | CreatePolylineCommand
  | CreateCircleCommand
  | CreateArcCommand
  | CreateTextCommand
  | CreateDimensionCommand
  | CreateBlockCommand

/** Validate entity command */
export function isValidEntityCommand(cmd: unknown): cmd is EntityCommand {
  if (!cmd || typeof cmd !== 'object') return false
  const c = cmd as Record<string, unknown>
  if (typeof c.type !== 'string') return false
  if (typeof c.layer !== 'string') return false
  return true
}

/** Execute entity command to create entity */
export function executeCommand(cmd: EntityCommand): CadEntity {
  switch (cmd.type) {
    case 'create-line': {
      return createEntity({
        type: CadEntityType.Line,
        layer: cmd.layer,
        geometry: {
          start: { x: cmd.start.x, y: cmd.start.y, z: cmd.start.z ?? 0 },
          end: { x: cmd.end.x, y: cmd.end.y, z: cmd.end.z ?? 0 }
        }
      })
    }
    case 'create-polyline': {
      return createEntity({
        type: CadEntityType.Polyline,
        layer: cmd.layer,
        geometry: {
          vertices: cmd.vertices.map(v => ({
            x: v.x,
            y: v.y,
            z: v.z ?? 0
          })),
          closed: cmd.closed
        }
      })
    }
    case 'create-circle': {
      return createEntity({
        type: CadEntityType.Circle,
        layer: cmd.layer,
        geometry: {
          center: { x: cmd.center.x, y: cmd.center.y, z: cmd.center.z ?? 0 },
          radius: cmd.radius
        }
      })
    }
    case 'create-arc': {
      return createEntity({
        type: CadEntityType.Arc,
        layer: cmd.layer,
        geometry: {
          center: { x: cmd.center.x, y: cmd.center.y, z: cmd.center.z ?? 0 },
          radius: cmd.radius,
          startAngle: cmd.startAngle,
          endAngle: cmd.endAngle
        }
      })
    }
    case 'create-text': {
      return createEntity({
        type: CadEntityType.Text,
        layer: cmd.layer,
        geometry: {
          position: { x: cmd.position.x, y: cmd.position.y, z: cmd.position.z ?? 0 },
          text: cmd.text,
          height: cmd.height,
          rotation: cmd.rotation
        }
      })
    }
    case 'create-dimension': {
      return createEntity({
        type: CadEntityType.Dimension,
        layer: cmd.layer,
        geometry: {
          defPoint: { x: cmd.defPoint.x, y: cmd.defPoint.y, z: cmd.defPoint.z ?? 0 },
          dimPoint: { x: cmd.dimPoint.x, y: cmd.dimPoint.y, z: cmd.dimPoint.z ?? 0 },
          arrowPoint: { x: cmd.defPoint.x, y: cmd.defPoint.y, z: cmd.defPoint.z ?? 0 },
          text: cmd.text
        }
      })
    }
    case 'create-block': {
      return createEntity({
        type: CadEntityType.Block,
        layer: cmd.layer,
        geometry: {
          name: cmd.name,
          position: { x: cmd.position.x, y: cmd.position.y, z: cmd.position.z ?? 0 },
          rotation: cmd.rotation,
          scale: cmd.scale
        }
      })
    }
    default:
      throw new Error(`Unknown entity command: ${(cmd as { type: string }).type}`)
  }
}

/** Validate and execute command safely - returns null on invalid */
export function safeExecuteCommand(cmd: unknown): CadEntity | null {
  if (!isValidEntityCommand(cmd)) {
    return null
  }
  try {
    return executeCommand(cmd)
  } catch {
    return null
  }
}
