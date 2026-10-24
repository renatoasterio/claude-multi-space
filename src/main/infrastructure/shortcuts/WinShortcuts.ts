import { promises as fs } from 'node:fs'
import path from 'node:path'
import { buildDesktopLink } from '@shared/contracts/deepLink'
import type { ProfileShortcuts } from '../../application/ports/ProfileShortcuts'
import type { Profile } from '../../domain/entities/Profile'
import { isPathInside } from '../../utils/paths'
import { writeFileAtomic } from '../fs/atomicWrite'
import { encodeIco } from '../icons/imageEncoders'
import { renderProfileIconPng } from '../icons/renderProfileIcon'
import type { ShortcutIndex } from './ShortcutIndex'
import { shortcutFileName } from './shortcutNames'

export interface ShortcutLinkOptions {
  target: string
  args: string
  icon: string
  iconIndex: number
  description: string
}

/** Assinatura de `shell.writeShortcutLink` do Electron (injetada para permitir testes). */
export type WriteShortcutLink = (file: string, options: ShortcutLinkOptions) => boolean

/**
 * Cria um atalho por perfil no Menu Iniciar (pasta "Claude MultiSpace"), com ícone na cor do
 * perfil. Ele abre este app com claude-multispace://desktop/<id> como argumento.
 */
export class WinShortcuts implements ProfileShortcuts {
  readonly supported = true

  constructor(
    private readonly dir: string,
    private readonly iconsDir: string,
    private readonly index: ShortcutIndex,
    private readonly launcher: { target: string; baseArgs: string[] },
    private readonly writeShortcutLink: WriteShortcutLink,
  ) {}

  async create(profile: Profile): Promise<string> {
    await this.remove(profile)
    await fs.mkdir(this.dir, { recursive: true })

    const icon = path.join(this.iconsDir, `${profile.id.value}.ico`)
    const pngs = new Map(
      [16, 24, 32, 48, 256].map((size) => [size, renderProfileIconPng(profile.color.value, size)]),
    )
    await writeFileAtomic(icon, encodeIco(pngs))

    const file = path.join(this.dir, `${shortcutFileName(profile.name.value)}.lnk`)
    const args = [...this.launcher.baseArgs, buildDesktopLink(profile.id.value)]
      .map(quoteArg)
      .join(' ')
    const ok = this.writeShortcutLink(file, {
      target: this.launcher.target,
      args,
      icon,
      iconIndex: 0,
      description: `Claude Desktop · ${profile.name.value}`,
    })
    if (!ok) throw new Error('Windows rejected the shortcut.')
    await this.index.set(profile.id.value, file)
    return file
  }

  async remove(profile: Profile): Promise<void> {
    const existing = await this.index.get(profile.id.value)
    if (existing && isPathInside(this.dir, existing) && existing.endsWith('.lnk')) {
      await fs.rm(existing, { force: true })
    }
    await fs.rm(path.join(this.iconsDir, `${profile.id.value}.ico`), { force: true })
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
}

function quoteArg(value: string): string {
  return /[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value
}
