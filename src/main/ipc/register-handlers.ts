import { ipcMain } from 'electron'
import type {
  ReviewGrade,
  WordInput,
  WindowTarget
} from '../../shared/contracts'
import { IPC_CHANNELS } from '../../shared/contracts'
import { ReviewService } from '../services/review-service'
import { WordService } from '../services/word-service'
import { WindowManager } from '../windows/window-manager'

interface IpcDependencies {
  wordService: WordService
  reviewService: ReviewService
  windowManager: WindowManager
}

export function registerIpcHandlers({
  wordService,
  reviewService,
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

  ipcMain.handle(
    IPC_CHANNELS.windowOpen,
    async (_event, target: WindowTarget) => {
      if (target === 'review') {
        await windowManager.openReview()
      } else if (target === 'editor') {
        await windowManager.openEditor()
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.windowCloseCurrent, (event) => {
    windowManager.closeCurrent(event.sender)
  })
}
