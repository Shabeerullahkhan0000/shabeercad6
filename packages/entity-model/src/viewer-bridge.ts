/**
 * Entity Store to Viewer Bridge
 * 
 * Syncs EntityStore with @mlightcad/cad-simple-viewer selection.
 * Keeps separate from viewer - uses external callbacks only.
 * 
 * Mobile-optimized: does not rerender full viewer, just highlights.
 */

import { EntityStore, SelectionChangeEvent, createSelectionChangeEvent } from './store.js'
import { CadEntity } from './types.js'

// ============================================================================
// Viewer Bridge
// ============================================================================

/** Bridge configuration */
export interface ViewerBridgeConfig {
  /** Callback to highlight entity IDs in viewer */
  highlightEntities: (ids: string[]) => void
  /** Callback to clear all highlights */
  clearHighlights: () => void
  /** Callback when viewer selection changes (returns selected entity IDs) */
  onViewerSelectionChange?: () => string[]
}

/** Bridge between EntityStore and viewer */
export class EntityViewerBridge {
  private _store: EntityStore
  private _config: ViewerBridgeConfig
  private _unsubscribe: (() => void) | null = null

  constructor(store: EntityStore, config: ViewerBridgeConfig) {
    this._store = store
    this._config = config
    this._setupListener()
  }

  /** Setup store listener */
  private _setupListener(): void {
    this._unsubscribe = this._store.subscribe(() => {
      this._syncToViewer()
    })
    // Initial sync
    this._syncToViewer()
  }

  /** Sync store selection to viewer highlights */
  private _syncToViewer(): void {
    const highlightIds = this._store.getHighlightedIds()
    if (highlightIds.length > 0) {
      this._config.highlightEntities(highlightIds)
    } else {
      this._config.clearHighlights()
    }
  }

  /** Get the store */
  get store(): EntityStore {
    return this._store
  }

  /** Sync from viewer to store */
  syncFromViewer(): EntityStore {
    const viewerIds = this._config.onViewerSelectionChange?.() ?? []
    let store = this._store
    
    // Clear current selection and add viewer selection
    store = store.selectClear()
    for (const id of viewerIds) {
      if (store.has(id)) {
        store = store.selectAdd(id)
      }
    }
    
    return store
  }

  /** Destroy bridge */
  destroy(): void {
    this._unsubscribe?.()
    this._unsubscribe = null
  }
}

// ============================================================================
// Sync Helper
// ============================================================================

/** Create bridge with simple highlight callbacks */
export function createViewerBridge(
  store: EntityStore,
  highlightCallback: (ids: string[]) => void,
  clearCallback: () => void,
  getViewerSelectionIds?: () => string[]
): EntityViewerBridge {
  return new EntityViewerBridge(store, {
    highlightEntities: highlightCallback,
    clearHighlights: clearCallback,
    onViewerSelectionChange: getViewerSelectionIds
  })
}

/** Simple sync example for @mlightcad/cad-simple-viewer */
export interface SimpleViewerBridgeOptions {
  /** Get the viewer's selection set */
  getSelection: () => Set<string>
  /** Highlight entities in view */
  highlight: (objectIds: string[]) => void
  /** Clear highlights */
  clearHighlight: () => void
}

/** Create simple bridge for @mlightcad/cad-simple-viewer */
export function createSimpleViewerBridge(
  store: EntityStore,
  viewer: SimpleViewerBridgeOptions
): EntityStore {
  // Subscribe to store changes and sync to viewer
  store.subscribe(() => {
    const highlighted = store.getHighlightedIds()
    if (highlighted.length > 0) {
      viewer.highlight(highlighted)
    } else {
      viewer.clearHighlight()
    }
  })

  // Return new store (this is just setup, actual store stays same)
  return store
}
