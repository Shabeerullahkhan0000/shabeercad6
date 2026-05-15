/**
 * CAD Overlay System
 * 
 * Renders measurements, labels, handles on top of viewer.
 * Uses DOM overlay (not canvas) for mobile-friendly rendering.
 * 
 * Does NOT mutate viewer - purely overlay layer.
 */

import { Point3D } from './types.js'

// ============================================================================
// Overlay Types
// ============================================================================

/** Overlay element types */
export type OverlayElementType = 
  | 'label' 
  | 'measurement' 
  | 'handle' 
  | 'tooltip'

/** Overlay element base */
export interface OverlayElement {
  id: string
  type: OverlayElementType
  screenPosition: { x: number; y: number }
  visible: boolean
}

/** Label overlay */
export interface LabelOverlay extends OverlayElement {
  type: 'label'
  text: string
  color?: string
  fontSize?: number
}

/** Measurement overlay */
export interface MeasurementOverlay extends OverlayElement {
  type: 'measurement'
  distance: number
  start: { x: number; y: number }
  end: { x: number; y: number }
  label?: string
  precision?: number
  unit?: 'mm' | 'cm' | 'm' | 'in' | 'ft'
  showArrow?: boolean
}

/** Handle overlay (for editing) */
export interface HandleOverlay extends OverlayElement {
  type: 'handle'
  size: number
  shape: 'circle' | 'square' | 'diamond'
  color?: string
  active?: boolean
}

/** Tooltip overlay */
export interface TooltipOverlay extends OverlayElement {
  type: 'tooltip'
  text: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

/** All overlay elements */
export type OverlayElementData = 
  | LabelOverlay 
  | MeasurementOverlay 
  | HandleOverlay 
  | TooltipOverlay

// ============================================================================
// World to Screen Transform
// ============================================================================

/** Viewport state for coordinate transform */
export interface ViewportState {
  /** Camera zoom level */
  zoom: number
  /** Camera pan offset X */
  panX: number
  /** Camera pan offset Y */
  panY: number
  /** Container dimensions (CSS pixels) */
  width: number
  height: number
  /** Device pixel ratio for high-DPI screens */
  devicePixelRatio?: number
}

/** Convert world point to screen coordinates (CSS pixels) */
export function worldToScreen(
  worldPoint: Point3D,
  viewport: ViewportState
): { x: number; y: number } {
  const dpr = viewport.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1)
  return {
    x: ((worldPoint.x * viewport.zoom) + viewport.panX + (viewport.width / 2)) / dpr,
    y: ((-worldPoint.y * viewport.zoom) + viewport.panY + (viewport.height / 2)) / dpr
  }
}

/** Convert screen point to world coordinates */
export function screenToWorld(
  screenPoint: { x: number; y: number },
  viewport: ViewportState
): Point3D {
  return {
    x: (screenPoint.x - viewport.panX - (viewport.width / 2)) / viewport.zoom,
    y: (-screenPoint.y - viewport.panY - (viewport.height / 2)) / viewport.zoom,
    z: 0
  }
}

// ============================================================================
// Overlay Manager
// ============================================================================

/** Overlay manager configuration */
export interface OverlayManagerConfig {
  /** DOM container for overlays */
  container: HTMLElement
  /** CSS class prefix */
  classPrefix?: string
}

/** Manages DOM overlays on top of viewer */
export class OverlayManager {
  private _container: HTMLElement
  private _prefix: string
  private _elements: Map<string, OverlayElementData>
  private _viewport: ViewportState

  constructor(config: OverlayManagerConfig) {
    this._container = config.container
    this._prefix = config.classPrefix ?? 'cad-overlay'
    this._elements = new Map()
    this._viewport = { zoom: 1, panX: 0, panY: 0, width: 0, height: 0 }
    
    this._initContainer()
  }

/** Initialize container styles for mobile drag performance */
  private _initContainer(): void {
    this._container.style.position = 'relative'
    this._container.style.pointerEvents = 'none'
    // GPU acceleration for smooth drag
    this._container.style.willChange = 'transform'
    // Prevent iOS Safari rubber-banding
    this._container.style.overscrollBehavior = 'none'
  }

  /** Set viewport state for transforms */
  setViewport(viewport: ViewportState): void {
    this._viewport = viewport
  }

  /** Get current viewport */
  getViewport(): ViewportState {
    return { ...this._viewport }
  }

  // ============================================================================
  // Label Operations
  // ============================================================================

