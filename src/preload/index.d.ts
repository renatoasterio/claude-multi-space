import type { MultiSpaceApi } from '../shared/contracts/ipc'

declare global {
  interface Window {
    api: MultiSpaceApi
  }
}

export {}
