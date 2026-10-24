import { promises as fs } from 'node:fs'
import path from 'node:path'
import { buildDesktopLink } from '@shared/contracts/deepLink'
import type { ProfileShortcuts } from '../../application/ports/ProfileShortcuts'
import type { Profile } from '../../domain/entities/Profile'
import { isPathInside } from '../../utils/paths'
import { quotePosix } from '../../utils/shellQuote'
import { encodeIcns, IcnsTypes } from '../icons/imageEncoders'
import { renderProfileIconPng } from '../icons/renderProfileIcon'
import type { ShortcutIndex } from './ShortcutIndex'
import { escapeXml, shortcutFileName } from './shortcutNames'

/**
 * Cria um mini app por perfil em ~/Applications/Claude MultiSpace (aparece no Launchpad e no
 * Spotlight e pode ser arrastado para o Dock). Ele só abre claude-multispace://desktop/<id>,
 * então o app principal aplica a regra de uma instância por perfil.
 */
export class DarwinShortcuts implements ProfileShortcuts {
  readonly supported = true

  constructor(
    private readonly dir: string,
    private readonly index: ShortcutIndex,
    private readonly bundleIdPrefix: string,
  ) {}

  async create(profile: Profile): Promise<string> {
    await this.remove(profile)
    const bundle = await this.availablePath(profile)
    const contents = path.join(bundle, 'Contents')
    await fs.mkdir(path.join(contents, 'MacOS'), { recursive: true })
    await fs.mkdir(path.join(contents, 'Resources'), { recursive: true })

    await fs.writeFile(
      path.join(contents, 'MacOS', 'launch'),
      `#!/bin/sh\nexec /usr/bin/open ${quotePosix(buildDesktopLink(profile.id.value))}\n`,
      { mode: 0o755 },
    )
    await fs.writeFile(
      path.join(contents, 'Resources', 'AppIcon.icns'),
      this.icon(profile.color.value),
    )
    await fs.writeFile(path.join(contents, 'PkgInfo'), 'APPL????')
    await fs.writeFile(
      path.join(contents, 'Info.plist'),
      this.infoPlist(profile, path.basename(bundle, '.app')),
    )

    await this.index.set(profile.id.value, bundle)
    return bundle
  }

  async remove(profile: Profile): Promise<void> {
    const existing = await this.index.get(profile.id.value)
    // Só apaga dentro da pasta de atalhos do app, nunca um caminho arbitrário do índice.
    if (existing && isPathInside(this.dir, existing) && existing.endsWith('.app')) {
      await fs.rm(existing, { recursive: true, force: true })
    }
    if (existing) await this.index.set(profile.id.value, null)
  }

  async find(profile: Profile): Promise<string | null> {
    const existing = await this.index.get(profile.id.value)
    if (!existing) return null
    try {
      await fs.access(existing)
      return existing
    } catch {
      return null
    }
  }

  private async availablePath(profile: Profile): Promise<string> {
    const base = shortcutFileName(profile.name.value)
    for (let i = 1; ; i++) {
      const candidate = path.join(this.dir, `${i === 1 ? base : `${base} ${i}`}.app`)
      try {
        await fs.access(candidate)
      } catch {
        return candidate
      }
    }
  }

  private icon(color: string): Buffer {
    const sizes = Object.keys(IcnsTypes).map(Number)
    return encodeIcns(new Map(sizes.map((size) => [size, renderProfileIconPng(color, size)])))
  }

  private infoPlist(profile: Profile, displayName: string): string {
    const entries: Record<string, string> = {
      CFBundleExecutable: 'launch',
      CFBundleIconFile: 'AppIcon',
      CFBundleIdentifier: `${this.bundleIdPrefix}.${profile.id.value}`,
      CFBundleName: displayName,
      CFBundleDisplayName: displayName,
      CFBundlePackageType: 'APPL',
      CFBundleShortVersionString: '1.0',
      CFBundleVersion: '1',
    }
    const body = Object.entries(entries)
      .map(([key, value]) => `  <key>${key}</key>\n  <string>${escapeXml(value)}</string>`)
      .join('\n')
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${body}
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
`
  }
}
