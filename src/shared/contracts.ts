export type Familiarity = 'new' | 'familiar' | 'fuzzy' | 'forgotten'

export type ReviewGrade = 'good' | 'partial' | 'wrong'

export type AppView = 'pet' | 'review' | 'editor'

export interface WordInput {
  term: string
  phonetic: string
  meaning: string
  example: string
  note: string
}

export interface WordRecord {
  id: number
  term: string
  normalizedTerm: string
  phonetic: string
  meaning: string
  example: string
  note: string
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

export type WindowTarget = 'review' | 'editor'

export interface LeEApi {
  getStats: () => Promise<AppStats>
  listWords: () => Promise<WordRecord[]>
  createWord: (input: WordInput) => Promise<WordRecord>
  deleteWord: (wordId: number) => Promise<void>
  getNextReview: () => Promise<WordRecord | null>
  submitReview: (wordId: number, grade: ReviewGrade) => Promise<ReviewSubmission>
  openWindow: (target: WindowTarget) => Promise<void>
  closeCurrentWindow: () => Promise<void>
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
  windowCloseCurrent: 'window:close-current'
} as const
