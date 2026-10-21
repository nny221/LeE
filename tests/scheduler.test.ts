import { describe, expect, it } from 'vitest'
import { calculateNextReview, DAY_MS, MINUTE_MS } from '../src/main/domain/scheduler'

const now = 1_800_000_000_000

describe('calculateNextReview', () => {
  it('moves a forgotten word forward by ten minutes', () => {
    const result = calculateNextReview(
      { familiarity: 'new', intervalDays: 0, ease: 2.5 },
      'wrong',
      now
    )

    expect(result.familiarity).toBe('forgotten')
    expect(result.nextDueAt).toBe(now + 10 * MINUTE_MS)
  })

  it('marks a partial recall as fuzzy', () => {
    const result = calculateNextReview(
      { familiarity: 'new', intervalDays: 0, ease: 2.5 },
      'partial',
      now
    )

    expect(result.familiarity).toBe('fuzzy')
    expect(result.intervalDays).toBe(0.5)
  })

  it('waits at least one day after a correct first review', () => {
    const result = calculateNextReview(
      { familiarity: 'new', intervalDays: 0, ease: 2.5 },
      'good',
      now
    )

    expect(result.familiarity).toBe('familiar')
    expect(result.nextDueAt).toBe(now + DAY_MS)
  })

  it('expands familiar intervals with the ease factor', () => {
    const result = calculateNextReview(
      { familiarity: 'familiar', intervalDays: 5, ease: 2.5 },
      'good',
      now
    )

    expect(result.intervalDays).toBe(12.5)
  })

  it('caps long intervals at sixty days', () => {
    const result = calculateNextReview(
      { familiarity: 'familiar', intervalDays: 50, ease: 2.5 },
      'good',
      now
    )

    expect(result.intervalDays).toBe(60)
  })
})
