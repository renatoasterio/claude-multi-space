import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron'
import { Credits } from '@shared/contracts/credits'
import type { Translate } from '@shared/i18n/translate'
import type { ProfileDTO } from '@shared/schemas/profile.schema'

export interface AppTrayActions {
  showWindow(): void
  launchDesktop(id: string): void
  launchCli(id: string): void
}

/** Ícone na barra de menus / bandeja com atalhos por perfil. */
export class AppTray {
  private tray: Tray | null = null
  private profiles: ProfileDTO[] = []

  constructor(
    private readonly iconPath: string,
    private readonly actions: AppTrayActions,
    private readonly t: Translate,
  ) {}

  create(): void {
    if (this.tray) return
    const icon = nativeImage.createFromPath(this.iconPath).resize({ width: 18, height: 18 })
    icon.setTemplateImage(process.platform === 'darwin')
    this.tray = new Tray(icon)
    this.tray.setToolTip(Credits.appName)
    this.tray.on('click', () => {
      if (process.platform !== 'darwin') this.actions.showWindow()
    })
    this.update([])
  }

  update(profiles: ProfileDTO[] = this.profiles): void {
    this.profiles = profiles
    if (!this.tray) return
    const { t } = this
    const items: MenuItemConstructorOptions[] = profiles.map((profile) => ({
      label: `${profile.status.desktopRunning ? '● ' : ''}${profile.name}`,
      sublabel: profile.email ?? undefined,
      submenu: [
        { label: t('tray.openDesktop'), click: () => this.actions.launchDesktop(profile.id) },
        { label: t('tray.openCli'), click: () => this.actions.launchCli(profile.id) },
      ],
    }))
    const menu = Menu.buildFromTemplate([
      ...(items.length ? items : [{ label: t('tray.noProfiles'), enabled: false }]),
      { type: 'separator' },
      { label: t('tray.manage'), click: () => this.actions.showWindow() },
      { label: t('tray.about', { app: Credits.appName }), role: 'about' },
      { type: 'separator' },
      { label: t('tray.quit'), role: 'quit' },
    ])
    this.tray.setContextMenu(menu)
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
