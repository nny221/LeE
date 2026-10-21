import { app, globalShortcut } from 'electron'
import type { Tray } from 'electron'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from './db/database'
import { WordRepository } from './db/word-repository'
import { registerIpcHandlers } from './ipc/register-handlers'
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

    windowManager = new WindowManager()
    registerIpcHandlers({ wordService, reviewService, windowManager })
    windowManager.createPetWindow()
    tray = createApplicationTray(windowManager)

    globalShortcut.register('CommandOrControl+Shift+E', () => {
      void windowManager?.openReview()
    })

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
