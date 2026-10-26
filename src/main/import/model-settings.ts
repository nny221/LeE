import { app, safeStorage } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  ModelConfigInput,
  ModelConfigView
} from '../../shared/contracts'

interface StoredModelSettings {
  version: 1
  baseUrl: string
  model: string
  encryptedApiKey?: string
}

export interface ResolvedModelSettings {
  baseUrl: string
  model: string
  apiKey: string
}

export interface ModelSettingsProvider {
  resolve(): Promise<ResolvedModelSettings>
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

export class ModelSettingsStore implements ModelSettingsProvider {
  private readonly settingsPath = join(
    app.getPath('userData'),
    'model-settings.json'
  )

  async getView(): Promise<ModelConfigView> {
    const stored = await this.readStored()
    const envKey = process.env['LEE_MODEL_API_KEY']?.trim() ?? ''
    const baseUrl =
      process.env['LEE_MODEL_BASE_URL']?.trim() ||
      stored.baseUrl ||
      DEFAULT_BASE_URL
    const model = process.env['LEE_MODEL_NAME']?.trim() || stored.model || ''

    return {
      baseUrl,
      model,
      hasApiKey: Boolean(envKey || stored.encryptedApiKey),
      configured: Boolean(baseUrl && model)
    }
  }

  async save(input: ModelConfigInput): Promise<ModelConfigView> {
    const baseUrl = input.baseUrl.trim().replace(/\/+$/, '')
    const model = input.model.trim()

    assertHttpUrl(baseUrl)
    if (!model) {
      throw new Error('模型名称不能为空。')
    }

    const current = await this.readStored()
    const apiKey = input.apiKey.trim()
    let encryptedApiKey = current.encryptedApiKey

    if (apiKey) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error(
          '系统安全存储不可用。请改用 LEE_MODEL_API_KEY 环境变量配置密钥。'
        )
      }
      encryptedApiKey = safeStorage.encryptString(apiKey).toString('base64')
    }

    const next: StoredModelSettings = {
      version: 1,
      baseUrl,
      model,
      encryptedApiKey
    }
    const temporaryPath = `${this.settingsPath}.tmp`

    await mkdir(dirname(this.settingsPath), { recursive: true })
    await writeFile(temporaryPath, JSON.stringify(next, null, 2), 'utf8')
    await rename(temporaryPath, this.settingsPath)

    return this.getView()
  }

  async resolve(): Promise<ResolvedModelSettings> {
    const stored = await this.readStored()
    const baseUrl =
      process.env['LEE_MODEL_BASE_URL']?.trim() ||
      stored.baseUrl ||
      DEFAULT_BASE_URL
    const model = process.env['LEE_MODEL_NAME']?.trim() || stored.model || ''
    const envKey = process.env['LEE_MODEL_API_KEY']?.trim() ?? ''

    if (!model) {
      throw new Error('请先在导入窗口配置模型名称和 API Key。')
    }

    let apiKey = envKey
    if (!apiKey && stored.encryptedApiKey) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('当前系统无法解密已保存的 API Key。')
      }
      apiKey = safeStorage.decryptString(
        Buffer.from(stored.encryptedApiKey, 'base64')
      )
    }

    return {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      model,
      apiKey
    }
  }

  private async readStored(): Promise<StoredModelSettings> {
    try {
      const content = await readFile(this.settingsPath, 'utf8')
      const parsed = JSON.parse(content) as Partial<StoredModelSettings>
      return {
        version: 1,
        baseUrl: parsed.baseUrl || DEFAULT_BASE_URL,
        model: parsed.model || '',
        encryptedApiKey: parsed.encryptedApiKey
      }
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return {
          version: 1,
          baseUrl: DEFAULT_BASE_URL,
          model: ''
        }
      }
      throw new Error('模型设置文件损坏，请重新保存模型配置。')
    }
  }
}

function assertHttpUrl(value: string): void {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol')
    }
  } catch {
    throw new Error('模型 Base URL 必须是有效的 HTTP 或 HTTPS 地址。')
  }
}
