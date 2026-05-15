import { Point2D } from './types'

/**
 * Fast mobile gesture system for CAD viewer.
 * 
 * Features:
 * - One-finger tap detection
 * - Pan only on empty space (no entities)
 * - Pinch zoom supported via OrbitControls
 * - No hover-only behavior on touch
 * - Handle hit-test hook for future conflicts
 * - Low-lag touchmove via passive listeners
 * 
 * Requirements:
 * - One-finger tap, pan only on empty space, pinch zoom if safe
 * - No hover-only behavior, prevent future handle conflicts
 * - Low-lag touchmove, use requestAnimationFrame/throttle if needed
 */

export interface GestureConfig {
  /** Tap threshold in pixels - tap if movement < threshold */
  tapThreshold: number
  /** Pan starts if movement >= threshold */
  panThreshold: number
  /** Throttle delay for touchmove in ms (0 = disabled) */
  throttleMs: number
  /** Enable tap detection */
  enableTap: boolean
  /** Enable pan-on-empty-space check */
  enablePanOnEmpty: boolean
}

export const defaultGestureConfig: GestureConfig = {
  tapThreshold: 10,
  panThreshold: 10,
  throttleMs: 0, // Disabled - OrbitControls handles this
  enableTap: true,
  enablePanOnEmpty: true
}

/** Gesture state machine */
export enum GestureState {
  /** No touch */
  IDLE = 'idle',
  /** Touch started, awaiting movement check */
  TOUCH_START = 'touch_start',
  /** Tapped (short touch on empty space) */
  TAPPED = 'tapped',
  /** Panning (drag gesture) */
  PANNING = 'pan',
  /** Pinch zoom active */
  PINCHING = 'pinch'
}

/** Gesture event types */
export type GestureEventType = 
  | 'tap'
  | 'pan_start'
  | 'pan_move'
  | 'pan_end'
  | 'pinch_start'
  | 'pinch_move'
  | 'pinch_end'

export interface GestureEvent {
  type: GestureEventType
  point: Point2D
  delta?: Point2D
  scale?: number
}

/** Gesture callback */
export type GestureCallback = (event: GestureEvent) => void

/** 
 * Hit test function type - returns true if point hits an entity/handle 
 * Use this to prevent pan on empty space only
 */
export type HitTestFn = (point: Point2D) => boolean | Promise<boolean>

/**
 * Mobile gesture handler.
 * Wraps OrbitControls with tap/pan-on-empty-space detection.
 * 
 * @example
 * ```typescript
 * const handler = createMobileGestureHandler({
 *   hitTest: async (point) => {
 *     // Check if point hits any entity
 *     return store.getAtPoint(point)
 *   }
 * })
 * 
 * canvas.addEventListener('touchstart', handler.onTouchStart, { passive: false })
 * canvas.addEventListener('touchmove', handler.onTouchMove, { passive: false })
 * canvas.addEventListener('touchend', handler.onTouchEnd, { passive: false })
 * ```
 */
export interface MobileGestureHandler {
  /** Current gesture state */
  state: GestureState
  /** Last touch point */
  lastPoint: Point2D | null
  /** Start a new gesture */
  onTouchStart: (e: TouchEvent) => void
  /** Handle touch move */
  onTouchMove: (e: TouchEvent) => void
  /** Handle touch end */
  onTouchEnd: (e: TouchEvent) => void
  /** Handle touch cancel */
  onTouchCancel: (e: TouchEvent) => void
  /** Subscribe to gesture events */
  on: (callback: GestureCallback) => () => void
  /** Enable/disable handler */
  setEnabled: (enabled: boolean) => void
  /** Destroy handler */
  destroy: () => void
}

export interface MobileGestureOptions {
  /** Gesture configuration */
  config?: Partial<GestureConfig>
  /** Hit test function for pan-on-empty-space */
  hitTest?: HitTestFn
  /** Element to attach listeners to */
  element?: HTMLElement
}

