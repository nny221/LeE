import type { Familiarity, ReviewGrade } from '../../shared/contracts'

export const DAY_MS = 24 * 60 * 60 * 1000
export const MINUTE_MS = 60 * 1000

export interface ReviewScheduleState {
  familiarity: Familiarity
  intervalDays: number
  ease: number
}

export interface ScheduledReview {
  familiarity: Familiarity
  intervalDays: number
  ease: number
  nextDueAt: number
}

export function calculateNextReview(
  current: ReviewScheduleState,
  grade: ReviewGrade,
  now: number
): ScheduledReview {
  let intervalDays: number
  let ease = current.ease
  let familiarity: Familiarity

  switch (grade) {
    case 'wrong':
      intervalDays = (10 * MINUTE_MS) / DAY_MS
      ease = Math.max(1.3, ease - 0.2)
      familiarity = 'forgotten'
      break
    case 'partial':
      intervalDays =
        current.intervalDays > 0
          ? Math.min(7, Math.max(0.5, current.intervalDays * 0.5))
          : 0.5
      ease = Math.max(1.3, ease - 0.1)
      familiarity = 'fuzzy'
      break
    case 'good':
      intervalDays =
        current.intervalDays < 1
          ? 1
          : Math.min(60, Math.max(3, current.intervalDays * ease))
      ease = Math.min(3, ease + 0.05)
      familiarity = 'familiar'
      break
  }

  return {
    familiarity,
    intervalDays,
    ease,
    nextDueAt: now + intervalDays * DAY_MS
  }
}
