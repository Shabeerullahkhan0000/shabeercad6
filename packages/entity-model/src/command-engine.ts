/**
 * CAD Command Engine
 * 
 * Typed commands to control entity store and overlay safely.
 * Does NOT mutate viewer directly - uses callbacks only.
 * 
 * Commands are immutable - return new state, don't modify.
 */

import { EntityStore } from './store.js'
import { CadEntity, Point3D } from './types.js'
import { distance3D } from './geometry.js'

// ============================================================================
// Command Types
// ============================================================================

/** Base command interface */
export interface CadCommand {
  type: string
}

/** Select entity command */
export interface SelectEntityCommand extends CadCommand {
  type: 'select_entity'
  entityId: string
  addToSelection?: boolean
}

/** Highlight entities command */
export interface HighlightEntitiesCommand extends CadCommand {
  type: 'highlight_entities'
  entityIds: string[]
}

/** Hide layer command */
export interface HideLayerCommand extends CadCommand {
  type: 'hide_layer'
  layer: string
}

/** Show layer command */
export interface ShowLayerCommand extends CadCommand {
  type: 'show_layer'
  layer: string
}

/** Measure between points command */
export interface MeasureBetweenPointsCommand extends CadCommand {
  type: 'measure_between_points'
  point1: Point3D
  point2: Point3D
  label?: string
}

/** Clear selection command */
export interface ClearSelectionCommand extends CadCommand {
  type: 'clear_selection'
}

/** Zoom to entity command */
export interface ZoomToEntityCommand extends CadCommand {
  type: 'zoom_to_entity'
  entityId: string
  padding?: number
}

/** All command types */
export type CadCommandType = 
  | SelectEntityCommand 
  | HighlightEntitiesCommand 
  | HideLayerCommand 
  | ShowLayerCommand 
  | MeasureBetweenPointsCommand 
  | ClearSelectionCommand 
  | ZoomToEntityCommand

// ============================================================================
// Command Result
// ============================================================================

/** Command execution result */
export interface CommandResult {
  success: boolean
  store?: EntityStore
  viewport?: ViewportCommand
  measurement?: MeasurementResult
  error?: string
}

/** Viewport command to send to viewer */
export interface ViewportCommand {
  type: 'zoom_to_bbox'
  bbox: { min: Point3D; max: Point3D }
  padding?: number
}

/** Measurement result */
export interface MeasurementResult {
  distance: number
  point1: Point3D
  point2: Point3D
  label?: string
}

// ============================================================================
// Command Engine
// ============================================================================

/** Command execution context */
export interface CommandContext {
  /** Current entity store */
  store: EntityStore
  /** Get entity by ID */
  getEntity: (id: string) => CadEntity | undefined
  /** Callback for viewport changes */
  onViewportChange?: (cmd: ViewportCommand) => void
}

/** Execute a command */
export function executeStoreCommand(
  context: CommandContext,
  command: CadCommandType
): CommandResult {
  switch (command.type) {
    case 'select_entity':
      return executeSelectEntity(context, command)
    case 'highlight_entities':
      return executeHighlightEntities(context, command)
    case 'hide_layer':
      return executeHideLayer(context, command)
    case 'show_layer':
      return executeShowLayer(context, command)
    case 'measure_between_points':
      return executeMeasureBetweenPoints(context, command)
    case 'clear_selection':
      return executeClearSelection(context, command)
    case 'zoom_to_entity':
      return executeZoomToEntity(context, command)
    default:
      return { success: false, error: `Unknown command: ${(command as CadCommand).type}` }
  }
}

// ============================================================================
// Command Executors
// ============================================================================

/** Execute select entity */
function executeSelectEntity(
  context: CommandContext,
  cmd: SelectEntityCommand
): CommandResult {
  const entity = context.getEntity(cmd.entityId)
  if (!entity) {
    return { success: false, error: `Entity not found: ${cmd.entityId}` }
  }

  let store = cmd.addToSelection
    ? context.store.selectAdd(cmd.entityId)
    : context.store.select(cmd.entityId)

  return { success: true, store }
}

/** Execute highlight entities */
function executeHighlightEntities(
  context: CommandContext,
  cmd: HighlightEntitiesCommand
): CommandResult {
  let store = context.store.highlightClear()
  
  for (const id of cmd.entityIds) {
    if (context.getEntity(id)) {
      store = store.highlight(id)
    }
  }

  return { success: true, store }
}

