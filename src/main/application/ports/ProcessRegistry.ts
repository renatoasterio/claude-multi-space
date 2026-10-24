import type { ProcessHandle } from './Launchers'

export interface ProcessRegistry {
  track(key: string, handle: ProcessHandle): void
  isTracked(key: string): boolean
  /** Notificado quando algum processo rastreado termina. Retorna unsubscribe. */
  onChange(listener: () => void): () => void
  dispose(): void
}
