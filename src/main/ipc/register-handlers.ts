import { BrowserWindow, ipcMain } from 'electron'
import type {
  ImportRequest,
  ModelConfigInput,
  ReviewGrade,
  WordInput,
  WindowTarget
} from '../../shared/contracts'
import { IPC_CHANNELS } from '../../shared/contracts'
import { ImportImageStore } from '../import/image-store'
import { ModelSettingsStore } from '../import/model-settings'
import { ImportService } from '../services/import-service'
import { ReviewService } from '../services/review-service'
import { WordService } from '../services/word-service'
import { WindowManager } from '../windows/window-manager'

interface IpcDependencies {
  wordService: WordService
  reviewService: ReviewService
  importService: ImportService
  modelSettings: ModelSettingsStore
  imageStore: ImportImageStore
  windowManager: WindowManager
}

export function registerIpcHandlers({
  wordService,
  reviewService,
  importService,
  modelSettings,
  imageStore,
  windowManager
}: IpcDependencies): void {
  const publishStats = (): void => {
    windowManager.broadcastStats(reviewService.getStats())
  }

  ipcMain.handle(IPC_CHANNELS.statsGet, () => reviewService.getStats())

  ipcMain.handle(IPC_CHANNELS.wordsList, () => wordService.list())

  ipcMain.handle(IPC_CHANNELS.wordsCreate, (_event, input: WordInput) => {
    const word = wordService.create(input)
    publishStats()
    return word
  })

  ipcMain.handle(IPC_CHANNELS.wordsDelete, (_event, wordId: number) => {
    wordService.delete(wordId)
    publishStats()
  })

  ipcMain.handle(IPC_CHANNELS.reviewGetNext, () => reviewService.getNext())

  ipcMain.handle(
    IPC_CHANNELS.reviewSubmit,
    (_event, wordId: number, grade: ReviewGrade) => {
      const result = reviewService.submit(wordId, grade)
      windowManager.broadcastStats(result.stats)
      return result
    }
  )

  ipcMain.handle(IPC_CHANNELS.modelConfigGet, () => modelSettings.getView())

  ipcMain.handle(
    IPC_CHANNELS.modelConfigSave,
    (_event, input: ModelConfigInput) => modelSettings.save(input)
  )

  ipcMain.handle(IPC_CHANNELS.importChooseImage, (event) =>
    imageStore.chooseFile(BrowserWindow.fromWebContents(event.sender))
  )

  ipcMain.handle(IPC_CHANNELS.importClipboardImage, () =>
    imageStore.readClipboard()
  )

  ipcMain.handle(IPC_CHANNELS.importImageTake, (event) =>
    windowManager.takePendingImportImage(event.sender)
  )

  ipcMain.handle(
    IPC_CHANNELS.importDiscardImage,
    (_event, imageId: string) => {
      imageStore.discard(imageId)
    }
  )

  ipcMain.handle(IPC_CHANNELS.importRun, async (_event, input: ImportRequest) => {
    const result = await importService.run(input)
    publishStats()
    return result
  })

  ipcMain.handle(
    IPC_CHANNELS.windowOpen,
    async (_event, target: WindowTarget) => {
      if (target === 'review') {
        await windowManager.openReview()
      } else if (target === 'editor') {
        await windowManager.openEditor()
      } else if (target === 'import') {
        await windowManager.openImport()
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.windowCloseCurrent, (event) => {
    windowManager.closeCurrent(event.sender)
  })
}
