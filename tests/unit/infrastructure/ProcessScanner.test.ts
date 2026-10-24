import { describe, expect, it, vi } from 'vitest'
import { ProcessScanner } from '@main/infrastructure/process/ProcessScanner'

const lines = [
  '/Applications/Claude.app/Contents/MacOS/Claude --user-data-dir=/p/aaa/desktop',
  '"C:\\Claude\\claude.exe" "--user-data-dir=C:\\Users\\A B\\p\\bbb\\desktop" --flag',
]

describe('ProcessScanner', () => {
  it('encontra o diretório exato e ignora prefixos', async () => {
    const scanner = new ProcessScanner(async () => lines)
    expect(await scanner.hasUserDataDir('/p/aaa/desktop')).toBe(true)
    expect(await scanner.hasUserDataDir('/p/aaa/desk')).toBe(false)
    expect(await scanner.hasUserDataDir('/p/zzz/desktop')).toBe(false)
  })

  it('aceita argumento entre aspas e ignora maiúsculas no Windows', async () => {
    const scanner = new ProcessScanner(async () => lines, { caseInsensitive: true })
    expect(await scanner.hasUserDataDir('c:\\users\\a b\\p\\bbb\\desktop')).toBe(true)
  })

  it('compartilha uma única consulta dentro do TTL', async () => {
    let now = 0
    const source = vi.fn(async () => lines)
    const scanner = new ProcessScanner(source, { ttlMs: 1000, now: () => now })
    await Promise.all([
      scanner.hasUserDataDir('/a'),
      scanner.hasUserDataDir('/b'),
      scanner.hasUserDataDir('/c'),
    ])
    expect(source).toHaveBeenCalledTimes(1)
    now = 1500
    await scanner.hasUserDataDir('/a')
    expect(source).toHaveBeenCalledTimes(2)
  })

  it('falha na consulta equivale a "não está rodando"', async () => {
    const scanner = new ProcessScanner(async () => {
      throw new Error('ps indisponível')
    })
    expect(await scanner.hasUserDataDir('/a')).toBe(false)
  })
})
