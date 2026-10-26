import { z } from 'zod'
import type { ModelSettingsProvider } from './model-settings'

const ocrSchema = z
  .object({
    text: z.string().min(1).max(30_000)
  })
  .strict()

const phraseSchema = z
  .object({
    phrases: z
      .array(
        z
          .object({
            term: z.string().min(3).max(100),
            contextSentence: z.string().min(1).max(1500)
          })
          .strict()
      )
      .max(40)
  })
  .strict()

const enrichmentSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            candidateId: z.string().min(1).max(20),
            term: z.string().min(1).max(100),
            phonetic: z.string().max(160),
            partOfSpeech: z.string().max(80),
            meaningZh: z.string().max(600),
            meaningEn: z.string().max(1000),
            contextTranslation: z.string().max(1800),
            confidence: z.number().min(0).max(1)
          })
          .strict()
      )
      .max(50)
  })
  .strict()

export interface EnrichmentInput {
  candidateId: string
  term: string
  termType: 'word' | 'phrase'
  contextSentence: string
}

export interface EnrichmentResult {
  candidateId: string
  term: string
  phonetic: string
  partOfSpeech: string
  meaningZh: string
  meaningEn: string
  contextTranslation: string
  confidence: number
}

export interface WordModelGateway {
  transcribeImage(dataUrl: string): Promise<string>
  extractPhrases(
    sourceText: string
  ): Promise<Array<{ term: string; contextSentence: string }>>
  enrich(items: EnrichmentInput[]): Promise<EnrichmentResult[]>
}

type ChatContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | {
          type: 'image_url'
          image_url: { url: string; detail: 'high' | 'auto' | 'low' }
        }
    >

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: ChatContent
}

const JSON_ONLY_RULE =
  '只返回一个 JSON 对象，不要返回 Markdown、代码围栏或任何解释。'

export class ModelClient implements WordModelGateway {
  constructor(private readonly settings: ModelSettingsProvider) {}

  async transcribeImage(dataUrl: string): Promise<string> {
    const result = await this.requestJson(
      ocrSchema,
      [
        {
          role: 'system',
          content: [
            '你是英文图片转写组件。',
            '逐字识别图片中的英文，保留原文拼写、标点和自然顺序。',
            '不要翻译、总结、改错或提取生词。',
            '返回结构必须是：{"text":"识别出的完整原文"}。',
            JSON_ONLY_RULE
          ].join('\n')
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请转写这张图片中的全部英文内容。'
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'high' }
            }
          ]
        }
      ]
    )

    return result.text.trim()
  }

  async extractPhrases(
    sourceText: string
  ): Promise<Array<{ term: string; contextSentence: string }>> {
    const result = await this.requestJson(phraseSchema, [
      {
        role: 'system',
        content: [
          '你是英语学习材料中的词组识别组件。',
          '识别对学习者有记忆价值的固定搭配、动词短语和习语。',
          '不要返回普通单词，不要返回只由冠词、代词和介词组成的片段。',
          'term 必须是原文中的连续文本，contextSentence 必须包含该词组。',
          '最多返回 30 个词组；没有合适词组时返回 {"phrases":[]}。',
          '返回结构必须是：{"phrases":[{"term":"...","contextSentence":"..."}]}。',
          JSON_ONLY_RULE
        ].join('\n')
      },
      {
        role: 'user',
        content: `请从以下原文中识别词组：\n\n${sourceText}`
      }
    ])

    return result.phrases
  }

  async enrich(
    items: EnrichmentInput[]
  ): Promise<EnrichmentResult[]> {
    if (items.length === 0) {
      return []
    }

    const result = await this.requestJson(enrichmentSchema, [
      {
        role: 'system',
        content: [
          '你是英语学习词典补全组件。',
          '为每个 candidateId 返回音标、词性、简洁中文释义、英文解释和语境句中文翻译。',
          '每个 candidateId 必须返回且只返回一次，不允许新增或删除 candidateId。',
          '不要改写 contextSentence。词组按整体含义解释，不要逐词直译。',
          '信息不确定时返回空字符串，不要猜测。',
          '返回结构必须是：',
          '{"items":[{"candidateId":"w1","term":"...","phonetic":"","partOfSpeech":"",' +
            '"meaningZh":"","meaningEn":"","contextTranslation":"","confidence":0.0}]}',
          JSON_ONLY_RULE
        ].join('\n')
      },
      {
        role: 'user',
        content: JSON.stringify({ learnerLanguage: 'zh-CN', items })
      }
    ])

    return result.items
  }

  private async requestJson<T>(
    schema: z.ZodType<T>,
    initialMessages: ChatMessage[]
  ): Promise<T> {
    const config = await this.settings.resolve()
    const endpoint = config.baseUrl.endsWith('/chat/completions')
      ? config.baseUrl
      : `${config.baseUrl}/chat/completions`
    const messages = [...initialMessages]

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {})
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0,
          max_tokens: 4096,
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(90_000)
      })

      if (!response.ok) {
        const body = (await response.text()).slice(0, 500)
        throw new Error(`模型请求失败（${response.status}）：${body}`)
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>
      }
      const content = extractMessageContent(payload)

      try {
        return schema.parse(parseJsonObject(content))
      } catch (error) {
        if (attempt === 1) {
          throw new Error(
            `模型返回内容不符合结构：${formatValidationError(error)}`
          )
        }

        messages.push(
          { role: 'assistant', content },
          {
            role: 'user',
            content: [
              '上一次返回值未通过本地结构校验。',
              `校验错误：${formatValidationError(error)}`,
              '请只返回修复后的完整 JSON 对象，不要解释。'
            ].join('\n')
          }
        )
      }
    }

    throw new Error('模型没有返回可用的 JSON。')
  }
}

function extractMessageContent(payload: {
  choices?: Array<{ message?: { content?: unknown } }>
}): string {
  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          return part.text
        }
        return ''
      })
      .join('')
  }
  throw new Error('模型响应中没有文本内容。')
}

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }
    throw new Error('响应不是 JSON 对象。')
  }
}

function formatValidationError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ')
  }
  return error instanceof Error ? error.message : String(error)
}
