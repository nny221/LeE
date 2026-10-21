import type { LeEApi } from '../../shared/contracts'

declare global {
  interface Window {
    lee: LeEApi
  }
}

export {}