  /** Add or update label */
  setLabel(
    id: string,
    worldPosition: Point3D,
    text: string,
    options?: { color?: string; fontSize?: number }
  ): void {
    const screenPos = worldToScreen(worldPosition, this._viewport)
    
    const label: LabelOverlay = {
      id,
      type: 'label',
      screenPosition: screenPos,
      text,
      color: options?.color,
      fontSize: options?.fontSize,
      visible: true
    }
    
    this._elements.set(id, label)
    this._renderElement(label)
  }

  /** Remove label */
  removeLabel(id: string): void {
    this._elements.delete(id)
    this._removeElement(id)
  }

  // ============================================================================
  // Measurement Operations
  // ============================================================================

  /** Add or update measurement */
  setMeasurement(
    id: string,
    startWorld: Point3D,
    endWorld: Point3D,
    distance: number,
    options?: { label?: string; precision?: number; unit?: 'mm' | 'cm' | 'm' | 'in' | 'ft' }
  ): void {
    const startScreen = worldToScreen(startWorld, this._viewport)
    const endScreen = worldToScreen(endWorld, this._viewport)
    
    // Format distance with unit
    const formatted = this._formatDistance(distance, options?.precision, options?.unit)
    
    // Calculate midpoint for label
    const midScreen = {
      x: (startScreen.x + endScreen.x) / 2,
      y: (startScreen.y + endScreen.y) / 2
    }
    
    const measurement: MeasurementOverlay = {
      id,
      type: 'measurement',
      screenPosition: midScreen,
      start: startScreen,
      end: endScreen,
      distance,
      label: options?.label ?? formatted,
      precision: options?.precision ?? 2,
      unit: options?.unit ?? 'm',
      showArrow: true,
      visible: true
    }
    
    this._elements.set(id, measurement)
    this._renderElement(measurement)
  }

  /** Remove measurement */
  removeMeasurement(id: string): void {
    this._elements.delete(id)
    this._removeElement(id)
  }

  // ============================================================================
  // Handle Operations
  // ============================================================================

  /** Add or update handle */
  setHandle(
    id: string,
    worldPosition: Point3D,
    options?: { size?: number; shape?: 'circle' | 'square' | 'diamond'; color?: string }
  ): void {
    const screenPos = worldToScreen(worldPosition, this._viewport)
    
    const handle: HandleOverlay = {
      id,
      type: 'handle',
      screenPosition: screenPos,
      size: options?.size ?? 10,
      shape: options?.shape ?? 'circle',
      color: options?.color ?? '#2196F3',
      active: false,
      visible: true
    }
    
    this._elements.set(id, handle)
    this._renderElement(handle)
  }

  /** Set handle active state */
  setHandleActive(id: string, active: boolean): void {
    const element = this._elements.get(id)
    if (element && element.type === 'handle') {
      (element as HandleOverlay).active = active
      this._renderElement(element)
    }
  }

  /** Remove handle */
  removeHandle(id: string): void {
    this._elements.delete(id)
    this._removeElement(id)
  }

  // ============================================================================
  // Tooltip Operations
  // ============================================================================

  /** Add or update tooltip */
  setTooltip(
    id: string,
    worldPosition: Point3D,
    text: string,
    position: 'top' | 'bottom' | 'left' | 'right' = 'top'
  ): void {
    const screenPos = worldToScreen(worldPosition, this._viewport)
    
    const tooltip: TooltipOverlay = {
      id,
      type: 'tooltip',
      screenPosition: screenPos,
      text,
      position,
      visible: true
    }
    
    this._elements.set(id, tooltip)
    this._renderElement(tooltip)
  }

