import winkNLP from 'wink-nlp'
import type { ItemToken } from 'wink-nlp'
import englishModel from 'wink-eng-lite-web-model'
import wordFrequencies from 'subtlex-word-frequencies'
import type { PartOfSpeech } from 'wink-nlp'
import type { TermType } from '../../shared/contracts'
import { normalizeTerm } from '../domain/normalization'

const BASIC_WORD_LIMIT = 3500
const EXCLUDED_POS = new Set<PartOfSpeech>([
  'ADP',
  'AUX',
  'CCONJ',
  'DET',
  'NUM',
  'PART',
  'PRON',
  'PROPN',
  'PUNCT',
  'SCONJ',
  'SPACE',
  'SYM'
])

const nlp = winkNLP(englishModel)
const its = nlp.its

let basicWordSet: Set<string> | null = null

export interface VocabularyCandidate {
  candidateId: string
  term: string
  normalizedTerm: string
  termType: TermType
  partOfSpeech: string
  contextSentence: string
}

export interface WordExtractionResult {
  candidates: VocabularyCandidate[]
  excludedBasicCount: number
}

export function extractWordCandidates(
  sourceText: string
): WordExtractionResult {
  const basicWords = getBasicWordSet()
  const candidates: VocabularyCandidate[] = []
  const seen = new Set<string>()
  let excludedBasicCount = 0

  const document = nlp.readDoc(sourceText)
  document.tokens().each((token: ItemToken) => {
    if (token.out(its.type) !== 'word') {
      return
    }

    const surface = token.out().trim()
    const lemma = String(token.out(its.lemma as never) || surface)
      .trim()
      .toLocaleLowerCase('en-US')
    const normalized = normalizeTerm(lemma)
    const pos = token.out(its.pos) as PartOfSpeech

    if (!/^[a-z][a-z'-]*$/i.test(normalized) || normalized.length < 2) {
      return
    }

    const isBasic =
      Boolean(token.out(its.stopWordFlag)) ||
      basicWords.has(normalizeTerm(surface)) ||
      basicWords.has(normalized) ||
      EXCLUDED_POS.has(pos)

    if (isBasic) {
      if (!seen.has(normalized)) {
        excludedBasicCount += 1
      }
      seen.add(normalized)
      return
    }

    if (seen.has(normalized)) {
      return
    }
    seen.add(normalized)

    const sentence = token.parentSentence().out().trim() || sourceText.trim()
    candidates.push({
      candidateId: `w${candidates.length + 1}`,
      term: lemma,
      normalizedTerm: normalized,
      termType: 'word',
      partOfSpeech: pos,
      contextSentence: sentence
    })
  })

  return {
    candidates,
    excludedBasicCount
  }
}

export function validateModelPhrases(
  values: Array<{ term: string; contextSentence?: string }>,
  sourceText: string
): VocabularyCandidate[] {
  const sourceLower = sourceText.toLocaleLowerCase('en-US')
  const candidates: VocabularyCandidate[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const term = value.term.trim().replace(/\s+/g, ' ')
    const normalized = normalizeTerm(term)
    const wordCount = normalized.split(' ').filter(Boolean).length

    if (
      wordCount < 2 ||
      wordCount > 8 ||
      normalized.length > 100 ||
      !/^[a-z][a-z' -]*$/i.test(term) ||
      !sourceLower.includes(normalized) ||
      seen.has(normalized)
    ) {
      continue
    }

    const contextSentence =
      findSentenceContaining(sourceText, term) ||
      value.contextSentence?.trim() ||
      sourceText.trim()

    if (!contextSentence) {
      continue
    }

    seen.add(normalized)
    candidates.push({
      candidateId: `p${candidates.length + 1}`,
      term,
      normalizedTerm: normalized,
      termType: 'phrase',
      partOfSpeech: 'phrase',
      contextSentence
    })
  }

  return candidates
}

function findSentenceContaining(sourceText: string, term: string): string | null {
  const sentences = nlp.readDoc(sourceText).sentences().out()
  const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i')
  return sentences.find((sentence) => pattern.test(sentence)) ?? null
}

function getBasicWordSet(): Set<string> {
  if (basicWordSet) {
    return basicWordSet
  }

  basicWordSet = new Set<string>()
  const document = nlp.readDoc(
    wordFrequencies.slice(0, BASIC_WORD_LIMIT).join(' ')
  )
  document.tokens().each((token: ItemToken) => {
    const value = normalizeTerm(token.out())
    const lemma = normalizeTerm(
      String(token.out(its.lemma as never) || value)
    )
    if (value) {
      basicWordSet?.add(value)
    }
    if (lemma) {
      basicWordSet?.add(lemma)
    }
  })

  return basicWordSet
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
