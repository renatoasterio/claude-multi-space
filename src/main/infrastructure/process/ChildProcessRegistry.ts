import type { ProcessHandle } from '../../application/ports/Launchers'
import type { ProcessRegistry } from '../../application/ports/ProcessRegistry'

/** Rastreia processos lançados por perfil; remove listeners ao término para não vazar memória. */
export class ChildProcessRegistry implements ProcessRegistry {
  private readonly entries = new Map<string, () => void>()
  private readonly listeners = new Set<() => void>()

  track(key: string, handle: ProcessHandle): void {
    this.entries.get(key)?.()
    const unsubscribe = handle.onExit(() => {
      if (this.entries.get(key) !== unsubscribe) return
      this.entries.delete(key)
      this.emit()
    })
    this.entries.set(key, unsubscribe)
    this.emit()
  }

  isTracked(key: string): boolean {
    return this.entries.has(key)
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    for (const unsubscribe of this.entries.values()) unsubscribe()
    this.entries.clear()
    this.listeners.clear()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}
