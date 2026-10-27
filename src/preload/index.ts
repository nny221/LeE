import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppStats,
  ImportRequest,
  LeEApi,
  ModelConfigInput,
  ReviewGrade,
  WordInput,
  WindowTarget
} from '../shared/contracts'
import { IPC_CHANNELS } from '../shared/contracts'

const api: LeEApi = {
  getStats: () => ipcRenderer.invoke(IPC_CHANNELS.statsGet),
  listWords: () => ipcRenderer.invoke(IPC_CHANNELS.wordsList),
  createWord: (input: WordInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.wordsCreate, input),
  deleteWord: (wordId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.wordsDelete, wordId),
  getNextReview: () => ipcRenderer.invoke(IPC_CHANNELS.reviewGetNext),
  submitReview: (wordId: number, grade: ReviewGrade) =>
    ipcRenderer.invoke(IPC_CHANNELS.reviewSubmit, wordId, grade),
  openWindow: (target: WindowTarget) =>
    ipcRenderer.invoke(IPC_CHANNELS.windowOpen, target),
  closeCurrentWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.windowCloseCurrent),
  getModelConfig: () => ipcRenderer.invoke(IPC_CHANNELS.modelConfigGet),
  saveModelConfig: (input: ModelConfigInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.modelConfigSave, input),
  chooseImportImage: () =>
    ipcRenderer.invoke(IPC_CHANNELS.importChooseImage),
  readClipboardImage: () =>
    ipcRenderer.invoke(IPC_CHANNELS.importClipboardImage),
  takePendingImportImage: () =>
    ipcRenderer.invoke(IPC_CHANNELS.importImageTake),
  discardImportImage: (imageId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.importDiscardImage, imageId),
  runImport: (request: ImportRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.importRun, request),
  onStatsChanged: (listener: (stats: AppStats) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, stats: AppStats): void => {
      listener(stats)
    }
    ipcRenderer.on(IPC_CHANNELS.statsChanged, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.statsChanged, handler)
  },
  onImportImagePending: (listener: () => void) => {
    const handler = (): void => listener()
    ipcRenderer.on(IPC_CHANNELS.importImagePending, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.importImagePending, handler)
  }
}

contextBridge.exposeInMainWorld('lee', api)
