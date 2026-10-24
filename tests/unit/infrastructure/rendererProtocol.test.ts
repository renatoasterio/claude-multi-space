import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ net: {}, protocol: {} }))

const { resolveBundlePath } = await import('@main/presentation/protocol/rendererProtocol')
const { originOf } = await import('@main/presentation/window/MainWindow')

const root = path.resolve('/app/out/renderer')

describe('resolveBundlePath', () => {
  it('mapeia arquivos da pasta do renderer', () => {
    expect(resolveBundlePath(root, 'app://bundle/index.html')).toBe(path.join(root, 'index.html'))
    expect(resolveBundlePath(root, 'app://bundle/assets/a.js?v=1')).toBe(
      path.join(root, 'assets', 'a.js'),
    )
    expect(resolveBundlePath(root, 'app://bundle/')).toBe(path.join(root, 'index.html'))
  })

  it('bloqueia path traversal, host e esquema desconhecidos', () => {
    // A própria URL normaliza /../ e o caminho continua preso à pasta do renderer.
    expect(resolveBundlePath(root, 'app://bundle/../main/main.js')).toBe(
      path.join(root, 'main', 'main.js'),
    )
    expect(resolveBundlePath(root, 'app://bundle/%2e%2e/%2e%2e/etc/passwd')).toBe(
      path.join(root, 'etc', 'passwd'),
    )
    // Barras codificadas só viram separador após a decodificação: aqui sim haveria fuga da pasta.
    expect(resolveBundlePath(root, 'app://bundle/..%2f..%2fmain%2fmain.js')).toBeNull()
    expect(resolveBundlePath(root, 'app://outro/index.html')).toBeNull()
    expect(resolveBundlePath(root, 'file:///etc/passwd')).toBeNull()
    expect(resolveBundlePath(root, 'não é url')).toBeNull()
  })
})

describe('originOf', () => {
  it('compara origem também para o esquema app://', () => {
    expect(originOf('app://bundle/index.html')).toBe('app://bundle')
    expect(originOf('http://localhost:5173/x')).toBe('http://localhost:5173')
    expect(originOf('chrome-error://chromewebdata/')).toBe('chrome-error://chromewebdata')
    expect(originOf('file:///a/b')).toBeNull()
  })
})
