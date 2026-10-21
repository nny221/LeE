import { useState } from 'react'
import { useStats } from '../hooks/useStats'
import { errorMessage } from '../lib/format'

export function PetWindow(): React.JSX.Element {
  const stats = useStats()
  const [error, setError] = useState('')

  const isNewUser = stats.totalWords === 0

  const openMainAction = async (): Promise<void> => {
    setError('')
    try {
      await window.lee.openWindow(isNewUser ? 'editor' : 'review')
    } catch (actionError) {
      setError(errorMessage(actionError))
    }
  }

  return (
    <main className="pet-scene" aria-label="英语生词桌宠">
      <section className="pet-bubble">
        <span className="pet-status">
          {isNewUser
            ? '先收下第一个生词吧'
            : stats.dueCount > 0
              ? `有 ${stats.dueCount} 个词等你`
              : '今天已经复习完啦'}
        </span>
        <button className="pet-primary" type="button" onClick={openMainAction}>
          {isNewUser ? '添加生词' : '开始复习'}
        </button>
        <button
          className="pet-secondary"
          type="button"
          onClick={() => void window.lee.openWindow('editor')}
        >
          词库
        </button>
        {error ? <span className="pet-error">{error}</span> : null}
      </section>

      <div
        className="pet-creature"
        aria-hidden="true"
      >
        <span className="pet-ear pet-ear-left" />
        <span className="pet-ear pet-ear-right" />
        <span className="pet-head">
          <span className="pet-brow pet-brow-left" />
          <span className="pet-brow pet-brow-right" />
          <span className="pet-eye pet-eye-left" />
          <span className="pet-eye pet-eye-right" />
          <span className="pet-cheek pet-cheek-left" />
          <span className="pet-cheek pet-cheek-right" />
          <span className="pet-mouth" />
        </span>
        <span className="pet-body">
          <span className="pet-paw pet-paw-left" />
          <span className="pet-paw pet-paw-right" />
        </span>
        <span className="pet-tail" />
        {stats.dueCount > 0 ? (
          <span className="pet-due-badge">{stats.dueCount}</span>
        ) : null}
      </div>
    </main>
  )
}
