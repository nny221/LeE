export type Familiarity = 'new' | 'familiar' | 'fuzzy' | 'forgotten'

export type ReviewGrade = 'good' | 'partial' | 'wrong'

export type TermType = 'word' | 'phrase'

export type AppView = 'pet' | 'review' | 'editor' | 'import'

export interface WordInput {
  term: string
  termType: TermType
  phonetic: string
  partOfSpeech: string
  meaning: string
  example: string
  exampleTranslation: string
  note: string
  sourceExcerpt: string
}

export interface WordRecord {
  id: number
  term: string
  normalizedTerm: string
  termType: TermType
  phonetic: string
  partOfSpeech: string
  meaning: string
  example: string
  exampleTranslation: string
  note: string
  sourceExcerpt: string
  importBatchId: string | null
  enrichmentStatus: 'complete' | 'pending'
  familiarity: Familiarity
  reviewCount: number
  lapseCount: number
  intervalDays: number
  nextDueAt: number
  createdAt: number
  updatedAt: number
}

export interface AppStats {
  totalWords: number
  dueCount: number
  newCount: number
  familiarCount: number
  fuzzyCount: number
  forgottenCount: number
}

export interface ReviewSubmission {
  updatedWord: WordRecord
  nextCard: WordRecord | null
  stats: AppStats
}

export interface ModelConfigView {
  baseUrl: string
  model: string
  hasApiKey: boolean
  configured: boolean
}

export interface ModelConfigInput {
  baseUrl: string
  model: string
  apiKey: string
}

export interface ImportImageAttachment {
  imageId: string
  name: string
  previewDataUrl: string
}

export interface ImportRequest {
  text: string
  imageId: string | null
}

export interface ImportResult {
  batchId: string
  sourceText: string
  insertedCount: number
  duplicateCount: number
  excludedBasicCount: number
  pendingEnrichmentCount: number
  words: WordRecord[]
  warnings: string[]
}

export type WindowTarget = 'review' | 'editor' | 'import'

export interface LeEApi {
  getStats: () => Promise<AppStats>
  listWords: () => Promise<WordRecord[]>
  createWord: (input: WordInput) => Promise<WordRecord>
  deleteWord: (wordId: number) => Promise<void>
  getNextReview: () => Promise<WordRecord | null>
  submitReview: (wordId: number, grade: ReviewGrade) => Promise<ReviewSubmission>
  openWindow: (target: WindowTarget) => Promise<void>
  closeCurrentWindow: () => Promise<void>
  getModelConfig: () => Promise<ModelConfigView>
  saveModelConfig: (input: ModelConfigInput) => Promise<ModelConfigView>
  chooseImportImage: () => Promise<ImportImageAttachment | null>
  readClipboardImage: () => Promise<ImportImageAttachment | null>
  discardImportImage: (imageId: string) => Promise<void>
  runImport: (request: ImportRequest) => Promise<ImportResult>
  onStatsChanged: (listener: (stats: AppStats) => void) => () => void
}

export const IPC_CHANNELS = {
  statsGet: 'stats:get',
  statsChanged: 'stats:changed',
  wordsList: 'words:list',
  wordsCreate: 'words:create',
  wordsDelete: 'words:delete',
  reviewGetNext: 'review:get-next',
  reviewSubmit: 'review:submit',
  windowOpen: 'window:open',
  windowCloseCurrent: 'window:close-current',
  modelConfigGet: 'model:config:get',
  modelConfigSave: 'model:config:save',
  importChooseImage: 'import:image:choose',
  importClipboardImage: 'import:image:clipboard',
  importDiscardImage: 'import:image:discard',
  importRun: 'import:run'
} as const
