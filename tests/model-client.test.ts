import { createServer } from 'node:http'
import { once } from 'node:events'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ModelClient } from '../src/main/import/model-client'
import type { ModelSettingsProvider } from '../src/main/import/model-settings'

describe('ModelClient', () => {
  let receivedBody: unknown = null
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      receivedBody = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      candidateId: 'w1',
                      term: 'resilient',
                      phonetic: '/rɪˈzɪliənt/',
                      partOfSpeech: 'adjective',
                      meaningZh: '有韧性的',
                      meaningEn: 'able to recover quickly',
                      contextTranslation: '这个团队很有韧性。',
                      confidence: 0.95
                    }
                  ]
                })
              }
            }
          ]
        })
      )
    })
  })
  let baseUrl = ''

  beforeAll(async () => {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not expose a port.')
    }
    baseUrl = `http://127.0.0.1:${address.port}/v1`
  })

  afterAll(async () => {
    server.close()
    await once(server, 'close')
  })

  it('requests JSON mode and validates structured enrichment output', async () => {
    const settings: ModelSettingsProvider = {
      resolve: async () => ({
        baseUrl,
        model: 'test-model',
        apiKey: 'test-key'
      })
    }
    const client = new ModelClient(settings)
    const result = await client.enrich([
      {
        candidateId: 'w1',
        term: 'resilient',
        termType: 'word',
        contextSentence: 'The team is resilient.'
      }
    ])

    expect(receivedBody).toMatchObject({
      model: 'test-model',
      temperature: 0,
      response_format: { type: 'json_object' }
    })
    expect(result[0]).toMatchObject({
      term: 'resilient',
      meaningZh: '有韧性的',
      contextTranslation: '这个团队很有韧性。'
    })
  })
})
