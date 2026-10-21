import type { DatabaseSync } from 'node:sqlite'
import type {
  AppStats,
  Familiarity,
  ReviewGrade,
  WordInput,
  WordRecord
} from '../../shared/contracts'
import type { ReviewScheduleState, ScheduledReview } from '../domain/scheduler'
import { withTransaction } from './database'

interface WordRow {
  id: number
  term: string
  normalized_term: string
  phonetic: string
  meaning: string
  example: string
  note: string
  familiarity: Familiarity
  review_count: number
  lapse_count: number
  interval_days: number
  next_due_at: number
  created_at: number
  updated_at: number
}

interface ReviewCountsRow {
  totalWords: number
  dueCount: number
  newCount: number
  familiarCount: number
  fuzzyCount: number
  forgottenCount: number
}

const WORD_SELECT = `
  SELECT
    w.id,
    w.term,
    w.normalized_term,
    w.phonetic,
    w.meaning,
    w.example,
    w.note,
    s.familiarity,
    s.review_count,
    s.lapse_count,
    s.interval_days,
    s.next_due_at,
    w.created_at,
    w.updated_at
  FROM words w
  JOIN review_states s ON s.word_id = w.id
`

function normalizeTerm(term: string): string {
  return term.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

function toWordRecord(row: WordRow): WordRecord {
  return {
    id: row.id,
    term: row.term,
    normalizedTerm: row.normalized_term,
    phonetic: row.phonetic,
    meaning: row.meaning,
    example: row.example,
    note: row.note,
    familiarity: row.familiarity,
    reviewCount: row.review_count,
    lapseCount: row.lapse_count,
    intervalDays: row.interval_days,
    nextDueAt: row.next_due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class WordRepository {
  constructor(private readonly db: DatabaseSync) {}

  listWords(): WordRecord[] {
    const rows = this.db
      .prepare(`${WORD_SELECT} ORDER BY w.created_at DESC, w.id DESC`)
      .all() as unknown as WordRow[]

    return rows.map(toWordRecord)
  }

  getWordById(wordId: number): WordRecord | null {
    const row = this.db
      .prepare(`${WORD_SELECT} WHERE w.id = ?`)
      .get(wordId) as WordRow | undefined

    return row ? toWordRecord(row) : null
  }

  getNextDueWord(now: number): WordRecord | null {
    const row = this.db
      .prepare(
        `${WORD_SELECT}
         WHERE s.next_due_at <= ?
         ORDER BY s.next_due_at ASC, w.id ASC
         LIMIT 1`
      )
      .get(now) as WordRow | undefined

    return row ? toWordRecord(row) : null
  }

  createWord(input: WordInput, now: number): WordRecord {
    const term = input.term.trim()
    const normalizedTerm = normalizeTerm(term)

    return withTransaction(this.db, () => {
      const result = this.db
        .prepare(
          `INSERT INTO words
            (term, normalized_term, phonetic, meaning, example, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          term,
          normalizedTerm,
          input.phonetic.trim(),
          input.meaning.trim(),
          input.example.trim(),
          input.note.trim(),
          now,
          now
        )

      const wordId = Number(result.lastInsertRowid)
      this.db
        .prepare(
          `INSERT INTO review_states
            (word_id, familiarity, interval_days, ease, review_count, lapse_count, next_due_at)
           VALUES (?, 'new', 0, 2.5, 0, 0, ?)`
        )
        .run(wordId, now)

      const word = this.getWordById(wordId)
      if (!word) {
        throw new Error('Failed to create word.')
      }
      return word
    })
  }

  deleteWord(wordId: number): void {
    this.db.prepare('DELETE FROM words WHERE id = ?').run(wordId)
  }

  getScheduleState(wordId: number): ReviewScheduleState | null {
    const row = this.db
      .prepare(
        `SELECT familiarity, interval_days, ease
         FROM review_states
         WHERE word_id = ?`
      )
      .get(wordId) as
      | {
          familiarity: Familiarity
          interval_days: number
          ease: number
        }
      | undefined

    if (!row) {
      return null
    }

    return {
      familiarity: row.familiarity,
      intervalDays: row.interval_days,
      ease: row.ease
    }
  }

  applyReview(
    wordId: number,
    grade: ReviewGrade,
    previousFamiliarity: Familiarity,
    schedule: ScheduledReview,
    now: number
  ): WordRecord {
    return withTransaction(this.db, () => {
      this.db
        .prepare(
          `UPDATE review_states
           SET familiarity = ?,
               interval_days = ?,
               ease = ?,
               review_count = review_count + 1,
               lapse_count = lapse_count + ?,
               last_reviewed_at = ?,
               next_due_at = ?
           WHERE word_id = ?`
        )
        .run(
          schedule.familiarity,
          schedule.intervalDays,
          schedule.ease,
          grade === 'wrong' ? 1 : 0,
          now,
          schedule.nextDueAt,
          wordId
        )

      this.db
        .prepare(
          `INSERT INTO review_events
            (word_id, rating, previous_familiarity, new_familiarity, reviewed_at, next_due_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          wordId,
          grade,
          previousFamiliarity,
          schedule.familiarity,
          now,
          schedule.nextDueAt
        )

      this.db
        .prepare('UPDATE words SET updated_at = ? WHERE id = ?')
        .run(now, wordId)

      const word = this.getWordById(wordId)
      if (!word) {
        throw new Error('Word no longer exists.')
      }
      return word
    })
  }

  getStats(now: number): AppStats {
    const row = this.db
      .prepare(
        `SELECT
           COUNT(*) AS totalWords,
           SUM(CASE WHEN s.next_due_at <= ? THEN 1 ELSE 0 END) AS dueCount,
           SUM(CASE WHEN s.familiarity = 'new' THEN 1 ELSE 0 END) AS newCount,
           SUM(CASE WHEN s.familiarity = 'familiar' THEN 1 ELSE 0 END) AS familiarCount,
           SUM(CASE WHEN s.familiarity = 'fuzzy' THEN 1 ELSE 0 END) AS fuzzyCount,
           SUM(CASE WHEN s.familiarity = 'forgotten' THEN 1 ELSE 0 END) AS forgottenCount
         FROM words w
         JOIN review_states s ON s.word_id = w.id`
      )
      .get(now) as unknown as ReviewCountsRow

    return {
      totalWords: row.totalWords ?? 0,
      dueCount: row.dueCount ?? 0,
      newCount: row.newCount ?? 0,
      familiarCount: row.familiarCount ?? 0,
      fuzzyCount: row.fuzzyCount ?? 0,
      forgottenCount: row.forgottenCount ?? 0
    }
  }
}
