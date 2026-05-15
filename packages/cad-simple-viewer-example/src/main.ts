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

  constructor() {
    // SSR guard - only run in browser
    if (typeof document === 'undefined') {
      return
    }

    // Lazy DOM setup - fetch elements only when needed
    this.lazySetupDOM()
  }

  private lazySetupDOM() {
    this.container = document.getElementById('cad-container')
    this.fileInput = document.getElementById('fileInputElement')
    this.centerOpenButton = document.getElementById('centerOpenButton')
    this.toolbarOpenButton = document.getElementById('toolbarOpenButton')
    this.toolbarZoomButton = document.getElementById('toolbarZoomButton')
    this.toolbarZoomWindowButton = document.getElementById('toolbarZoomWindowButton')
    this.toolbarBgButton = document.getElementById('toolbarBgButton')
    this.toolbarPickboxButton = document.getElementById('toolbarPickboxButton')
    this.toolbarLineWeightButton = document.getElementById('toolbarLineWeightButton')
    this.emptyState = document.getElementById('emptyState')
    this.predefinedButtons = document.querySelectorAll(
      '#predefinedFileList .file-list-item'
    )

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

    this.isInitializing = true
    this.showMessage('Loading CAD viewer...', 'info')

    try {
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

      AcApDocManager.instance.events.documentActivated.addEventListener(
        args => {
          document.title = args.doc.docTitle
        }
      )

      this.isInitialized = true
      this.clearMessages()
      this.showMessage('CAD viewer ready', 'success')
    } catch (error) {
      log.error('Failed to initialize CAD viewer:', error)
      this.showMessage('Failed to initialize CAD viewer', 'error')
    } finally {
      this.isInitializing = false
    }
  }

  private setupFileHandling() {
    this.fileInput.addEventListener('change', event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        void this.loadLocalFile(file)
      }
      this.fileInput.value = ''
    })

    this.centerOpenButton.addEventListener('click', () => {
      this.fileInput.click()
    })

    this.toolbarOpenButton.addEventListener('click', () => {
      this.fileInput.click()
    })
  }

  private setupToolbarActions() {
    this.toolbarZoomButton.addEventListener('click', () => {
      if (!this.hasLoadedDocument || !this.isInitialized) {
        return
      }
      AcApDocManager.instance.sendStringToExecute('zoom\\nall')
    })

    this.toolbarZoomWindowButton.addEventListener('click', () => {
      if (!this.hasLoadedDocument || !this.isInitialized) {
        return
      }
      AcApDocManager.instance.sendStringToExecute('zoom\\nwindow')
    })

    this.toolbarBgButton.addEventListener('click', () => {
      if (!this.hasLoadedDocument || !this.isInitialized) {
        return
      }
      AcApDocManager.instance.sendStringToExecute('switchbg')
    })

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

    this.toolbarLineWeightButton.addEventListener('click', () => {
      if (!this.hasLoadedDocument || !this.isInitialized) {
        return
      }
      const db = AcApDocManager.instance.curDocument.database
      db.lwdisplay = !db.lwdisplay
      this.updateLineWeightButtonLabel()
    })
  }

  private setupPredefinedFileActions() {
    this.predefinedButtons.forEach(button => {
      button.addEventListener('click', () => {
        const url = button.dataset.fileUrl
        if (!url) {
          return
        }
        // Hide empty-state open button as soon as a predefined file is selected.
        this.hasOpenedFile = true
        this.updateEmptyStateVisibility()
        this.predefinedButtons.forEach(item => item.classList.remove('active'))
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

    this.clearMessages()
    this.showMessage('Loading file...', 'info')

    // AbortController for timeout
    const controller = new AbortController()
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
        this.predefinedButtons.forEach(item => item.classList.remove('active'))
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
    }
  }

private async loadPredefinedFile(url: string) {
    this.initialize()
    this.clearMessages()
    this.showMessage('Loading file from server...', 'info')

    // Network timeout for predefined files
    const controller = new AbortController()
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
    }
  }

  private onFileOpened() {
    this.hasOpenedFile = true
    this.hasLoadedDocument = true
    this.updateEmptyStateVisibility()
    this.updateToolbarButtonsState()
  }

  private updateEmptyStateVisibility() {
    this.emptyState.classList.toggle('hidden', this.hasOpenedFile)
  }

  private updateToolbarButtonsState() {
    this.toolbarZoomButton.disabled = !this.hasLoadedDocument
    this.toolbarZoomWindowButton.disabled = !this.hasLoadedDocument
    this.toolbarBgButton.disabled = !this.hasLoadedDocument
    this.toolbarPickboxButton.disabled = !this.hasLoadedDocument
    this.toolbarLineWeightButton.disabled = !this.hasLoadedDocument
    this.updateLineWeightButtonLabel()
  }

  private updateLineWeightButtonLabel() {
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

private readFile(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(file)
    })
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
