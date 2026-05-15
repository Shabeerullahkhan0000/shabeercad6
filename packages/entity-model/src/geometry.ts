/**
 * Lightweight Geometry Helpers
 * 
 * Pure, fast, typed, testable functions.
 * Does NOT touch viewer, upload, or UI.
 */

import { Point2D, Point3D, BoundingBox } from './types.js'

// ============================================================================
// Distance Functions
// ============================================================================

/** 2D distance between two points */
export function distance2D(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** 3D distance between two points */
export function distance3D(a: Point3D, b: Point3D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Distance between points (3D with default z=0 for 2D) */
export function distance(a: Point2D | Point3D, b: Point2D | Point3D): number {
  const a3 = toPoint3D(a)
  const b3 = toPoint3D(b)
  return distance3D(a3, b3)
}

// ============================================================================
// Midpoint Functions
// ============================================================================

/** 2D midpoint between two points */
export function midpoint2D(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** 3D midpoint between two points */
export function midpoint3D(a: Point3D, b: Point3D): Point3D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
}

/** Midpoint between points */
export function midpoint(a: Point2D | Point3D, b: Point2D | Point3D): Point2D | Point3D {
  if ('z' in a && 'z' in b) {
    return midpoint3D(a as Point3D, b as Point3D)
  }
  return midpoint2D(a as Point2D, b as Point2D)
}

// ============================================================================
// Angle Functions
// ============================================================================

/** Angle of vector in radians (from positive X axis, counterclockwise) */
export function angleOfVector(v: Point2D): number {
  return Math.atan2(v.y, v.x)
}

/** Angle between two vectors in radians */
export function angleBetweenVectors(a: Point2D, b: Point2D): number {
  const dot = a.x * b.x + a.y * b.y
  const cross = a.x * b.y - a.y * b.x
  return Math.atan2(cross, dot)
}

/** Angle from point A to B in radians */
export function angleFromTo(a: Point2D, b: Point2D): number {
  return Math.atan2(b.y - a.y, b.x - a.x)
}

/** Convert radians to degrees */
export function radToDeg(rad: number): number {
  return rad * (180 / Math.PI)
}

/** Convert degrees to radians */
export function degToRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// ============================================================================
// Nearest Point Functions
// ============================================================================

/** Nearest point on infinite line defined by two points */
export function nearestPointOnLine(lineStart: Point3D, lineEnd: Point3D, point: Point3D): Point3D {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const dz = lineEnd.z - lineStart.z
  
  const lenSq = dx * dx + dy * dy + dz * dz
  if (lenSq === 0) return { ...lineStart }
  
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy + (point.z - lineStart.z) * dz) / lenSq
  
  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
    z: lineStart.z + t * dz
  }
}

/** Nearest point on line segment */
export function nearestPointOnSegment(start: Point3D, end: Point3D, point: Point3D): Point3D {
  const nearest = nearestPointOnLine(start, end, point)
  return clampPointToSegment(nearest, start, end)
}

/** Clamp point to segment bounds */
function clampPointToSegment(point: Point3D, start: Point3D, end: Point3D): Point3D {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dz = end.z - start.z
  
  const lenSq = dx * dx + dy * dy + dz * dz
  if (lenSq === 0) return { ...start }
  
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) / lenSq
  
  if (t <= 0) return { ...start }
  if (t >= 1) return { ...end }
  
  return { x: start.x + t * dx, y: start.y + t * dy, z: start.z + t * dz }
}

/** Nearest point on circle (in XY plane, z ignored) */
export function nearestPointOnCircle(center: Point2D, radius: number, point: Point2D): Point2D {
  if (radius <= 0) return { ...center }
  
  const dx = point.x - center.x
  const dy = point.y - center.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  
  if (dist === 0) return { x: center.x + radius, y: center.y }
  
  return {
    x: center.x + (dx / dist) * radius,
    y: center.y + (dy / dist) * radius
  }
}

// ============================================================================
// Line Intersection Functions
// ============================================================================

