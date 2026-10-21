import { useCallback, useEffect, useState } from 'react'
import type { ReviewGrade, WordRecord } from '../../../shared/contracts'
import { errorMessage } from '../lib/format'

export function ReviewWindow(): React.JSX.Element {
  const [card, setCard] = useState<WordRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadNext = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      setCard(await window.lee.getNextReview())
      setRevealed(false)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNext()
  }, [loadNext])

  const submit = async (grade: ReviewGrade): Promise<void> => {
    if (!card || submitting) {
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const result = await window.lee.submitReview(card.id, grade)
      setCard(result.nextCard)
      setRevealed(false)
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || submitting || !card) {
        return
      }

      if (event.code === 'Space' && !revealed) {
        event.preventDefault()
        setRevealed(true)
        return
      }

      if (!revealed) {
        return
      }

      if (event.key === '1') {
        void submit('wrong')
      } else if (event.key === '2') {
        void submit('partial')
      } else if (event.key === '3') {
        void submit('good')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [card, revealed, submitting, submit])

  return (
    <main className="window-card review-window">
      <header className="window-titlebar">
        <div>
          <span className="eyebrow">REVIEW</span>
          <h1>今天的生词</h1>
        </div>
        <button
          className="icon-button no-drag"
          type="button"
          aria-label="关闭复习窗口"
          onClick={() => void window.lee.closeCurrentWindow()}
        >
          ×
        </button>
      </header>

      <div className="review-content">
        {loading ? <p className="muted centered">正在找待复习的单词…</p> : null}

        {!loading && !card ? (
          <section className="empty-state">
            <div className="empty-illustration">✓</div>
            <h2>现在没有到期的单词</h2>
            <p>可以添加新词，或者等熟悉度较低的单词再次出现。</p>
            <button
              className="button primary"
              type="button"
              onClick={() => void window.lee.openWindow('editor')}
            >
              打开词库
            </button>
          </section>
        ) : null}

        {!loading && card ? (
          <>
            <section className="word-hero">
              <span className={`status-pill status-${card.familiarity}`}>
                {card.familiarity === 'new' ? '第一次见面' : '再次出现'}
              </span>
              <h2>{card.term}</h2>
              {card.phonetic ? <p className="phonetic">{card.phonetic}</p> : null}
              {!revealed ? (
                <p className="recall-hint">先在脑中回想它的意思，再揭示答案。</p>
              ) : null}
            </section>

            {!revealed ? (
              <button
                className="button reveal-button"
                type="button"
                onClick={() => setRevealed(true)}
              >
                查看释义
              </button>
            ) : (
              <section className="answer-panel">
                <span className="eyebrow">MEANING</span>
                <p className="meaning">{card.meaning}</p>
                {card.example ? (
                  <blockquote>
                    <span>EXAMPLE</span>
                    {card.example}
                  </blockquote>
                ) : null}
                {card.note ? <p className="word-note">{card.note}</p> : null}
              </section>
            )}

            {revealed ? (
              <section className="rating-panel" aria-label="选择熟悉程度">
                <p>这次回忆得怎么样？</p>
                <div className="rating-buttons">
                  <button
                    className="rating wrong"
                    type="button"
                    disabled={submitting}
                    onClick={() => void submit('wrong')}
                  >
                    <strong>错</strong>
                    <span>忘记了</span>
                  </button>
                  <button
                    className="rating partial"
                    type="button"
                    disabled={submitting}
                    onClick={() => void submit('partial')}
                  >
                    <strong>半对</strong>
                    <span>有点模糊</span>
                  </button>
                  <button
                    className="rating good"
                    type="button"
                    disabled={submitting}
                    onClick={() => void submit('good')}
                  >
                    <strong>对</strong>
                    <span>比较熟悉</span>
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {error ? <p className="error-banner">{error}</p> : null}
      </div>

      <footer className="window-footer">
        <button
          className="text-button"
          type="button"
          onClick={() => void window.lee.openWindow('editor')}
        >
          管理词库
        </button>
        <span>Space 揭示 · 1 / 2 / 3 评价</span>
      </footer>
    </main>
  )
}
