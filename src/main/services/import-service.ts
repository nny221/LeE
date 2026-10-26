import { randomUUID } from 'node:crypto'
import type {
  ImportRequest,
  ImportResult,
  WordInput
} from '../../shared/contracts'
import { WordRepository } from '../db/word-repository'
import type { ImportImageProvider } from '../import/image-store'
import type {
  EnrichmentInput,
  EnrichmentResult,
  WordModelGateway
} from '../import/model-client'
import {
  extractWordCandidates,
  validateModelPhrases,
  type VocabularyCandidate
} from '../import/vocabulary-extractor'

const ENRICHMENT_BATCH_SIZE = 20
const SOURCE_EXCERPT_LIMIT = 5000

export class ImportService {
  constructor(
    private readonly repository: WordRepository,
    private readonly modelClient: WordModelGateway,
    private readonly imageStore: ImportImageProvider
  ) {}

  async run(request: ImportRequest): Promise<ImportResult> {
    const typedText = request.text.trim()
    let sourceText = typedText
    const warnings: string[] = []

    try {
      if (request.imageId) {
        const image = this.imageStore.get(request.imageId)
        const imageText = await this.modelClient.transcribeImage(image.dataUrl)
        sourceText = [typedText, imageText].filter(Boolean).join('\n\n')
      }

      if (!sourceText) {
        throw new Error('请输入英文片段，或者添加一张截图。')
      }
      if (sourceText.length > 30_000) {
        throw new Error('一次导入的原文不能超过 30000 个字符。')
      }

      const wordExtraction = extractWordCandidates(sourceText)
      let phraseCandidates: VocabularyCandidate[] = []

      try {
        const phrases = await this.modelClient.extractPhrases(sourceText)
        phraseCandidates = validateModelPhrases(phrases, sourceText)
      } catch (error) {
        warnings.push(`词组识别失败，已继续导入单词：${errorText(error)}`)
      }

      const merged = deduplicateCandidates([
        ...wordExtraction.candidates,
        ...phraseCandidates
      ])
      const existing = this.repository.findExistingNormalizedTerms(
        merged.map((candidate) => candidate.normalizedTerm)
      )
      const newCandidates = merged.filter(
        (candidate) => !existing.has(candidate.normalizedTerm)
      )
      const duplicateCount = merged.length - newCandidates.length

      const enriched = await this.enrichInBatches(newCandidates, warnings)
      const batchId = randomUUID()
      const sourceExcerpt = sourceText.slice(0, SOURCE_EXCERPT_LIMIT)
      const inputs: WordInput[] = newCandidates.map((candidate) => {
        const details = enriched.get(candidate.candidateId)
        return {
          term: candidate.term,
          termType: candidate.termType,
          phonetic: details?.phonetic ?? '',
          partOfSpeech:
            details?.partOfSpeech || candidate.partOfSpeech || '',
          meaning: details?.meaningZh ?? '',
          example: candidate.contextSentence,
          exampleTranslation: details?.contextTranslation ?? '',
          note: details?.meaningEn ?? '',
          sourceExcerpt
        }
      })

      const words = this.repository.createMany(inputs, batchId, Date.now())
      const pendingEnrichmentCount = words.filter(
        (word) => word.enrichmentStatus === 'pending'
      ).length

      return {
        batchId,
        sourceText,
        insertedCount: words.length,
        duplicateCount,
        excludedBasicCount: wordExtraction.excludedBasicCount,
        pendingEnrichmentCount,
        words,
        warnings
      }
    } finally {
      if (request.imageId) {
        this.imageStore.discard(request.imageId)
      }
    }
  }

  private async enrichInBatches(
    candidates: VocabularyCandidate[],
    warnings: string[]
  ): Promise<Map<string, EnrichmentResult>> {
    const results = new Map<string, EnrichmentResult>()

    for (let start = 0; start < candidates.length; start += ENRICHMENT_BATCH_SIZE) {
      const batch = candidates.slice(start, start + ENRICHMENT_BATCH_SIZE)
      const items: EnrichmentInput[] = batch.map((candidate) => ({
        candidateId: candidate.candidateId,
        term: candidate.term,
        termType: candidate.termType,
        contextSentence: candidate.contextSentence
      }))

      try {
        const enriched = await this.modelClient.enrich(items)
        const requestedIds = new Set(items.map((item) => item.candidateId))
        for (const item of enriched) {
          if (
            requestedIds.has(item.candidateId) &&
            !results.has(item.candidateId)
          ) {
            results.set(item.candidateId, item)
          }
        }
      } catch (error) {
        warnings.push(
          `第 ${Math.floor(start / ENRICHMENT_BATCH_SIZE) + 1} 批释义补全失败，词条仍会入库：${errorText(error)}`
        )
      }
    }

    return results
  }
}

function deduplicateCandidates(
  candidates: VocabularyCandidate[]
): VocabularyCandidate[] {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    if (seen.has(candidate.normalizedTerm)) {
      return false
    }
    seen.add(candidate.normalizedTerm)
    return true
  })
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
