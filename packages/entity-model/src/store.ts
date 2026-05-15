/**
 * Entity Store
 * 
 * Stores CAD entities for selection, highlighting, filtering.
 * Keeps separate from @mlightcad/cad-simple-viewer.
 * Optimized for mobile - avoids full viewer rerenders.
 * 
 * Uses typed entity IDs for immutable updates.
 */

import { CadEntity, CadEntityType } from './types.js'

// ============================================================================
// Store State
// ============================================================================

/** Entity stored by ID */
interface EntityEntry {
  entity: CadEntity
  selected: boolean
  highlighted: boolean
  hidden: boolean
}

/** Full store state */
interface EntityStoreState {
  entities: Map<string, EntityEntry>
  selectedIds: Set<string>
  highlightedIds: Set<string>
  hiddenLayers: Set<string>
}

/** Create initial store state */
function createStore(): EntityStoreState {
  return {
    entities: new Map(),
    selectedIds: new Set(),
    highlightedIds: new Set(),
    hiddenLayers: new Set()
  }
}

// ============================================================================
// Immutable Store
// ============================================================================

/** Immutable entity store - creates new state on each update */
export class EntityStore {
  private _state: EntityStoreState
  private _listeners: Set<() => void>

  constructor() {
    this._state = createStore()
    this._listeners = new Set()
  }

  /** Get entity by ID */
  get(id: string): CadEntity | undefined {
    return this._state.entities.get(id)?.entity
  }

  /** Check if entity exists */
  has(id: string): boolean {
    return this._state.entities.has(id)
  }

  /** Get all entities */
  getAll(): CadEntity[] {
    const result: CadEntity[] = []
    for (const entry of this._state.entities.values()) {
      if (!this._state.hiddenLayers.has(entry.entity.layer)) {
        result.push(entry.entity)
      }
    }
    return result
  }

  /** Get entities by type */
  getByType(type: CadEntityType): CadEntity[] {
    const result: CadEntity[] = []
    for (const entry of this._state.entities.values()) {
      if (
        entry.entity.type === type &&
        !this._state.hiddenLayers.has(entry.entity.layer)
      ) {
        result.push(entry.entity)
      }
    }
    return result
  }

  /** Get entities by layer */
  getByLayer(layer: string): CadEntity[] {
    const result: CadEntity[] = []
    for (const entry of this._state.entities.values()) {
      if (
        entry.entity.layer === layer &&
        !this._state.hiddenLayers.has(layer)
      ) {
        result.push(entry.entity)
      }
    }
    return result
  }

  /** Get all unique layers */
  getLayers(): string[] {
    const layers = new Set<string>()
    for (const entry of this._state.entities.values()) {
      layers.add(entry.entity.layer)
    }
    return Array.from(layers).sort()
  }

  /** Get all entity types */
  getTypes(): CadEntityType[] {
    const types = new Set<CadEntityType>()
    for (const entry of this._state.entities.values()) {
      types.add(entry.entity.type)
    }
    return Array.from(types).sort()
  }

  /** Check if entity is selected */
  isSelected(id: string): boolean {
    return this._state.selectedIds.has(id)
  }

  /** Check if entity is highlighted */
  isHighlighted(id: string): boolean {
    return this._state.highlightedIds.has(id)
  }

  /** Check if layer is hidden */
  isLayerHidden(layer: string): boolean {
    return this._state.hiddenLayers.has(layer)
  }

  /** Get selected entities */
  getSelected(): CadEntity[] {
    const result: CadEntity[] = []
    for (const id of this._state.selectedIds) {
      const entry = this._state.entities.get(id)
      if (entry && !this._state.hiddenLayers.has(entry.entity.layer)) {
        result.push(entry.entity)
      }
    }
    return result
  }

  /** Get highlighted entities */
  getHighlighted(): CadEntity[] {
    const result: CadEntity[] = []
    for (const id of this._state.highlightedIds) {
      const entry = this._state.entities.get(id)
      if (entry && !this._state.hiddenLayers.has(entry.entity.layer)) {
        result.push(entry.entity)
      }
    }
    return result
  }

  /** Get selected IDs (for external viewer sync) */
  getSelectedIds(): string[] {
    return Array.from(this._state.selectedIds)
  }

  /** Get highlighted IDs (for external viewer sync) */
  getHighlightedIds(): string[] {
    return Array.from(this._state.highlightedIds)
  }

  /** Get count */
  get count(): number {
    return this._state.entities.size
  }

  /** Get visible count */
  get visibleCount(): number {
    let count = 0
    for (const entry of this._state.entities.values()) {
      if (!this._state.hiddenLayers.has(entry.entity.layer)) {
        count++
      }
    }
    return count
  }

  // ============================================================================
  // Mutations (immutable - create new state)
  // ============================================================================

  /** Add entity to store */
  add(entity: CadEntity): EntityStore {
    const newState = cloneState(this._state)
    newState.entities.set(entity.id, {
      entity,
      selected: false,
      highlighted: false,
      hidden: false
    })
    return this.createStore(newState)
  }

  /** Add multiple entities */
  addMany(entities: CadEntity[]): EntityStore {
    const newState = cloneState(this._state)
    for (const entity of entities) {
      newState.entities.set(entity.id, {
        entity,
        selected: false,
        highlighted: false,
        hidden: false
      })
    }
    return this.createStore(newState)
  }

  /** Remove entity by ID */
  remove(id: string): EntityStore {
    const newState = cloneState(this._state)
    newState.entities.delete(id)
    newState.selectedIds.delete(id)
    newState.highlightedIds.delete(id)
    return this.createStore(newState)
  }

