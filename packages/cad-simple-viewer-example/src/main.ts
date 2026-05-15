import {
  AcApDocManager,
  AcApOpenDatabaseOptions,
  AcEdOpenMode
} from '@mlightcad/cad-simple-viewer'
import {
  AcDbSystemVariables,
  AcDbSysVarManager,
  log
} from '@mlightcad/data-model'

/**
 * Demo-only command alias overrides used by the example app.
 *
 * Purpose:
 * - Provide visible alias differences from built-in defaults so the alias
 *   feature can be validated quickly in command line UI and execution flow.
 *
 * Behavior:
 * - This object is passed to `AcApDocManager.createInstance({ commandAliases })`.
 * - For commands listed here, these aliases replace the built-in defaults.
 * - Commands not listed keep their built-in alias set.
 */
const EXAMPLE_COMMAND_ALIASES = {
  LINE: ['LX'],
  CIRCLE: ['CI'],
  ZOOM: ['ZZ']
}

class CadViewerApp {
  private container: HTMLDivElement | null = null
  private fileInput: HTMLInputElement | null = null
  private centerOpenButton: HTMLButtonElement | null = null
  private toolbarOpenButton: HTMLButtonElement | null = null
  private toolbarZoomButton: HTMLButtonElement | null = null
  private toolbarZoomWindowButton: HTMLButtonElement | null = null
  private toolbarBgButton: HTMLButtonElement | null = null
  private toolbarPickboxButton: HTMLButtonElement | null = null
  private toolbarLineWeightButton: HTMLButtonElement | null = null
  private emptyState: HTMLDivElement | null = null
  private predefinedButtons: NodeListOf<HTMLButtonElement> | null = null
  private isInitialized: boolean = false
  private isInitializing: boolean = false
  private hasOpenedFile: boolean = false
  private hasLoadedDocument: boolean = false
  private initError: Error | null = null
  private abortController: AbortController | null = null
  private visibilityAbortController: AbortController | null = null

  constructor() {
    // SSR guard - only run in browser
    if (typeof document === 'undefined') {
      return
    }

    // Lazy DOM setup - fetch elements only when needed
    this.lazySetupDOM()
    this.setupVisibilityHandling()
    this.setupPageCleanup()
  }

