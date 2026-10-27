import { useEffect, useState } from 'react'
import type {
  ImportImageAttachment,
  ImportResult,
  ModelConfigView
} from '../../../shared/contracts'
import { errorMessage } from '../lib/format'

interface SettingsForm {
  baseUrl: string
  model: string
  apiKey: string
}

const EMPTY_SETTINGS: SettingsForm = {
  baseUrl: '',
  model: '',
  apiKey: ''
}

export function ImportWindow(): React.JSX.Element {
  const [text, setText] = useState('')
  const [image, setImage] = useState<ImportImageAttachment | null>(null)
  const [config, setConfig] = useState<ModelConfigView | null>(null)
  const [settings, setSettings] = useState<SettingsForm>(EMPTY_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  useEffect(() => {
    void loadConfig()
    const stopListening = window.lee.onImportImagePending(() => {
      void takePendingImportImage()
    })
    void takePendingImportImage()
    return stopListening
  }, [])

  const loadConfig = async (): Promise<void> => {
    try {
      const nextConfig = await window.lee.getModelConfig()
      setConfig(nextConfig)
      setSettings({
        baseUrl: nextConfig.baseUrl,
        model: nextConfig.model,
        apiKey: ''
      })
      setSettingsOpen(!nextConfig.configured)
    } catch (configError) {
      setError(errorMessage(configError))
    }
  }

  const saveConfig = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setSavingConfig(true)
    setError('')
    try {
      const nextConfig = await window.lee.saveModelConfig(settings)
      setConfig(nextConfig)
      setSettings((current) => ({ ...current, apiKey: '' }))
      setSettingsOpen(false)
    } catch (configError) {
      setError(errorMessage(configError))
    } finally {
      setSavingConfig(false)
    }
  }

  const chooseImage = async (): Promise<void> => {
    setError('')
    try {
      const attachment = await window.lee.chooseImportImage()
      if (attachment) {
        await replaceImage(attachment)
      }
    } catch (imageError) {
      setError(errorMessage(imageError))
    }
  }

  const readClipboard = async (): Promise<void> => {
    setError('')
    try {
      const attachment = await window.lee.readClipboardImage()
      if (attachment) {
        await replaceImage(attachment)
      }
    } catch (imageError) {
      setError(errorMessage(imageError))
    }
  }

  const takePendingImportImage = async (): Promise<void> => {
    setError('')
    try {
      const attachment = await window.lee.takePendingImportImage()
      if (attachment) {
        await replaceImage(attachment)
      }
    } catch (imageError) {
      setError(errorMessage(imageError))
    }
  }

  const replaceImage = async (
    attachment: ImportImageAttachment
  ): Promise<void> => {
    setImage((current) => {
      if (current && current.imageId !== attachment.imageId) {
        void window.lee.discardImportImage(current.imageId)
      }
      return attachment
    })
    setResult(null)
  }

  const removeImage = async (): Promise<void> => {
    if (!image) {
      return
    }
    await window.lee.discardImportImage(image.imageId)
    setImage(null)
  }

  const runImport = async (): Promise<void> => {
    if (running) {
      return
    }
    if (!text.trim() && !image) {
      setError('请输入英文片段，或者添加一张截图。')
      return
    }

    setRunning(true)
    setError('')
    setResult(null)
    try {
      const importResult = await window.lee.runImport({
        text,
        imageId: image?.imageId ?? null
      })
      setResult(importResult)
      setText('')
      setImage(null)
    } catch (importError) {
      setError(errorMessage(importError))
      setImage(null)
    } finally {
      setRunning(false)
    }
  }

  return (
    <main className="window-card import-window">
      <header className="window-titlebar">
        <div>
          <span className="eyebrow">SMART IMPORT</span>
          <h1>截取你的英语片段</h1>
        </div>
        <div className="titlebar-actions no-drag">
          <button
            className="header-action"
            type="button"
            onClick={() => setSettingsOpen((current) => !current)}
          >
            模型设置
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭导入窗口"
            onClick={() => void window.lee.closeCurrentWindow()}
          >
            ×
          </button>
        </div>
      </header>

      <div className="import-scroll">
        <section className="model-config-strip">
          <span
            className={`config-dot ${config?.configured ? 'ready' : 'missing'}`}
          />
          <div>
            <strong>
              {config?.configured ? config.model : '还没有配置模型'}
            </strong>
            <span>
              {config?.configured
                ? config.hasApiKey
                  ? 'API Key 已安全保存'
                  : '当前未配置 API Key'
                : '配置兼容 Chat Completions 的模型地址'}
            </span>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => setSettingsOpen((current) => !current)}
          >
            {settingsOpen ? '收起' : '配置'}
          </button>
        </section>

        {settingsOpen ? (
          <form className="model-settings-panel" onSubmit={(event) => void saveConfig(event)}>
            <label>
              Base URL
              <input
                required
                value={settings.baseUrl}
                placeholder="https://api.openai.com/v1"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    baseUrl: event.target.value
                  }))
                }
              />
            </label>
            <label>
              模型名称
              <input
                required
                value={settings.model}
                placeholder="填写支持图片和 JSON 输出的模型"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    model: event.target.value
                  }))
                }
              />
            </label>
            <label>
              API Key
              <input
                type="password"
                value={settings.apiKey}
                placeholder={
                  config?.hasApiKey
                    ? '已保存，留空保持不变'
                    : '使用本地服务时可以留空'
                }
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    apiKey: event.target.value
                  }))
                }
              />
            </label>
            <button className="button primary" type="submit" disabled={savingConfig}>
              {savingConfig ? '保存中…' : '保存模型设置'}
            </button>
          </form>
        ) : null}

        <section className="import-source-card">
          <div className="import-source-heading">
            <div>
              <span className="eyebrow">SOURCE</span>
              <h2>文字或截图</h2>
            </div>
            <div className="source-actions">
              <button
                className="button subtle"
                type="button"
                disabled={running}
                onClick={() => void readClipboard()}
              >
                读取截图
              </button>
              <button
                className="button subtle"
                type="button"
                disabled={running}
                onClick={() => void chooseImage()}
              >
                选择图片
              </button>
            </div>
          </div>

          <p className="source-tip">
            按 Ctrl+Alt+L 截图后会自动显示在这里；也可以读取剪贴板或粘贴英文片段。
          </p>

          <textarea
            className="source-textarea"
            value={text}
            disabled={running}
            placeholder="Paste an English paragraph here…"
            onChange={(event) => {
              setText(event.target.value)
              setResult(null)
            }}
          />

          {image ? (
            <div className="image-attachment">
              <img src={image.previewDataUrl} alt="待识别截图预览" />
              <div>
                <strong>{image.name}</strong>
                <span>截图会与上面输入的文字一起识别</span>
              </div>
              <button
                className="text-button danger"
                type="button"
                disabled={running}
                onClick={() => void removeImage()}
              >
                移除
              </button>
            </div>
          ) : null}

          <button
            className="button primary import-button"
            type="button"
            disabled={running}
            onClick={() => void runImport()}
          >
            {running ? '正在识别、去重并写入词库…' : '识别并全部导入'}
          </button>
          {running ? (
            <div className="import-progress">
              <span />
              <p>长截图可能需要一些时间，请不要关闭窗口。</p>
            </div>
          ) : null}
        </section>

        {error ? <p className="error-banner">{error}</p> : null}

        {result ? (
          <section className="import-result">
            <div className="result-heading">
              <div>
                <span className="eyebrow">IMPORTED</span>
                <h2>本次导入完成</h2>
              </div>
              <span className="batch-id">
                {result.batchId.slice(0, 8)}
              </span>
            </div>

            <div className="result-stats">
              <div>
                <strong>{result.insertedCount}</strong>
                <span>新增</span>
              </div>
              <div>
                <strong>{result.excludedBasicCount}</strong>
                <span>基本词</span>
              </div>
              <div>
                <strong>{result.duplicateCount}</strong>
                <span>重复</span>
              </div>
              <div>
                <strong>{result.pendingEnrichmentCount}</strong>
                <span>待补全</span>
              </div>
            </div>

            {result.warnings.length > 0 ? (
              <div className="import-warnings">
                {result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            <div className="imported-word-list">
              {result.words.map((word) => (
                <article className="imported-word" key={word.id}>
                  <div className="imported-word-title">
                    <h3>{word.term}</h3>
                    {word.termType === 'phrase' ? (
                      <span className="type-pill">词组</span>
                    ) : null}
                    {word.partOfSpeech ? <small>{word.partOfSpeech}</small> : null}
                  </div>
                  <p>{word.meaning || '释义待补全'}</p>
                  {word.example ? (
                    <blockquote>
                      {word.example}
                      {word.exampleTranslation ? (
                        <span>{word.exampleTranslation}</span>
                      ) : (
                        <span className="pending-text">语境翻译待补全</span>
                      )}
                    </blockquote>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
