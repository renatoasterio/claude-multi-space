import {
  Menu,
  Tray,
  nativeImage,
  type MenuItemConstructorOptions,
  type NativeImage,
} from 'electron'
import { renderProfileIconPng } from '../../infrastructure/icons/renderProfileIcon'
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
  /** Ícones por cor; só guarda as cores em uso, então não cresce indefinidamente. */
  private readonly icons = new Map<string, NativeImage>()

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
    this.pruneIcons(profiles)
    const items: MenuItemConstructorOptions[] = profiles.map((profile) => ({
      icon: this.iconFor(profile.color),
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

  /** 16pt no menu, desenhado em 32px para telas Retina. */
  private iconFor(color: string): NativeImage {
    let icon = this.icons.get(color)
    if (!icon) {
      icon = nativeImage.createFromBuffer(renderProfileIconPng(color, 32), { scaleFactor: 2 })
      this.icons.set(color, icon)
    }
    return icon
  }

  private pruneIcons(profiles: ProfileDTO[]): void {
    const inUse = new Set(profiles.map((p) => p.color))
    for (const color of this.icons.keys()) if (!inUse.has(color)) this.icons.delete(color)
  }

  destroy(): void {
    this.tray?.destroy()
    this.icons.clear()
    this.tray = null
  }
}
