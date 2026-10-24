import { BrowserWindow, shell, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'

export interface MainWindowOptions {
  preloadPath: string
  /** URL do dev server (electron-vite) ou undefined em produção. */
  devServerUrl: string | undefined
  rendererHtml: string
  /** Quando true, fechar a janela apenas a esconde (app continua na tray). */
  hideOnClose: () => boolean
}

/** Janela única do app, com renderer isolado e navegação bloqueada. */
export class MainWindow {
  private window: BrowserWindow | null = null
  private readonly trustedOrigin: string

  constructor(private readonly options: MainWindowOptions) {
    this.trustedOrigin = options.devServerUrl ? new URL(options.devServerUrl).origin : 'file://'
  }

  get(): BrowserWindow | null {
    return this.window && !this.window.isDestroyed() ? this.window : null
  }

  show(): void {
    const existing = this.get()
    if (existing) {
      if (existing.isMinimized()) existing.restore()
      existing.show()
      existing.focus()
      return
    }
    this.window = this.create()
  }

  send(channel: string): void {
    this.get()?.webContents.send(channel)
  }

  isTrustedSender = (event: IpcMainInvokeEvent): boolean => {
    const frame = event.senderFrame
    const window = this.get()
    if (!frame || !window || event.sender !== window.webContents) return false
    return this.isTrustedUrl(frame.url)
  }

  private isTrustedUrl(url: string): boolean {
    if (this.trustedOrigin === 'file://') {
      return (
        url.startsWith('file://') &&
        path.resolve(fileUrlPath(url)) === path.resolve(this.options.rendererHtml)
      )
    }
    try {
      return new URL(url).origin === this.trustedOrigin
    } catch {
      return false
    }
  }

  private create(): BrowserWindow {
    const window = new BrowserWindow({
      width: 980,
      height: 680,
      minWidth: 720,
      minHeight: 480,
      show: false,
      title: 'Claude MultiSpace',
      backgroundColor: '#1f1e1d',
      autoHideMenuBar: true,
      webPreferences: {
        preload: this.options.preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
        spellcheck: false,
        devTools: Boolean(this.options.devServerUrl),
      },
    })

    window.once('ready-to-show', () => window.show())

    // Nada de navegação ou janelas novas: links externos vão para o navegador padrão (só https).
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url)
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', (event, url) => {
      if (!this.isTrustedUrl(url)) event.preventDefault()
    })
    window.webContents.on('will-attach-webview', (event) => event.preventDefault())

    window.on('close', (event) => {
      if (this.options.hideOnClose()) {
        event.preventDefault()
        window.hide()
      }
    })
    window.once('closed', () => {
      this.window = null
    })

    if (this.options.devServerUrl) void window.loadURL(this.options.devServerUrl)
    else void window.loadFile(this.options.rendererHtml)

    return window
  }
}

function fileUrlPath(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'))
  } catch {
    return ''
  }
}
