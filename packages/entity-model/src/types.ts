/**
 * CAD Entity Types
 * 
 * Supports: line, polyline, circle, arc, text, dimension, block/symbol
 * Future: selection, snapping, measurement, BOQ, AI commands
 */

/** Core entity type enumeration */
export enum CadEntityType {
  Line = 'LINE',
  Polyline = 'POLYLINE',
  Circle = 'CIRCLE',
  Arc = 'ARC',
  Text = 'TEXT',
  MText = 'MTEXT',
  Dimension = 'DIMENSION',
  Block = 'BLOCK',
  Insert = 'INSERT',
  Point = 'POINT',
  Ray = 'RAY',
  XLine = 'XLINE',
  Solid = 'SOLID',
  Trace = 'TRACE',
  Ellipse = 'ELLIPSE',
  Spline = 'SPLINE',
  Hatch = 'HATCH',
  Image = 'IMAGE',
  Wipeout = 'WIPEOUT'
}

/** Bounding box in world coordinates */
export interface BoundingBox {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

/** 2D/3D point */
export interface Point2D {
  x: number
  y: number
}

export interface Point3D {
  x: number
  y: number
  z: number
}

/** Line geometry */
export interface LineGeometry {
  start: Point3D
  end: Point3D
}

/** Polyline geometry (vertices) */
export interface PolylineGeometry {
  vertices: Point3D[]
  closed?: boolean
}

/** Circle geometry */
export interface CircleGeometry {
  center: Point3D
  radius: number
}

/** Arc geometry */
export interface ArcGeometry {
  center: Point3D
  radius: number
  startAngle: number // radians
  endAngle: number // radians
}

/** Text geometry */
export interface TextGeometry {
  position: Point3D
  text: string
  height: number
  rotation?: number // radians
  widthFactor?: number
  oblique?: number
}

/** MText (multiline text) geometry */
export interface MTextGeometry {
  corner: Point3D
  text: string
  width?: number
  height?: number
  rotation?: number
}

/** Dimension geometry */
export interface DimensionGeometry {
  defPoint: Point3D // definition point
  dimPoint: Point3D // dimension point
  arrowPoint: Point3D
  text?: string
  dimensionStyle?: string
}

/** Block/Symbol reference geometry */
export interface BlockGeometry {
  name: string
  position: Point3D
  rotation?: number
  scale?: number | Point3D
}

/** Geometry union type */
export type EntityGeometry =
  | LineGeometry
  | PolylineGeometry
  | CircleGeometry
  | ArcGeometry
  | TextGeometry
  | MTextGeometry
  | DimensionGeometry
  | BlockGeometry

/** Entity metadata for AI/automation */
export interface EntityMetadata {
  createdAt?: Date
  modifiedAt?: Date
  createdBy?: string
  modifiedBy?: string
  color?: number // AutoCAD color index
  linetype?: string
  lineWeight?: number
  plotStyle?: string
  material?: string
  // AI-specific fields for future use
  aiTags?: string[]
  aiConfidence?: number
  aiCategory?: string
}

/** Core CAD Entity Model */
export interface CadEntity {
  /** Unique entity identifier */
  id: string
  /** CAD entity type */
  type: CadEntityType
  /** Layer name */
  layer: string
  /** Object ID from CAD database */
  objectId?: string
  /** Geometry data */
  geometry: EntityGeometry
  /** World bounding box */
  bbox: BoundingBox
  /** Extended metadata */
  metadata: EntityMetadata
}

/** Entity creation options */
export interface CreateEntityOptions {
  id?: string
  type: CadEntityType
  layer: string
  geometry: EntityGeometry
  metadata?: Partial<EntityMetadata>
}

/** Utility: Create bounding box from points */
export function createBoundingBox(points: Point3D[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 }
  }
  
  let minX = points[0].x
  let minY = points[0].y
  let minZ = points[0].z
  let maxX = points[0].x
  let maxY = points[0].y
  let maxZ = points[0].z
  
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.z < minZ) minZ = p.z
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
    if (p.z > maxZ) maxZ = p.z
  }
  
  return { minX, minY, minZ, maxX, maxY, maxZ }
}

/** Utility: Check if point is inside bounding box */
export function isPointInBBox(point: Point3D, bbox: BoundingBox): boolean {
  return (
    point.x >= bbox.minX &&
    point.x <= bbox.maxX &&
    point.y >= bbox.minY &&
    point.y <= bbox.maxY &&
    point.z >= bbox.minZ &&
    point.z <= bbox.maxZ
  )
}

/** Utility: Check if bounding boxes intersect */
export function doBBoxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY &&
    a.minZ <= b.maxZ &&
    a.maxZ >= b.minZ
  )
}

/** Utility: Get bounding box center */
export function getBBoxCenter(bbox: BoundingBox): Point3D {
  return {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
    z: (bbox.minZ + bbox.maxZ) / 2
  }
}

/** Utility: Get bounding box diagonal length */
export function getBBoxDiagonal(bbox: BoundingBox): number {
  const dx = bbox.maxX - bbox.minX
  const dy = bbox.maxY - bbox.minY
  const dz = bbox.maxZ - bbox.minZ
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