  /** Clear all entities */
  clear(): EntityStore {
    return this.createStore(createStore())
  }

  /** Select entity (replaces current selection) */
  select(id: string): EntityStore {
    const newState = cloneState(this._state)
    newState.selectedIds.clear()
    if (this._state.entities.has(id)) {
      newState.selectedIds.add(id)
    }
    return this.createStore(newState)
  }

  /** Add to selection */
  selectAdd(id: string): EntityStore {
    const newState = cloneState(this._state)
    if (this._state.entities.has(id)) {
      newState.selectedIds.add(id)
    }
    return this.createStore(newState)
  }

  /** Remove from selection */
  selectRemove(id: string): EntityStore {
    const newState = cloneState(this._state)
    newState.selectedIds.delete(id)
    return this.createStore(newState)
  }

  /** Clear selection */
  selectClear(): EntityStore {
    const newState = cloneState(this._state)
    newState.selectedIds.clear()
    return this.createStore(newState)
  }

  /** Toggle selection */
  selectToggle(id: string): EntityStore {
    const newState = cloneState(this._state)
    if (newState.selectedIds.has(id)) {
      newState.selectedIds.delete(id)
    } else if (this._state.entities.has(id)) {
      newState.selectedIds.add(id)
    }
    return this.createStore(newState)
  }

  /** Highlight entity */
  highlight(id: string): EntityStore {
    const newState = cloneState(this._state)
    if (this._state.entities.has(id)) {
      newState.highlightedIds.add(id)
    }
    return this.createStore(newState)
  }

  /** Remove highlight */
  unhighlight(id: string): EntityStore {
    const newState = cloneState(this._state)
    newState.highlightedIds.delete(id)
    return this.createStore(newState)
  }

  /** Clear all highlights */
  highlightClear(): EntityStore {
    const newState = cloneState(this._state)
    newState.highlightedIds.clear()
    return this.createStore(newState)
  }

  /** Hide layer */
  hideLayer(layer: string): EntityStore {
    const newState = cloneState(this._state)
    newState.hiddenLayers.add(layer)
    return this.createStore(newState)
  }

  /** Show layer */
  showLayer(layer: string): EntityStore {
    const newState = cloneState(this._state)
    newState.hiddenLayers.delete(layer)
    return this.createStore(newState)
  }

  /** Toggle layer visibility */
  toggleLayer(layer: string): EntityStore {
    const newState = cloneState(this._state)
    if (newState.hiddenLayers.has(layer)) {
      newState.hiddenLayers.delete(layer)
    } else {
      newState.hiddenLayers.add(layer)
    }
    return this.createStore(newState)
  }

  /** Show all layers */
  showAllLayers(): EntityStore {
    return this.createStore(cloneStateClearHidden(this._state))
  }

  // ============================================================================
  // Selection by type/layer
  // ============================================================================

  /** Select all of type */
  selectByType(type: CadEntityType): EntityStore {
    const newState = cloneState(this._state)
    newState.selectedIds.clear()
    for (const [id, entry] of this._state.entities) {
      if (entry.entity.type === type) {
        newState.selectedIds.add(id)
      }
    }
    return this.createStore(newState)
  }

  /** Select all of layer */
  selectByLayer(layer: string): EntityStore {
    const newState = cloneState(this._state)
    newState.selectedIds.clear()
    for (const [id, entry] of this._state.entities) {
      if (entry.entity.layer === layer) {
        newState.selectedIds.add(id)
      }
    }
    return this.createStore(newState)
  }

  // ============================================================================
  // Batch operations
  // ============================================================================

  /** Replace entire store */
  replace(entities: CadEntity[]): EntityStore {
    const newState = createStore()
    for (const entity of entities) {
      newState.entities.set(entity.id, {
        entity,
        selected: false,
        highlighted: false,
        hidden: false
      })
    }
    return this.createStore(newState)
  }

  // ============================================================================
  // Listeners (for UI updates without viewer rerender)
  // ============================================================================

  /** Subscribe to changes */
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  /** Notify listeners */
  private notify(): void {
    for (const listener of this._listeners) {
      listener()
    }
  }

  /** Create store from new state */
  private createStore(state: EntityStoreState): EntityStore {
    const store = new EntityStore()
    store._state = state
    store._listeners = this._listeners
    store.notify()
    return store
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Clone state */
function cloneState(state: EntityStoreState): EntityStoreState {
  return {
    entities: new Map(state.entities),
    selectedIds: new Set(state.selectedIds),
    highlightedIds: new Set(state.highlightedIds),
    hiddenLayers: new Set(state.hiddenLayers)
  }
}

/** Clone state with cleared hidden layers */
function cloneStateClearHidden(state: EntityStoreState): EntityStoreState {
  return {
    entities: new Map(state.entities),
    selectedIds: new Set(state.selectedIds),
    highlightedIds: new Set(state.highlightedIds),
    hiddenLayers: new Set()
  }
}

// ============================================================================
// Selection Change Event
// ============================================================================

/** Event emitted when selection changes */
export interface SelectionChangeEvent {
  selectedIds: string[]
  added: string[]
  removed: string[]
}

/** Create selection change event */
export function createSelectionChangeEvent(
  oldIds: Set<string>,
  newIds: Set<string>
): SelectionChangeEvent {
  const added: string[] = []
  const removed: string[] = []
  const selectedIds = Array.from(newIds)

  for (const id of newIds) {
    if (!oldIds.has(id)) {
      added.push(id)
    }
  }
  for (const id of oldIds) {
    if (!newIds.has(id)) {
      removed.push(id)
    }
  }

  return { selectedIds, added, removed }
}