  private setupVisibilityHandling() {
    // Mobile frozen screen risk: Pause rendering when tab is hidden
    this.visibilityAbortController = new AbortController()
    const signal = this.visibilityAbortController.signal

    const handleVisibilityChange = () => {
      if (document.hidden && this.isInitialized) {
        // Pause heavy operations when tab is hidden on mobile
        try {
          AcApDocManager.instance.curView.clear()
        } catch {
          // Ignore if instance not available
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange, { signal })
  }

  private setupPageCleanup() {
    // Cleanup on page unload to prevent mobile frozen screens
    const cleanup = () => {
      if (this.isInitialized && AcApDocManager.instance) {
        // Use fire-and-forget to avoid blocking page unload
        AcApDocManager.instance.destroy().catch(() => {
          // Ignore cleanup errors during unload
        })
      }
    }

    window.addEventListener('beforeunload', cleanup)
    // Also handle pagehide for mobile Safari/iOS
    window.addEventListener('pagehide', cleanup)
  }

  private lazySetupDOM() {
    this.container = document.getElementById('cad-container') as HTMLDivElement | null
    this.fileInput = document.getElementById('fileInputElement') as HTMLInputElement | null
    this.centerOpenButton = document.getElementById('centerOpenButton') as HTMLButtonElement | null
    this.toolbarOpenButton = document.getElementById('toolbarOpenButton') as HTMLButtonElement | null
    this.toolbarZoomButton = document.getElementById('toolbarZoomButton') as HTMLButtonElement | null
    this.toolbarZoomWindowButton = document.getElementById('toolbarZoomWindowButton') as HTMLButtonElement | null
    this.toolbarBgButton = document.getElementById('toolbarBgButton') as HTMLButtonElement | null
    this.toolbarPickboxButton = document.getElementById('toolbarPickboxButton') as HTMLButtonElement | null
    this.toolbarLineWeightButton = document.getElementById('toolbarLineWeightButton') as HTMLButtonElement | null
    this.emptyState = document.getElementById('emptyState') as HTMLDivElement | null
    this.predefinedButtons = document.querySelectorAll(
      '#predefinedFileList .file-list-item'
    ) as unknown as NodeListOf<HTMLButtonElement> | null

    this.setupFileHandling()
    this.setupToolbarActions()
    this.setupPredefinedFileActions()
    this.updateEmptyStateVisibility()
    this.updateToolbarButtonsState()
  }

private initialize() {
    // Guard: prevent repeated init or concurrent init
    if (this.isInitialized || this.isInitializing) {
      return
    }

    // Guard: require container
    if (!this.container) {
      this.showMessage('CAD container not found', 'error')
      return
    }

    // Guard: verify container is still in DOM
    if (!document.body.contains(this.container)) {
      this.showMessage('CAD container removed from page', 'error')
      return
    }

    this.isInitializing = true
    this.showMessage('Loading CAD viewer...', 'info')

    try {
      // Check if instance already exists (defensive guard)
      if (!AcApDocManager.instance) {
        AcApDocManager.createInstance({
          container: this.container,
          autoResize: true,
          baseUrl: 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/',
          commandAliases: EXAMPLE_COMMAND_ALIASES,
          webworkerFileUrls: {
            mtextRender: './workers/mtext-renderer-worker.js',
            dxfParser: './workers/dxf-parser-worker.js',
            dwgParser: './workers/libredwg-parser-worker.js'
          }
        })
      }

      AcApDocManager.instance.events.documentActivated.addEventListener(
        args => {
          document.title = args.doc.docTitle
        }
      )

      this.isInitialized = true
      this.initError = null
      this.clearMessages()
      this.showMessage('CAD viewer ready', 'success')
    } catch (error) {
      log.error('Failed to initialize CAD viewer:', error)
      this.initError = error instanceof Error ? error : new Error(String(error))
      this.showMessage('Failed to initialize CAD viewer', 'error')
    } finally {
      this.isInitializing = false
    }
  }

  /** Force re-initialization after failed init */
  private retryInitialization() {
    // Reset state to allow retry
    this.isInitialized = false
    this.isInitializing = false
    this.initError = null
    this.initialize()
  }

private setupFileHandling() {
    if (!this.fileInput) return
    this.fileInput.addEventListener('change', event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        void this.loadLocalFile(file)
      }
      if (this.fileInput) this.fileInput.value = ''
    })

    if (this.centerOpenButton) {
      this.centerOpenButton.addEventListener('click', () => {
        this.cancelPendingLoad()
        this.fileInput?.click()
      })
    }

    if (this.toolbarOpenButton) {
      this.toolbarOpenButton.addEventListener('click', () => {
        this.cancelPendingLoad()
        this.fileInput?.click()
      })
    }
  }

