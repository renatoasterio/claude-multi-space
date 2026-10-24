import { app, ipcMain, session } from 'electron'
import { resolveLocale } from '@shared/i18n/locales'
import os from 'node:os'
import path from 'node:path'
import { Credits } from '@shared/contracts/credits'
import { IpcChannels } from '@shared/contracts/ipc'
import { createContainer } from './container'
import { ProfileMapper } from './mappers/ProfileMapper'
import { registerHandlers } from './presentation/ipc/registerHandlers'
import { AppTray } from './presentation/tray/AppTray'
import { MainWindow } from './presentation/window/MainWindow'
import {
  handleRendererProtocol,
  registerRendererScheme,
  RendererOrigin,
} from './presentation/protocol/rendererProtocol'

// Esquemas privilegiados precisam ser registrados antes do app ficar pronto.
registerRendererScheme()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  bootstrap()
}

function bootstrap(): void {
  let quitting = false
  const container = createContainer({
    home: os.homedir(),
    platform: process.platform,
    env: process.env,
    systemLocale: () => resolveLocale(app.getPreferredSystemLanguages()[0] ?? app.getLocale()),
  })
  const { logger, useCases, locale } = container

  const mainWindow = new MainWindow({
    preloadPath: path.join(__dirname, '../preload/index.js'),
    devServerUrl: app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL,
    rendererUrl: `${RendererOrigin}/index.html`,
    hideOnClose: () => !quitting,
  })

  const refreshTray = async () => {
    try {
      tray.update((await useCases.listProfiles.execute()).map(ProfileMapper.toDTO))
    } catch (error) {
      logger.warn('Falha ao atualizar a tray', { error: String(error) })
    }
  }

  const notifyProfilesChanged = () => {
    mainWindow.send(IpcChannels.profilesChanged)
    void refreshTray()
  }

  const runFromTray = (task: () => Promise<void>) => {
    task().catch((error) => logger.error('Ação da tray falhou', { error: String(error) }))
  }

  const tray = new AppTray(
    path.join(app.getAppPath(), 'resources', 'trayTemplate.png'),
    {
      showWindow: () => mainWindow.show(),
      launchDesktop: (id) => runFromTray(() => useCases.launchDesktop.execute(id)),
      launchCli: (id) => runFromTray(() => useCases.launchCli.execute(id)),
    },
    locale.t,
  )

  const applyLocale = () => {
    const { t } = locale
    app.setAboutPanelOptions({
      applicationName: Credits.appName,
      applicationVersion: app.getVersion(),
      copyright: `© ${Credits.year} ${Credits.author} · ${Credits.license}`,
      credits: `${t('credits.createdBy')} ${Credits.author} — ${Credits.repositoryUrl}`,
      website: Credits.repositoryUrl,
    })
    tray.update()
  }

  const unsubscribeRegistry = container.registry.onChange(notifyProfilesChanged)
  const unsubscribeLocale = locale.onChange(applyLocale)
  let unregisterHandlers: (() => void) | null = null
  let unhandleProtocol: (() => void) | null = null

  app.on('second-instance', () => mainWindow.show())
  app.on('activate', () => mainWindow.show())
  app.on('before-quit', () => {
    quitting = true
  })
  app.on('window-all-closed', () => {
    // Com tray ativa o app continua; sem janela e sem tray, encerra.
  })
  app.on('will-quit', () => {
    unregisterHandlers?.()
    unhandleProtocol?.()
    unsubscribeRegistry()
    unsubscribeLocale()
    container.dispose()
    tray.destroy()
  })

  // Nenhum conteúdo do app precisa de câmera, microfone, notificações etc.
  app.on('web-contents-created', (_event, contents) => {
    contents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  })

  void app.whenReady().then(async () => {
    // O idioma salvo (ou o do sistema, na primeira execução) vale antes de qualquer texto aparecer.
    locale.set((await container.settings.get()).language)
    applyLocale()
    session.defaultSession.setPermissionCheckHandler(() => false)
    unhandleProtocol = handleRendererProtocol(path.join(__dirname, '../renderer'))
    unregisterHandlers = registerHandlers({
      ipcMain,
      container,
      getWindow: () => mainWindow.get(),
      isTrustedSender: mainWindow.isTrustedSender,
      onProfilesMutated: notifyProfilesChanged,
    })
    tray.create()
    void refreshTray()
    mainWindow.show()
  })
}
