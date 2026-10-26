import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '../src/main/db/migrations'
import { WordRepository } from '../src/main/db/word-repository'
import type {
  ImportImageProvider,
  StoredImage
} from '../src/main/import/image-store'
import type {
  EnrichmentInput,
  EnrichmentResult,
  WordModelGateway
} from '../src/main/import/model-client'
import { ImportService } from '../src/main/services/import-service'

class FakeModel implements WordModelGateway {
  async transcribeImage(): Promise<string> {
    throw new Error('not used')
  }

  async extractPhrases(): Promise<
    Array<{ term: string; contextSentence: string }>
  > {
    return [
      {
        term: 'come up with',
        contextSentence: 'The resilient team will come up with a better plan.'
      }
    ]
  }

  async enrich(items: EnrichmentInput[]): Promise<EnrichmentResult[]> {
    return items.map((item) => ({
      candidateId: item.candidateId,
      term: item.term,
      phonetic: '',
      partOfSpeech: item.termType === 'phrase' ? 'phrase' : 'word',
      meaningZh: item.term === 'resilient' ? '有韧性的' : '提出；想出',
      meaningEn: 'test meaning',
      contextTranslation: item.contextSentence.replace(
        /.*/,
        '这是一条测试翻译。'
      ),
      confidence: 0.9
    }))
  }
}

class FakeImages implements ImportImageProvider {
  get(): StoredImage {
    throw new Error('not used')
  }

  discard(): void {}
}

describe('ImportService', () => {
  it('imports contextual words and phrases, then skips duplicates', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    runMigrations(db)

    const repository = new WordRepository(db)
    const service = new ImportService(
      repository,
      new FakeModel(),
      new FakeImages()
    )
    const request = {
      text: 'The resilient team will come up with a better plan.',
      imageId: null
    }

    const first = await service.run(request)
    const rows = db
      .prepare(
        `SELECT term, term_type, example, example_translation
         FROM words
         ORDER BY term`
      )
      .all() as Array<{
      term: string
      term_type: string
      example: string
      example_translation: string
    }>

    expect(first.insertedCount).toBeGreaterThan(0)
    expect(rows.some((row) => row.term === 'resilient')).toBe(true)
    expect(
      rows.some(
        (row) => row.term === 'come up with' && row.term_type === 'phrase'
      )
    ).toBe(true)
    expect(rows.every((row) => row.example.length > 0)).toBe(true)
    expect(rows.every((row) => row.example_translation.length > 0)).toBe(true)

    const second = await service.run(request)
    expect(second.insertedCount).toBe(0)
    expect(second.duplicateCount).toBeGreaterThan(0)

    db.close()
  })
})
