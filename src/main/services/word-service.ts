import type { WordInput, WordRecord } from '../../shared/contracts'
import { WordRepository } from '../db/word-repository'

export class WordService {
  constructor(private readonly repository: WordRepository) {}

  list(): WordRecord[] {
    return this.repository.listWords()
  }

  create(input: WordInput): WordRecord {
    if (!input.term.trim()) {
      throw new Error('单词不能为空。')
    }
    if (!input.meaning.trim()) {
      throw new Error('释义不能为空。')
    }

    try {
      return this.repository.createWord(input, Date.now())
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        throw new Error('这个单词已经存在。')
      }
      throw error
    }
  }

  delete(wordId: number): void {
    this.repository.deleteWord(wordId)
  }
}
