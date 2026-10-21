import type { Familiarity } from '../../../shared/contracts'

export const familiarityLabels: Record<Familiarity, string> = {
  new: '新词',
  familiar: '熟悉',
  fuzzy: '模糊',
  forgotten: '忘记'
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

export function formatDueAt(timestamp: number): string {
  if (timestamp <= Date.now()) {
    return '现在复习'
  }
  return dateFormatter.format(new Date(timestamp))
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': /, '')
  }
  return '操作失败，请重试。'
}
