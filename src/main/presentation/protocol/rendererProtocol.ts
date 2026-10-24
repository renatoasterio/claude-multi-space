import { net, protocol } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isPathInside } from '../../utils/paths'

export const RendererScheme = 'app'
export const RendererHost = 'bundle'
export const RendererOrigin = `${RendererScheme}://${RendererHost}`

/**
 * Converte app://bundle/<caminho> em arquivo dentro de `root`.
 * Retorna null para host desconhecido ou caminho fora da pasta (path traversal).
 */
export function resolveBundlePath(root: string, requestUrl: string): string | null {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }
  if (url.protocol !== `${RendererScheme}:` || url.host !== RendererHost) return null
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
  const file = path.resolve(root, relative)
  return isPathInside(root, file) ? file : null
}

/** Deve ser chamado antes de `app.whenReady()`. */
export function registerRendererScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: RendererScheme, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ])
}

/**
 * Serve a interface empacotada por app://bundle. Com o fuse grantFileProtocolExtraPrivileges
 * desligado, file:// não lê dentro do app.asar; este protocolo é a alternativa recomendada pelo
 * Electron e só expõe arquivos da pasta do renderer.
 */
export function handleRendererProtocol(root: string): () => void {
  protocol.handle(RendererScheme, (request) => {
    const file = resolveBundlePath(root, request.url)
    if (!file) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
  return () => protocol.unhandle(RendererScheme)
}
