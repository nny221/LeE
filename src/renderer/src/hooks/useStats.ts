import { useEffect, useState } from 'react'
import type { AppStats } from '../../../shared/contracts'

const EMPTY_STATS: AppStats = {
  totalWords: 0,
  dueCount: 0,
  newCount: 0,
  familiarCount: 0,
  fuzzyCount: 0,
  forgottenCount: 0
}

export function useStats(): AppStats {
  const [stats, setStats] = useState<AppStats>(EMPTY_STATS)

  useEffect(() => {
    let active = true

    window.lee
      .getStats()
      .then((nextStats) => {
        if (active) {
          setStats(nextStats)
        }
      })
      .catch(console.error)

    const unsubscribe = window.lee.onStatsChanged((nextStats) => {
      if (active) {
        setStats(nextStats)
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return stats
}
