import { describe, expect, it } from 'vitest'
import { tildify } from '@shared/utils/tildify'
import { buildChildEnv } from '@main/utils/childEnv'
import { isPathInside } from '@main/utils/paths'
import { SerialQueue } from '@main/utils/serialQueue'
import { slugify } from '@main/utils/slugify'
import { compareVersions } from '@main/utils/versions'

describe('isPathInside', () => {
  it('aceita filhos e recusa a própria raiz, irmãos e traversal', () => {
    expect(isPathInside('/a/b', '/a/b/c')).toBe(true)
    expect(isPathInside('/a/b', '/a/b')).toBe(false)
    expect(isPathInside('/a/b', '/a/bc')).toBe(false)
    expect(isPathInside('/a/b', '/a/b/../c')).toBe(false)
  })
})

describe('compareVersions', () => {
  it('ordena numericamente', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
    expect(['0.9.1', '0.10.0', '0.2.5'].sort((a, b) => compareVersions(b, a))).toEqual([
      '0.10.0',
      '0.9.1',
      '0.2.5',
    ])
  })
})

describe('slugify', () => {
  it('remove acentos e símbolos', () => {
    expect(slugify('  Ação & Trabalho! ')).toBe('acao-trabalho')
    expect(slugify('!!!')).toBe('perfil')
  })
})

describe('buildChildEnv', () => {
  it('remove variáveis do Electron e aplica overrides', () => {
    const env = buildChildEnv(
      {
        PATH: '/bin',
        ELECTRON_RUN_AS_NODE: '1',
        NODE_OPTIONS: '--inspect',
        CLAUDE_CONFIG_DIR: '/old',
      },
      { CLAUDE_CONFIG_DIR: '/new' },
    )
    expect(env).toEqual({ PATH: '/bin', CLAUDE_CONFIG_DIR: '/new' })
  })
})

describe('SerialQueue', () => {
  it('executa tarefas em ordem e continua após falhas', async () => {
    const queue = new SerialQueue()
    const order: number[] = []
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const a = queue.run(async () => {
      await delay(20)
      order.push(1)
    })
    const b = queue.run(async () => {
      order.push(2)
      throw new Error('falhou')
    })
    const c = queue.run(async () => order.push(3))
    await a
    await expect(b).rejects.toThrow('falhou')
    await c
    expect(order).toEqual([1, 2, 3])
  })
})

describe('tildify', () => {
  it('abrevia a home em caminhos posix e windows', () => {
    expect(tildify('/Users/r/.claude-cliente', '/Users/r')).toBe('~/.claude-cliente')
    expect(tildify('C:\\Users\\r\\x', 'C:\\Users\\r')).toBe('~\\x')
    expect(tildify('/Users/rr/x', '/Users/r')).toBe('/Users/rr/x')
    expect(tildify('/a', undefined)).toBe('/a')
  })
})
