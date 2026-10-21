import type {
  AppStats,
  ReviewGrade,
  ReviewSubmission,
  WordRecord
} from '../../shared/contracts'
import { WordRepository } from '../db/word-repository'
import { calculateNextReview } from '../domain/scheduler'

export class ReviewService {
  constructor(private readonly repository: WordRepository) {}

  getNext(): WordRecord | null {
    return this.repository.getNextDueWord(Date.now())
  }

  submit(wordId: number, grade: ReviewGrade): ReviewSubmission {
    const previous = this.repository.getScheduleState(wordId)
    if (!previous) {
      throw new Error('找不到待复习单词。')
    }

    const now = Date.now()
    const schedule = calculateNextReview(previous, grade, now)
    const updatedWord = this.repository.applyReview(
      wordId,
      grade,
      previous.familiarity,
      schedule,
      now
    )

    return {
      updatedWord,
      nextCard: this.repository.getNextDueWord(now),
      stats: this.repository.getStats(now)
    }
  }

  getStats(): AppStats {
    return this.repository.getStats(Date.now())
  }
}