/** Result of line intersection */
export interface LineIntersection {
  /** Whether lines intersect */
  intersects: boolean
  /** Intersection point (undefined if parallel or identical) */
  point?: Point2D
  /** Is it a proper intersection (not endpoint touch) */
  proper?: boolean
}

/** Find intersection of two infinite lines (2D) */
export function lineLineIntersection(
  a1: Point2D, a2: Point2D,
  b1: Point2D, b2: Point2D
): LineIntersection {
  const dx1 = a2.x - a1.x
  const dy1 = a2.y - a1.y
  const dx2 = b2.x - b1.x
  const dy2 = b2.y - b1.y
  
  const denom = dx1 * dy2 - dy1 * dx2
  
  // Parallel lines
  if (Math.abs(denom) < 1e-10) {
    return { intersects: false, proper: false }
  }
  
  const t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denom
  const u = ((b1.x - a1.x) * dy1 - (b1.y - a1.y) * dx1) / denom
  
  const point: Point2D = {
    x: a1.x + t * dx1,
    y: a1.y + t * dy1
  }
  
  // Check if intersection is at endpoints
  const isProper = t > 1e-10 && t < 1 - 1e-10 && u > 1e-10 && u < 1 - 1e-10
  
  return {
    intersects: true,
    point,
    proper: isProper
  }
}

/** Find intersection of two line segments (2D) */
export function segmentSegmentIntersection(
  a1: Point2D, a2: Point2D,
  b1: Point2D, b2: Point2D
): LineIntersection {
  const result = lineLineIntersection(a1, a2, b1, b2)
  
  if (!result.intersects || !result.point) {
    return { intersects: false, proper: false }
  }
  
  // Check if intersection is within both segments
  const point = result.point
  const isOnA = isPointOnSegment2D(point, a1, a2)
  const isOnB = isPointOnSegment2D(point, b1, b2)
  
  if (isOnA && isOnB) {
    return { intersects: true, point, proper: result.proper }
  }
  
  return { intersects: false, proper: false }
}

/** Check if point is on segment (with tolerance) */
function isPointOnSegment2D(point: Point2D, start: Point2D, end: Point2D): boolean {
  const tolerance = 1e-10
  const d1 = distance2D(point, start)
  const d2 = distance2D(point, end)
  const segLen = distance2D(start, end)
  return Math.abs(d1 + d2 - segLen) < tolerance
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Convert Point2D to Point3D (z = 0) */
export function toPoint3D(p: Point2D | Point3D): Point3D {
  if ('z' in p) return p as Point3D
  return { x: p.x, y: p.y, z: 0 }
}

/** Normalize 2D vector */
export function normalize2D(v: Point2D): Point2D {
  const len = Math.sqrt(v.x * v.x + v.y * v.y)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

/** Normalize 3D vector */
export function normalize3D(v: Point3D): Point3D {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (len === 0) return { x: 0, y: 0, z: 0 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

/** Scale 2D vector */
export function scale2D(v: Point2D, s: number): Point2D {
  return { x: v.x * s, y: v.y * s }
}

/** Scale 3D vector */
export function scale3D(v: Point3D, s: number): Point3D {
  return { x: v.x * s, y: v.y * s, z: v.z * s }
}

/** Add vectors */
export function add2D(a: Point2D, b: Point2D): Point2D {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function add3D(a: Point3D, b: Point3D): Point3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

/** Subtract vectors */
export function subtract2D(a: Point2D, b: Point2D): Point2D {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function subtract3D(a: Point3D, b: Point3D): Point3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

/** Dot product */
export function dot2D(a: Point2D, b: Point2D): number {
  return a.x * b.x + a.y * b.y
}

export function dot3D(a: Point3D, b: Point3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/** Cross product (2D returns scalar) */
export function cross2D(a: Point2D, b: Point2D): number {
  return a.x * b.y - a.y * b.x
}

/** Magnitude of 2D vector */
export function magnitude2D(v: Point2D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y)
}

/** Magnitude of 3D vector */
export function magnitude3D(v: Point3D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}