  /** Cancel any pending file load operation */
  private cancelPendingLoad() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /** Set loading state - disable buttons during load */
  private setLoadingState(loading: boolean) {
    const buttons = [
      this.centerOpenButton,
      this.toolbarOpenButton,
      this.toolbarZoomButton,
      this.toolbarZoomWindowButton,
      this.toolbarBgButton,
      this.toolbarPickboxButton,
      this.toolbarLineWeightButton
    ]
    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = loading
      }
    })
  }

  private setupToolbarActions() {
    if (this.toolbarZoomButton) {
      this.toolbarZoomButton.addEventListener('click', () => {
        if (!this.hasLoadedDocument || !this.isInitialized) {
          return
        }
        AcApDocManager.instance.sendStringToExecute('zoom\\nall')
      })
    }

    if (this.toolbarZoomWindowButton) {
      this.toolbarZoomWindowButton.addEventListener('click', () => {
        if (!this.hasLoadedDocument || !this.isInitialized) {
          return
        }
        AcApDocManager.instance.sendStringToExecute('zoom\\nwindow')
      })
    }

    if (this.toolbarBgButton) {
      this.toolbarBgButton.addEventListener('click', () => {
        if (!this.hasLoadedDocument || !this.isInitialized) {
          return
        }
        AcApDocManager.instance.sendStringToExecute('switchbg')
      })
    }

    if (this.toolbarPickboxButton) {
      this.toolbarPickboxButton.addEventListener('click', () => {
        if (!this.hasLoadedDocument || !this.isInitialized) {
          return
        }

        const currentPickbox = AcDbSysVarManager.instance().getVar(
          AcDbSystemVariables.PICKBOX,
          AcApDocManager.instance.curDocument.database
        )
        const initialPickbox =
          currentPickbox == null ? '10' : String(currentPickbox)
        const valueText = window.prompt(
          'Set pick box size (integer):',
          initialPickbox
        )
        if (valueText == null) {
          return
        }

        const pickboxValue = Number.parseInt(valueText, 10)
        if (!Number.isFinite(pickboxValue) || pickboxValue <= 0) {
          this.showMessage('Pickbox size must be a positive integer', 'error')
          return
        }

        AcApDocManager.instance.sendStringToExecute(
          `${AcDbSystemVariables.PICKBOX}\n${pickboxValue}`
        )
        this.showMessage(`Pickbox set to: ${pickboxValue}`, 'success')
      })
    }

    if (this.toolbarLineWeightButton) {
      this.toolbarLineWeightButton.addEventListener('click', () => {
        if (!this.hasLoadedDocument || !this.isInitialized) {
          return
        }
        const db = AcApDocManager.instance.curDocument.database
        db.lwdisplay = !db.lwdisplay
        this.updateLineWeightButtonLabel()
      })
    }
  }

  private setupPredefinedFileActions() {
    if (!this.predefinedButtons) return
    this.predefinedButtons.forEach(button => {
      button.addEventListener('click', () => {
        const url = button.dataset.fileUrl
        if (!url) {
          return
        }
        // Hide empty-state open button as soon as a predefined file is selected.
        this.hasOpenedFile = true
        this.updateEmptyStateVisibility()
        this.predefinedButtons?.forEach(item => item.classList.remove('active'))
        button.classList.add('active')
        void this.loadPredefinedFile(url)
      })
    })
  }