/** Execute hide layer */
function executeHideLayer(
  context: CommandContext,
  cmd: HideLayerCommand
): CommandResult {
  const store = context.store.hideLayer(cmd.layer)
  return { success: true, store }
}

/** Execute show layer */
function executeShowLayer(
  context: CommandContext,
  cmd: ShowLayerCommand
): CommandResult {
  const store = context.store.showLayer(cmd.layer)
  return { success: true, store }
}

/** Execute measure between points */
function executeMeasureBetweenPoints(
  context: CommandContext,
  cmd: MeasureBetweenPointsCommand
): CommandResult {
  const dist = distance3D(cmd.point1, cmd.point2)
  
  const measurement: MeasurementResult = {
    distance: dist,
    point1: cmd.point1,
    point2: cmd.point2,
    label: cmd.label
  }

  return { success: true, store: context.store, measurement }
}

/** Execute clear selection */
function executeClearSelection(
  context: CommandContext,
  _cmd: ClearSelectionCommand
): CommandResult {
  const store = context.store.selectClear()
  return { success: true, store }
}

/** Execute zoom to entity */
function executeZoomToEntity(
  context: CommandContext,
  cmd: ZoomToEntityCommand
): CommandResult {
  const entity = context.getEntity(cmd.entityId)
  if (!entity) {
    return { success: false, error: `Entity not found: ${cmd.entityId}` }
  }

  const padding = cmd.padding ?? 1.0
  const bbox = entity.bbox
  
  const viewport: ViewportCommand = {
    type: 'zoom_to_bbox',
    bbox: {
      min: { x: bbox.min.x - padding, y: bbox.min.y - padding, z: 0 },
      max: { x: bbox.max.x + padding, y: bbox.max.y + padding, z: 0 }
    },
    padding
  }

  // Notify viewer of viewport change
  context.onViewportChange?.(viewport)

  return { success: true, store: context.store, viewport }
}

// ============================================================================
// Command Validation
// ============================================================================

/** Validate command without executing */
export function validateCommand(
  context: CommandContext,
  command: CadCommandType
): { valid: boolean; error?: string } {
  switch (command.type) {
    case 'select_entity':
      if (!command.entityId) return { valid: false, error: 'entityId required' }
      if (!context.getEntity(command.entityId)) {
        return { valid: false, error: `Entity not found: ${command.entityId}` }
      }
      break

    case 'highlight_entities':
      if (!Array.isArray(command.entityIds)) {
        return { valid: false, error: 'entityIds array required' }
      }
      break

    case 'hide_layer':
    case 'show_layer':
      if (!command.layer) return { valid: false, error: 'layer required' }
      break

    case 'measure_between_points':
      if (!command.point1 || !command.point2) {
        return { valid: false, error: 'point1 and point2 required' }
      }
      break

    case 'zoom_to_entity':
      if (!command.entityId) return { valid: false, error: 'entityId required' }
      if (!context.getEntity(command.entityId)) {
        return { valid: false, error: `Entity not found: ${command.entityId}` }
      }
      break

    case 'clear_selection':
      // No validation needed
      break
  }

  return { valid: true }
}

// ============================================================================
// Command Factory
// ============================================================================

/** Create select entity command */
export function createSelectEntityCommand(
  entityId: string,
  addToSelection = false
): SelectEntityCommand {
  return { type: 'select_entity', entityId, addToSelection }
}

/** Create highlight entities command */
export function createHighlightEntitiesCommand(
  entityIds: string[]
): HighlightEntitiesCommand {
  return { type: 'highlight_entities', entityIds }
}

/** Create hide layer command */
export function createHideLayerCommand(layer: string): HideLayerCommand {
  return { type: 'hide_layer', layer }
}

/** Create show layer command */
export function createShowLayerCommand(layer: string): ShowLayerCommand {
  return { type: 'show_layer', layer }
}

/** Create measure between points command */
export function createMeasureBetweenPointsCommand(
  point1: Point3D,
  point2: Point3D,
  label?: string
): MeasureBetweenPointsCommand {
  return { type: 'measure_between_points', point1, point2, label }
}

/** Create clear selection command */
export function createClearSelectionCommand(): ClearSelectionCommand {
  return { type: 'clear_selection' }
}

/** Create zoom to entity command */
export function createZoomToEntityCommand(
  entityId: string,
  padding = 1.0
): ZoomToEntityCommand {
  return { type: 'zoom_to_entity', entityId, padding }
}
