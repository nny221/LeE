import { describe, expect, it } from 'vitest'
import {
  extractWordCandidates,
  validateModelPhrases
} from '../src/main/import/vocabulary-extractor'

describe('extractWordCandidates', () => {
  it('removes common words and keeps contextual vocabulary', () => {
    const source =
      'The resilient committee remained determined despite repeated setbacks.'
    const result = extractWordCandidates(source)
    const terms = result.candidates.map((candidate) => candidate.term)

    expect(terms).toContain('resilient')
    expect(terms).not.toContain('the')
    expect(terms).not.toContain('despite')
    expect(result.excludedBasicCount).toBeGreaterThan(0)
    expect(
      result.candidates.find((candidate) => candidate.term === 'resilient')
        ?.contextSentence
    ).toBe(source)
  })
})

describe('validateModelPhrases', () => {
  it('keeps phrases that exist in the source and rejects invented phrases', () => {
    const source =
      'The team needs to come up with a better solution before Friday.'
    const phrases = validateModelPhrases(
      [
        {
          term: 'come up with',
          contextSentence: source
        },
        {
          term: 'break the ice',
          contextSentence: 'We should break the ice.'
        }
      ],
      source
    )

    expect(phrases).toHaveLength(1)
    expect(phrases[0].term).toBe('come up with')
    expect(phrases[0].contextSentence).toBe(source)
  })
})