private async loadLocalFile(file: File) {
    this.initialize()

    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.dxf') && !fileName.endsWith('.dwg')) {
      this.showMessage('Please select a DXF or DWG file', 'error')
      return
    }

    // Mobile memory protection - limit file size
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit
    if (file.size > MAX_FILE_SIZE) {
      this.showMessage(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 10MB.`, 'error')
      return
    }

    // Cancel any previous pending load
    this.cancelPendingLoad()
    this.setLoadingState(true)

    this.clearMessages()
    this.showMessage('Loading file...', 'info')

    // AbortController for timeout
    this.abortController = new AbortController()
    const controller = this.abortController
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout

    try {
      // Read file with progress simulation
      const fileContent = await this.readFileWithTimeout(file, controller.signal)
      clearTimeout(timeoutId)

      const options: AcApOpenDatabaseOptions = {
        minimumChunkSize: 1000,
        mode: AcEdOpenMode.Write,
        // Override line weight display setting to false so that line weights are not displayed by default
        sysVars: {
          lwdisplay: false
        }
      }

      const success = await AcApDocManager.instance.openDocument(
        file.name,
        fileContent,
        options
      )

      if (success) {
        this.onFileOpened()
        this.predefinedButtons?.forEach(item => item.classList.remove('active'))
        this.showMessage(`Successfully loaded: ${file.name}`, 'success')
      } else {
        this.showMessage(`Failed to load: ${file.name}. File may be corrupt or incompatible.`, 'error')
      }
    } catch (error) {
      // Check for abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        this.showMessage('Loading timed out. File may be too complex or network slow.', 'error')
      } else {
        log.error('Error loading file:', error)
        this.showMessage('Failed to load file. Please try a smaller file.', 'error')
      }
    } finally {
      this.setLoadingState(false)
    }
  }

private async loadPredefinedFile(url: string) {
    this.initialize()

    // Cancel any previous pending load
    this.cancelPendingLoad()
    this.setLoadingState(true)

    this.clearMessages()
    this.showMessage('Loading file from server...', 'info')

    // Network timeout for predefined files
    this.abortController = new AbortController()
    const controller = this.abortController
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

    try {
      const options: AcApOpenDatabaseOptions = {
        minimumChunkSize: 1000,
        mode: AcEdOpenMode.Write
      }

      const success = await AcApDocManager.instance.openUrl(url, options)
      clearTimeout(timeoutId)

      if (success) {
        this.onFileOpened()
        const fileName = this.getFileNameFromUrl(url)
        this.showMessage(`Successfully loaded: ${fileName}`, 'success')
      } else {
        this.showMessage(
          `Failed to load: ${this.getFileNameFromUrl(url)}. Server may be slow or file unavailable.`,
          'error'
        )
      }
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        this.showMessage('Network timeout. Check your connection and try again.', 'error')
      } else {
        log.error('Error loading predefined file:', error)
        this.showMessage(`Error loading file: ${error}`, 'error')
      }
    } finally {
      this.setLoadingState(false)
    }
  }

  private onFileOpened() {
    this.hasOpenedFile = true
    this.hasLoadedDocument = true
    this.updateEmptyStateVisibility()
    this.updateToolbarButtonsState()
  }

  private updateEmptyStateVisibility() {
    if (this.emptyState) this.emptyState.classList.toggle('hidden', this.hasOpenedFile)
  }

  private updateToolbarButtonsState() {
    if (this.toolbarZoomButton) this.toolbarZoomButton.disabled = !this.hasLoadedDocument
    if (this.toolbarZoomWindowButton) this.toolbarZoomWindowButton.disabled = !this.hasLoadedDocument
    if (this.toolbarBgButton) this.toolbarBgButton.disabled = !this.hasLoadedDocument
    if (this.toolbarPickboxButton) this.toolbarPickboxButton.disabled = !this.hasLoadedDocument
    if (this.toolbarLineWeightButton) this.toolbarLineWeightButton.disabled = !this.hasLoadedDocument
    this.updateLineWeightButtonLabel()
  }

private updateLineWeightButtonLabel() {
    if (!this.toolbarLineWeightButton) {
      return
    }
    const showLineWeight =
      this.hasLoadedDocument && this.isInitialized
        ? AcApDocManager.instance.curDocument.database.lwdisplay
        : false

    this.toolbarLineWeightButton.textContent = showLineWeight
      ? 'LineWeight: On'
      : 'LineWeight: Off'
  }

  private getFileNameFromUrl(url: string) {
    const paths = url.split('/')
    return paths[paths.length - 1] || url
  }

  // Read file with abort signal for timeout
  private async readFileWithTimeout(file: File, signal: AbortSignal): Promise<ArrayBuffer> {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = () => {
        if (!signal.aborted) {
          resolve(reader.result as ArrayBuffer)
        }
      }
      
      reader.onerror = () => {
        if (!signal.aborted) {
          reject(reader.error)
        }
      }
      
      // Listen for abort
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      
      signal.addEventListener('abort', () => {
        reader.abort()
        reject(new DOMException('Aborted', 'AbortError'))
      })
      
      reader.readAsArrayBuffer(file)
    })
  }

  private showMessage(
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ) {
    this.clearMessages()

    const popup = document.createElement('div')
    popup.className = `popup-message ${type}`
    popup.textContent = message
    popup.style.position = 'fixed'
    popup.style.top = '1rem'
    popup.style.left = '50%'
    popup.style.transform = 'translateX(-50%)'
    popup.style.zIndex = '1000'
    popup.style.padding = '0.75rem 1.25rem'
    popup.style.borderRadius = '8px'
    popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)'
    popup.style.fontSize = '0.95rem'
    popup.style.opacity = '0.98'
    popup.style.transition = 'opacity 0.2s'

    if (type === 'error') {
      popup.style.background = '#fee2e2'
      popup.style.color = '#b91c1c'
      popup.style.border = '1px solid #fecaca'
    } else if (type === 'success') {
      popup.style.background = '#dcfce7'
      popup.style.color = '#166534'
      popup.style.border = '1px solid #bbf7d0'
    } else {
      popup.style.background = '#e5e7eb'
      popup.style.color = '#111827'
      popup.style.border = '1px solid #d1d5db'
    }

    document.body.appendChild(popup)

    setTimeout(() => {
      popup.style.opacity = '0'
      setTimeout(() => {
        if (popup.parentNode) {
          popup.parentNode.removeChild(popup)
        }
      }, 200)
    }, 1200)
  }

  private clearMessages() {
    document.querySelectorAll('.popup-message').forEach(el => el.remove())
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CadViewerApp()
  })
} else {
  new CadViewerApp()
}