/** Create mobile gesture handler */
export function createMobileGestureHandler(options: MobileGestureOptions = {}): MobileGestureHandler {
  const config = { ...defaultGestureConfig, ...options.config }
  const hitTest = options.hitTest
  const element = options.element
  
  let state: GestureState = GestureState.IDLE
  let startPoint: Point2D | null = null
  let lastPoint: Point2D | null = null
  let enabled = true
  let touchId: number | null = null
  
  const listeners: Set<GestureCallback> = new Set()
  
  // Throttle tracking
  let lastEmitTime = 0
  const shouldThrottle = config.throttleMs > 0
  
  function emit(event: GestureEvent): void {
    if (!enabled) return
    
    const now = Date.now()
    if (shouldThrottle && event.type === 'pan_move') {
      if (now - lastEmitTime < config.throttleMs) return
      lastEmitTime = now
    }
    
    listeners.forEach(cb => {
      try {
        cb(event)
      } catch (e) {
        // Ignore callback errors
      }
    })
  }
  
  function distance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  async function checkHit(point: Point2D): Promise<boolean> {
    if (!hitTest) return false
    try {
      return await hitTest(point)
    } catch {
      return false
    }
  }
  
  function getTouchPoint(touch: Touch): Point2D {
    return { x: touch.clientX, y: touch.clientY }
  }
  
  const self: MobileGestureHandler = {
    get state() { return state },
    get lastPoint() { return lastPoint },
    
    onTouchStart(e: TouchEvent) {
      if (!enabled) return
      if (e.touches.length === 0) return
      
      // Single touch only
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        touchId = touch.identifier
        startPoint = getTouchPoint(touch)
        lastPoint = startPoint
        
        if (config.enableTap) {
          state = GestureState.TOUCH_START
        }
      } else if (e.touches.length === 2) {
        // Pinch start
        touchId = null
        state = GestureState.PINCHING
        emit({ type: 'pinch_start', point: lastPoint || { x: 0, y: 0 } })
      }
    },
    
    onTouchMove(e: TouchEvent) {
      if (!enabled) return
      if (e.touches.length === 0) return
      
      // Find our touch
      let touch: Touch | null = null
      for (let i = 0; i < e.touches.length; i++) {
        if (touchId === null || e.touches[i].identifier === touchId) {
          touch = e.touches[i]
          break
        }
      }
      if (!touch) return
      
      const currentPoint = getTouchPoint(touch)
      const prevPoint = lastPoint || currentPoint
      lastPoint = currentPoint
      
      if (state === GestureState.TOUCH_START) {
        const dist = startPoint ? distance(startPoint, currentPoint) : 0
        
        if (dist >= config.panThreshold) {
          // Movement detected - check if on empty space
          if (config.enablePanOnEmpty) {
            checkHit(currentPoint).then(onEmpty => {
              if (onEmpty) {
                // Hit something - don't pan, let OrbitControls handle selection
                state = GestureState.IDLE
              } else {
                // Empty space - allow pan
                state = GestureState.PANNING
                emit({
                  type: 'pan_start',
                  point: currentPoint,
                  delta: { x: currentPoint.x - prevPoint.x, y: currentPoint.y - prevPoint.y }
                })
              }
            })
          } else {
            state = GestureState.PANNING
            emit({
              type: 'pan_start',
              point: currentPoint,
              delta: { x: currentPoint.x - prevPoint.x, y: currentPoint.y - prevPoint.y }
            })
          }
        }
      } else if (state === GestureState.PANNING) {
        emit({
          type: 'pan_move',
          point: currentPoint,
          delta: { x: currentPoint.x - prevPoint.x, y: currentPoint.y - prevPoint.y }
        })
      } else if (state === GestureState.PINCHING && e.touches.length === 2) {
        // Pinch move - emit for scale calculation
        const t1 = getTouchPoint(e.touches[0])
        const t2 = getTouchPoint(e.touches[1])
        const scale = Math.sqrt(
          Math.pow(t2.x - t1.x, 2) + Math.pow(t2.y - t1.y, 2)
        )
        emit({
          type: 'pinch_move',
          point: currentPoint,
          scale
        })
      }
    },
    
    onTouchEnd(e: TouchEvent) {
      if (!enabled) return
      
      if (state === GestureState.TOUCH_START && startPoint && config.enableTap) {
        // Tap!
        const dist = startPoint ? distance(startPoint, lastPoint || startPoint) : 0
        if (dist < config.tapThreshold) {
          emit({ type: 'tap', point: startPoint })
        }
      } else if (state === GestureState.PANNING) {
        emit({ type: 'pan_end', point: lastPoint || { x: 0, y: 0 } })
      } else if (state === GestureState.PINCHING) {
        emit({ type: 'pinch_end', point: lastPoint || { x: 0, y: 0 } })
      }
      
      // Reset
      state = GestureState.IDLE
      startPoint = null
      lastPoint = null
      touchId = null
    },
    
    onTouchCancel(e: TouchEvent) {
      self.onTouchEnd(e)
    },
    
    on(callback: GestureCallback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    
    setEnabled(enabled: boolean) {
      enabled = enabled
      if (!enabled) {
        state = GestureState.IDLE
        startPoint = null
        lastPoint = null
        touchId = null
      }
    },
    
    destroy() {
      listeners.clear()
      state = GestureState.IDLE
      startPoint = null
      lastPoint = null
      touchId = null
    }
  }
  
  return self
}

/**
 * Attach gesture handler to element with event listeners.
 * Uses passive: false for touchstart to allow preventDefault.
 * 
 * @example
 * ```typescript
 * const handler = createMobileGestureHandler({ hitTest })
 * attachGestureHandler(handler, canvas)
 * ```
 */
export function attachGestureHandler(
  handler: MobileGestureHandler,
  element: HTMLElement
): () => void {
  const options: AddEventListenerOptions = { passive: false }
  
  element.addEventListener('touchstart', handler.onTouchStart, options)
  element.addEventListener('touchmove', handler.onTouchMove, options)
  element.addEventListener('touchend', handler.onTouchEnd, options)
  element.addEventListener('touchcancel', handler.onTouchCancel, options)
  
  return () => {
    element.removeEventListener('touchstart', handler.onTouchStart, options)
    element.removeEventListener('touchmove', handler.onTouchMove, options)
    element.removeEventListener('touchend', handler.onTouchEnd, options)
    element.removeEventListener('touchcancel', handler.onTouchCancel, options)
  }
}