  /** Remove tooltip */
  removeTooltip(id: string): void {
    this._elements.delete(id)
    this._removeElement(id)
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /** Clear all overlays */
  clear(): void {
    for (const id of this._elements.keys()) {
      this._removeElement(id)
    }
    this._elements.clear()
  }

  /** Clear by type */
  clearByType(type: OverlayElementType): void {
    for (const [id, element] of this._elements) {
      if (element.type === type) {
        this._removeElement(id)
        this._elements.delete(id)
      }
    }
  }

  /** Get all elements */
  getElements(): OverlayElementData[] {
    return Array.from(this._elements.values())
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  /** Render single element */
  private _renderElement(element: OverlayElementData): void {
    let el = document.getElementById(`${this._prefix}-${element.id}`)
    
    if (!el) {
      el = document.createElement('div')
      el.id = `${this._prefix}-${element.id}`
      el.className = `${this._prefix}-element ${this._prefix}-${element.type}`
      this._container.appendChild(el)
    }
    
    // Position
    el.style.left = `${element.screenPosition.x}px`
    el.style.top = `${element.screenPosition.y}px`
    
    // Type-specific rendering
    switch (element.type) {
      case 'label':
        this._renderLabel(el as HTMLElement, element)
        break
      case 'measurement':
        this._renderMeasurement(el as HTMLElement, element)
        break
      case 'handle':
        this._renderHandle(el as HTMLElement, element)
        break
      case 'tooltip':
        this._renderTooltip(el as HTMLElement, element)
        break
    }
  }

  /** Render label */
  private _renderLabel(el: HTMLElement, label: LabelOverlay): void {
    el.textContent = label.text
    el.className = `${this._prefix}-label`
    if (label.color) el.style.color = label.color
    if (label.fontSize) el.style.fontSize = `${label.fontSize}px`
  }

  /** Render measurement */
  private _renderMeasurement(el: HTMLElement, m: MeasurementOverlay): void {
    el.className = `${this._prefix}-measurement`
    
    // Create SVG for line and arrows
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', `${this._prefix}-measurement-svg`)
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.style.position = 'absolute'
    svg.style.top = '0'
    svg.style.left = '0'
    svg.style.overflow = 'visible'
    
    // Line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', `${m.start.x}`)
    line.setAttribute('y1', `${m.start.y}`)
    line.setAttribute('x2', `${m.end.x}`)
    line.setAttribute('y2', `${m.end.y}`)
    line.setAttribute('stroke', 'currentColor')
    line.setAttribute('stroke-width', '1')
    svg.appendChild(line)
    
    // Label
    const textEl = document.createElement('div')
    textEl.className = `${this._prefix}-measurement-label`
    textEl.textContent = m.label ?? `${m.distance.toFixed(m.precision ?? 2)} ${m.unit ?? 'm'}`
    
    el.innerHTML = ''
    el.appendChild(svg)
    el.appendChild(textEl)
  }

  /** Render handle */
  private _renderHandle(el: HTMLElement, handle: HandleOverlay): void {
    el.className = `${this._prefix}-handle`
    if (handle.active) el.classList.add('active')
    
    const size = handle.size ?? 10
    el.style.width = `${size}px`
    el.style.height = `${size}px`
    el.style.backgroundColor = handle.color ?? '#2196F3'
    
    // Shape
    if (handle.shape === 'square') {
      el.style.borderRadius = '2px'
    } else if (handle.shape === 'diamond') {
      el.style.transform = 'rotate(45deg)'
    } else {
      el.style.borderRadius = '50%'
    }
    
// Center the handle
    el.style.marginLeft = `-${size / 2}px`
    el.style.marginTop = `-${size / 2}px`
  }

  /** Render tooltip */
  private _renderTooltip(el: HTMLElement, tooltip: TooltipOverlay): void {
    el.className = `${this._prefix}-tooltip`
    el.textContent = tooltip.text
    
    // Position relative to anchor
    const offset = 10
    if (tooltip.position === 'top') {
      el.style.bottom = '100%'
      el.style.left = '50%'
      el.style.transform = 'translateX(-50%)'
      el.style.marginBottom = `${offset}px`
    } else if (tooltip.position === 'bottom') {
      el.style.top = '100%'
      el.style.left = '50%'
      el.style.transform = 'translateX(-50%)'
      el.style.marginTop = `${offset}px`
    } else if (tooltip.position === 'left') {
      el.style.right = '100%'
      el.style.top = '50%'
      el.style.transform = 'translateY(-50%)'
      el.style.marginRight = `${offset}px`
    } else {
      el.style.left = '100%'
      el.style.top = '50%'
      el.style.transform = 'translateY(-50%)'
      el.style.marginLeft = `${offset}px`
    }
  }

  /** Remove element from DOM */
  private _removeElement(id: string): void {
    const el = document.getElementById(`${this._prefix}-${id}`)
    if (el) el.remove()
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /** Format distance with unit */
  private _formatDistance(
    distance: number,
    precision = 2,
    unit: 'mm' | 'cm' | 'm' | 'in' | 'ft' = 'm'
  ): string {
    // Convert to requested unit
    let value = distance
    let displayUnit = unit
    
    if (unit === 'mm') {
      value = distance * 1000
      displayUnit = 'mm'
    } else if (unit === 'cm') {
      value = distance * 100
      displayUnit = 'cm'
    } else if (unit === 'in') {
      value = distance * 39.3701
      displayUnit = 'in'
    } else if (unit === 'ft') {
      value = distance * 3.28084
      displayUnit = 'ft'
    }
    
    return `${value.toFixed(precision)} ${displayUnit}`
  }
}

// ============================================================================
// Overlay Factory
// ============================================================================

/** Create overlay manager */
export function createOverlayManager(config: OverlayManagerConfig): OverlayManager {
  return new OverlayManager(config)
}
