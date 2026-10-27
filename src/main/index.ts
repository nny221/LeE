import { app, globalShortcut } from 'electron'
import type { Tray } from 'electron'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from './db/database'
import { WordRepository } from './db/word-repository'
import { ImportImageStore } from './import/image-store'
import { ModelClient } from './import/model-client'
import { ModelSettingsStore } from './import/model-settings'
import { registerIpcHandlers } from './ipc/register-handlers'
import {
  createScreenshotHandler,
  SCREENSHOT_SHORTCUT
} from './screenshot'
import { ImportService } from './services/import-service'
import { ReviewService } from './services/review-service'
import { WordService } from './services/word-service'
import { createApplicationTray } from './tray'
import { WindowManager } from './windows/window-manager'

let database: DatabaseSync | null = null
let tray: Tray | null = null
let windowManager: WindowManager | null = null

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    windowManager?.showPet()
  })

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.lee.englishpet')
    }

    database = openDatabase()
    const repository = new WordRepository(database)
    const wordService = new WordService(repository)
    const reviewService = new ReviewService(repository)
    const modelSettings = new ModelSettingsStore()
    const imageStore = new ImportImageStore()
    const modelClient = new ModelClient(modelSettings)
    const importService = new ImportService(
      repository,
      modelClient,
      imageStore
    )

    windowManager = new WindowManager()
    registerIpcHandlers({
      wordService,
      reviewService,
      importService,
      modelSettings,
      imageStore,
      windowManager
    })
    windowManager.createPetWindow()
    const screenshotHandler = createScreenshotHandler(imageStore, windowManager)
    tray = createApplicationTray(windowManager, screenshotHandler)

    globalShortcut.register('CommandOrControl+Shift+E', () => {
      void windowManager?.openReview()
    })
    const screenshotShortcutRegistered = globalShortcut.register(
      SCREENSHOT_SHORTCUT,
      screenshotHandler
    )
    if (!screenshotShortcutRegistered) {
      console.warn(`截图快捷键 ${SCREENSHOT_SHORTCUT} 注册失败，可能已被占用。`)
    }

    app.on('activate', () => {
      windowManager?.showPet()
    })
  })
}

app.on('window-all-closed', () => {
  // LeE lives in the tray and the pet window stays available.
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
  tray = null
  database?.close()
  database = null
})
