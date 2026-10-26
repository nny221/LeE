import { app, BrowserWindow, screen, type WebContents } from 'electron'
import { join } from 'node:path'
import type { AppStats, AppView, WindowTarget } from '../../shared/contracts'
import { IPC_CHANNELS } from '../../shared/contracts'

const PET_WIDTH = 200
const PET_HEIGHT = 218
const REVIEW_WIDTH = 438
const REVIEW_HEIGHT = 620
const EDITOR_WIDTH = 560
const EDITOR_HEIGHT = 690
const IMPORT_WIDTH = 760
const IMPORT_HEIGHT = 720

export class WindowManager {
  private petWindow: BrowserWindow | null = null
  private reviewWindow: BrowserWindow | null = null
  private editorWindow: BrowserWindow | null = null
  private importWindow: BrowserWindow | null = null

  createPetWindow(): void {
    if (this.petWindow && !this.petWindow.isDestroyed()) {
      this.showPet()
      return
    }

    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const { x, y, width, height } = display.workArea

    this.petWindow = this.createWindow({
      view: 'pet',
      width: PET_WIDTH,
      height: PET_HEIGHT,
      x: x + width - PET_WIDTH - 22,
      y: y + height - PET_HEIGHT - 22,
      transparent: true,
      frame: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      focusable: true
    })

    this.petWindow.on('closed', () => {
      this.petWindow = null
    })
  }

  async openReview(): Promise<void> {
    const window = this.ensureWindow('review')
    this.positionNearPet(window, REVIEW_WIDTH, REVIEW_HEIGHT)
    window.show()
    window.focus()
  }

  async openEditor(): Promise<void> {
    const window = this.ensureWindow('editor')
    this.positionNearPet(window, EDITOR_WIDTH, EDITOR_HEIGHT)
    window.show()
    window.focus()
  }

  async openImport(): Promise<void> {
    const window = this.ensureWindow('import')
    this.positionNearPet(window, IMPORT_WIDTH, IMPORT_HEIGHT)
    window.show()
    window.focus()
  }

  showPet(): void {
    if (!this.petWindow || this.petWindow.isDestroyed()) {
      this.createPetWindow()
      return
    }

    this.petWindow.show()
    this.petWindow.moveTop()
  }

  closeCurrent(sender: WebContents): void {
    const window = BrowserWindow.fromWebContents(sender)
    if (!window || window === this.petWindow) {
      return
    }

    window.close()
  }

  broadcastStats(stats: AppStats): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.statsChanged, stats)
      }
    }
  }

  private ensureWindow(target: WindowTarget): BrowserWindow {
    if (target === 'review') {
      if (!this.reviewWindow || this.reviewWindow.isDestroyed()) {
        this.reviewWindow = this.createWindow({
          view: 'review',
          width: REVIEW_WIDTH,
          height: REVIEW_HEIGHT,
          transparent: false,
          frame: false,
          resizable: false,
          skipTaskbar: false,
          alwaysOnTop: true,
          hasShadow: true,
          focusable: true
        })
        this.reviewWindow.on('closed', () => {
          this.reviewWindow = null
        })
      }
      return this.reviewWindow
    }

    if (
      target === 'editor' &&
      (!this.editorWindow || this.editorWindow.isDestroyed())
    ) {
      this.editorWindow = this.createWindow({
        view: 'editor',
        width: EDITOR_WIDTH,
        height: EDITOR_HEIGHT,
        transparent: false,
        frame: false,
        resizable: true,
        minWidth: 480,
        minHeight: 560,
        skipTaskbar: false,
        alwaysOnTop: false,
        hasShadow: true,
        focusable: true
      })
      this.editorWindow.on('closed', () => {
        this.editorWindow = null
      })
    }

    if (target === 'editor' && this.editorWindow) {
      return this.editorWindow
    }

    if (!this.importWindow || this.importWindow.isDestroyed()) {
      this.importWindow = this.createWindow({
        view: 'import',
        width: IMPORT_WIDTH,
        height: IMPORT_HEIGHT,
        transparent: false,
        frame: false,
        resizable: true,
        minWidth: 640,
        minHeight: 620,
        skipTaskbar: false,
        alwaysOnTop: false,
        hasShadow: true,
        focusable: true
      })
      this.importWindow.on('closed', () => {
        this.importWindow = null
      })
    }

    if (!this.importWindow) {
      throw new Error('Failed to create import window.')
    }
    return this.importWindow
  }

  private createWindow(options: {
    view: AppView
    width: number
    height: number
    x?: number
    y?: number
    transparent: boolean
    frame: boolean
    resizable: boolean
    minWidth?: number
    minHeight?: number
    skipTaskbar: boolean
    alwaysOnTop: boolean
    hasShadow: boolean
    focusable: boolean
  }): BrowserWindow {
    const window = new BrowserWindow({
      width: options.width,
      height: options.height,
      x: options.x,
      y: options.y,
      minWidth: options.minWidth,
      minHeight: options.minHeight,
      show: false,
      transparent: options.transparent,
      backgroundColor: options.transparent ? '#00000000' : '#f7f1e5',
      frame: options.frame,
      resizable: options.resizable,
      maximizable: options.resizable,
      minimizable: options.view !== 'pet',
      fullscreenable: false,
      skipTaskbar: options.skipTaskbar,
      alwaysOnTop: options.alwaysOnTop,
      hasShadow: options.hasShadow,
      focusable: options.focusable,
      acceptFirstMouse: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    window.setMenu(null)

    if (options.alwaysOnTop) {
      window.setAlwaysOnTop(true, 'floating')
    }

    if (process.platform === 'darwin') {
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    }

    window.on('ready-to-show', () => {
      if (options.view === 'pet') {
        window.showInactive()
      } else {
        window.show()
      }
    })

    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    if (rendererUrl) {
      const url = new URL(rendererUrl)
      url.searchParams.set('view', options.view)
      void window.loadURL(url.toString())
    } else {
      void window.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { view: options.view }
      })
    }

    return window
  }

  private positionNearPet(
    window: BrowserWindow,
    width: number,
    height: number
  ): void {
    if (!this.petWindow || this.petWindow.isDestroyed()) {
      return
    }

    const petBounds = this.petWindow.getBounds()
    const display = screen.getDisplayMatching(petBounds)
    const area = display.workArea
    const x = Math.min(
      area.x + area.width - width - 12,
      Math.max(area.x + 12, petBounds.x + petBounds.width - width)
    )
    const y = Math.min(
      area.y + area.height - height - 12,
      Math.max(area.y + 12, petBounds.y + petBounds.height - height - 8)
    )

    window.setBounds({ x: Math.round(x), y: Math.round(y), width, height })
  }
}
