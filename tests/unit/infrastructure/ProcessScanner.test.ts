import { describe, expect, it, vi } from 'vitest'
import {
  parsePidLines,
  ProcessScanner,
  type ProcessEntry,
} from '@main/infrastructure/process/ProcessScanner'

const entries: ProcessEntry[] = [
  {
    pid: 10,
    command: '/Applications/Claude.app/Contents/MacOS/Claude --user-data-dir=/p/aaa/desktop',
  },
  {
    pid: 11,
    command:
      '/Applications/Claude.app/.../Claude Helper --type=gpu-process --user-data-dir=/p/aaa/desktop',
  },
  {
    pid: 20,
    command: '"C:\\Claude\\claude.exe" "--user-data-dir=C:\\Users\\A B\\p\\bbb\\desktop" --flag',
  },
  { pid: 30, command: '/x/Claude Helper --type=renderer --user-data-dir=/p/ccc/desktop' },
]

describe('parsePidLines', () => {
  it('separa PID e linha de comando, ignorando linhas vazias', () => {
    expect(parsePidLines('  12 /bin/a --x\n\n345 C:\\b.exe "--y"\r\n')).toEqual([
      { pid: 12, command: '/bin/a --x' },
      { pid: 345, command: 'C:\\b.exe "--y"' },
    ])
  })
})

describe('ProcessScanner', () => {
  it('encontra o diretório exato e ignora prefixos', async () => {
    const scanner = new ProcessScanner(async () => entries)
    expect(await scanner.hasUserDataDir('/p/aaa/desktop')).toBe(true)
    expect(await scanner.hasUserDataDir('/p/aaa/desk')).toBe(false)
    expect(await scanner.hasUserDataDir('/p/zzz/desktop')).toBe(false)
  })

  it('aceita argumento entre aspas e ignora maiúsculas no Windows', async () => {
    const scanner = new ProcessScanner(async () => entries, { caseInsensitive: true })
    expect(await scanner.hasUserDataDir('c:\\users\\a b\\p\\bbb\\desktop')).toBe(true)
  })

  it('retorna o PID do processo principal, não dos auxiliares', async () => {
    const scanner = new ProcessScanner(async () => entries)
    expect(await scanner.findMainPid('/p/aaa/desktop')).toBe(10)
    expect(await scanner.findMainPid('/p/ccc/desktop')).toBeNull()
  })

  it('compartilha uma única consulta dentro do TTL e permite invalidar', async () => {
    let now = 0
    const source = vi.fn(async () => entries)
    const scanner = new ProcessScanner(source, { ttlMs: 1000, now: () => now })
    await Promise.all([
      scanner.hasUserDataDir('/a'),
      scanner.hasUserDataDir('/b'),
      scanner.findMainPid('/c'),
    ])
    expect(source).toHaveBeenCalledTimes(1)
    now = 1500
    await scanner.hasUserDataDir('/a')
    expect(source).toHaveBeenCalledTimes(2)
    scanner.invalidate()
    await scanner.hasUserDataDir('/a')
    expect(source).toHaveBeenCalledTimes(3)
  })

  it('falha na consulta equivale a "não está rodando"', async () => {
    const scanner = new ProcessScanner(async () => {
      throw new Error('ps indisponível')
    })
    expect(await scanner.hasUserDataDir('/a')).toBe(false)
  })
})
