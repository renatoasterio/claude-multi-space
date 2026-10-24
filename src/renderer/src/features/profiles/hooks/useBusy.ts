import { useCallback, useState } from 'react'

/** Marca ações em andamento por chave (ex.: "desktop:<id>") para desabilitar botões. */
export function useBusy() {
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set())

  const run = useCallback(async <T>(key: string, task: () => Promise<T>): Promise<T> => {
    setBusy((current) => new Set(current).add(key))
    try {
      return await task()
    } finally {
      setBusy((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }, [])

  const isBusy = useCallback((key: string) => busy.has(key), [busy])

  return { run, isBusy }
}
