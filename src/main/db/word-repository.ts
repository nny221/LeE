import type { DatabaseSync } from 'node:sqlite'
import type {
  AppStats,
  Familiarity,
  ReviewGrade,
  TermType,
  WordInput,
  WordRecord
} from '../../shared/contracts'
import { normalizeTerm } from '../domain/normalization'
import type { ReviewScheduleState, ScheduledReview } from '../domain/scheduler'
import { withTransaction } from './transaction'

interface WordRow {
  id: number
  term: string
  normalized_term: string
  term_type: TermType
  phonetic: string
  part_of_speech: string
  meaning: string
  example: string
  example_translation: string
  note: string
  source_excerpt: string
  import_batch_id: string | null
  enrichment_status: 'complete' | 'pending'
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
    w.term_type,
    w.phonetic,
    w.part_of_speech,
    w.meaning,
    w.example,
    w.example_translation,
    w.note,
    w.source_excerpt,
    w.import_batch_id,
    w.enrichment_status,
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

function toWordRecord(row: WordRow): WordRecord {
  return {
    id: row.id,
    term: row.term,
    normalizedTerm: row.normalized_term,
    termType: row.term_type,
    phonetic: row.phonetic,
    partOfSpeech: row.part_of_speech,
    meaning: row.meaning,
    example: row.example,
    exampleTranslation: row.example_translation,
    note: row.note,
    sourceExcerpt: row.source_excerpt,
    importBatchId: row.import_batch_id,
    enrichmentStatus: row.enrichment_status,
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
    return withTransaction(this.db, () => this.insertWord(input, now))
  }

  createMany(
    inputs: WordInput[],
    batchId: string,
    now: number
  ): WordRecord[] {
    return withTransaction(this.db, () =>
      inputs.map((input) => this.insertWord(input, now, batchId))
    )
  }

  findExistingNormalizedTerms(normalizedTerms: string[]): Set<string> {
    if (normalizedTerms.length === 0) {
      return new Set()
    }

    const placeholders = normalizedTerms.map(() => '?').join(', ')
    const rows = this.db
      .prepare(
        `SELECT normalized_term
         FROM words
         WHERE normalized_term IN (${placeholders})`
      )
      .all(...normalizedTerms) as Array<{ normalized_term: string }>

    return new Set(rows.map((row) => row.normalized_term))
  }

  private insertWord(
    input: WordInput,
    now: number,
    importBatchId: string | null = null
  ): WordRecord {
    const term = input.term.trim()
    const normalizedTerm = normalizeTerm(term)

    const result = this.db
      .prepare(
        `INSERT INTO words
          (term, normalized_term, term_type, phonetic, part_of_speech, meaning,
           example, example_translation, note, source_excerpt, import_batch_id,
           enrichment_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        term,
        normalizedTerm,
        input.termType,
        input.phonetic.trim(),
        input.partOfSpeech.trim(),
        input.meaning.trim(),
        input.example.trim(),
        input.exampleTranslation.trim(),
        input.note.trim(),
        input.sourceExcerpt.trim(),
        importBatchId,
        input.meaning.trim() ? 'complete' : 'pending',
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
