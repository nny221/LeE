import { useEffect, useState } from 'react'
import type { WordInput, WordRecord } from '../../../shared/contracts'
import { errorMessage, familiarityLabels, formatDueAt } from '../lib/format'

const EMPTY_FORM: WordInput = {
  term: '',
  termType: 'word',
  phonetic: '',
  partOfSpeech: '',
  meaning: '',
  example: '',
  exampleTranslation: '',
  note: '',
  sourceExcerpt: ''
}

export function EditorWindow(): React.JSX.Element {
  const [form, setForm] = useState<WordInput>(EMPTY_FORM)
  const [words, setWords] = useState<WordRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadWords = async (): Promise<void> => {
    try {
      setWords(await window.lee.listWords())
      setError('')
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWords()
  }, [])

  const updateField = (field: keyof WordInput, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const createWord = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (saving) {
      return
    }

    setSaving(true)
    setError('')
    try {
      await window.lee.createWord(form)
      setForm(EMPTY_FORM)
      await loadWords()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const deleteWord = async (word: WordRecord): Promise<void> => {
    if (!window.confirm(`确认删除 “${word.term}” 吗？`)) {
      return
    }

    try {
      await window.lee.deleteWord(word.id)
      await loadWords()
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    }
  }

  return (
    <main className="window-card editor-window">
      <header className="window-titlebar">
        <div>
          <span className="eyebrow">VOCABULARY</span>
          <h1>我的词库</h1>
        </div>
        <div className="titlebar-actions no-drag">
          <button
            className="header-action"
            type="button"
            onClick={() => void window.lee.openWindow('import')}
          >
            从截图或文字导入
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭词库窗口"
            onClick={() => void window.lee.closeCurrentWindow()}
          >
            ×
          </button>
        </div>
      </header>

      <div className="editor-layout">
        <form className="word-form" onSubmit={(event) => void createWord(event)}>
          <div className="form-heading">
            <div>
              <span className="eyebrow">NEW WORD</span>
              <h2>收录生词</h2>
            </div>
            <span className="word-count">{words.length} 个词</span>
          </div>

          <label>
            单词或短语
            <input
              autoFocus
              required
              value={form.term}
              placeholder="例如：resilient"
              onChange={(event) => updateField('term', event.target.value)}
            />
          </label>

          <label>
            类型
            <select
              value={form.termType}
              onChange={(event) =>
                updateField('termType', event.target.value)
              }
            >
              <option value="word">单词</option>
              <option value="phrase">词组</option>
            </select>
          </label>

          <label>
            音标
            <input
              value={form.phonetic}
              placeholder="例如：/rɪˈzɪliənt/"
              onChange={(event) => updateField('phonetic', event.target.value)}
            />
          </label>

          <label>
            词性
            <input
              value={form.partOfSpeech}
              placeholder="例如：adjective"
              onChange={(event) =>
                updateField('partOfSpeech', event.target.value)
              }
            />
          </label>

          <label>
            中文释义
            <textarea
              required
              rows={2}
              value={form.meaning}
              placeholder="有韧性的；能迅速恢复的"
              onChange={(event) => updateField('meaning', event.target.value)}
            />
          </label>

          <label>
            原文语境句
            <textarea
              rows={2}
              value={form.example}
              placeholder="Children can be remarkably resilient."
              onChange={(event) => updateField('example', event.target.value)}
            />
          </label>

          <label>
            语境句翻译
            <textarea
              rows={2}
              value={form.exampleTranslation}
              placeholder="孩子们可能非常有韧性。"
              onChange={(event) =>
                updateField('exampleTranslation', event.target.value)
              }
            />
          </label>

          <label>
            补充笔记
            <input
              value={form.note}
              placeholder="英文解释、联想或使用场景"
              onChange={(event) => updateField('note', event.target.value)}
            />
          </label>

          <button className="button primary" type="submit" disabled={saving}>
            {saving ? '保存中…' : '加入词库'}
          </button>
          {error ? <p className="error-banner">{error}</p> : null}
        </form>

        <section className="word-list-panel">
          <div className="list-heading">
            <div>
              <span className="eyebrow">RECENT</span>
              <h2>已收录</h2>
            </div>
          </div>

          {loading ? <p className="muted">正在读取词库…</p> : null}
          {!loading && words.length === 0 ? (
            <div className="list-empty">
              <span>Aa</span>
              <p>词库还是空的，从左边加入第一个单词。</p>
            </div>
          ) : null}

          <div className="word-list">
            {words.map((word) => (
              <article className="word-row" key={word.id}>
                <div className="word-main">
                  <div className="word-term-line">
                    <h3>{word.term}</h3>
                    {word.termType === 'phrase' ? (
                      <span className="type-pill">词组</span>
                    ) : null}
                    <span className={`status-pill status-${word.familiarity}`}>
                      {familiarityLabels[word.familiarity]}
                    </span>
                  </div>
                  {word.phonetic ? <span className="word-phonetic">{word.phonetic}</span> : null}
                  <p>{word.meaning}</p>
                  {word.example ? (
                    <blockquote className="word-context">
                      {word.example}
                      {word.exampleTranslation ? (
                        <span>{word.exampleTranslation}</span>
                      ) : null}
                    </blockquote>
                  ) : null}
                  <small>
                    {formatDueAt(word.nextDueAt)} · 已复习 {word.reviewCount} 次
                  </small>
                </div>
                <button
                  className="delete-button"
                  type="button"
                  aria-label={`删除 ${word.term}`}
                  onClick={() => void deleteWord(word)}
                >
                  删除
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
