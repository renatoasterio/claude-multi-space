import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Profile } from '@main/domain/entities/Profile'
import { ProfileId } from '@main/domain/value-objects/ProfileId'
import { DarwinShortcuts } from '@main/infrastructure/shortcuts/DarwinShortcuts'
import { ShortcutIndex } from '@main/infrastructure/shortcuts/ShortcutIndex'
import { WinShortcuts } from '@main/infrastructure/shortcuts/WinShortcuts'
import { nextUuid } from '../fakes'

const dirs = { desktopDataDir: '/d', cliConfigDir: '/c', imported: false }
const makeProfile = (name: string, color = '#d97757') =>
  Profile.create(ProfileId.from(nextUuid()), { name, color }, dirs, new Date())

function setup() {
  const root = mkdtempSync(path.join(tmpdir(), 'mc-shortcuts-'))
  return { root, index: new ShortcutIndex(path.join(root, 'shortcuts.json')) }
}

describe('DarwinShortcuts', () => {
  it('cria um .app com Info.plist, ícone e script que abre o link do perfil', async () => {
    const { root, index } = setup()
    const shortcuts = new DarwinShortcuts(path.join(root, 'Apps'), index, 'com.test.shortcut')
    const profile = makeProfile('Work & Co')

    const bundle = await shortcuts.create(profile)
    expect(path.basename(bundle)).toBe('Claude - Work & Co.app')
    const plist = readFileSync(path.join(bundle, 'Contents', 'Info.plist'), 'utf8')
    expect(plist).toContain('<string>Claude - Work &amp; Co</string>')
    expect(plist).toContain(`com.test.shortcut.${profile.id.value}`)

    const launcher = path.join(bundle, 'Contents', 'MacOS', 'launch')
    expect(readFileSync(launcher, 'utf8')).toContain(
      `'claude-multispace://desktop/${profile.id.value}'`,
    )
    expect(statSync(launcher).mode & 0o111).not.toBe(0)
    expect(
      readFileSync(path.join(bundle, 'Contents', 'Resources', 'AppIcon.icns')).toString(
        'ascii',
        0,
        4,
      ),
    ).toBe('icns')
    expect(await shortcuts.find(profile)).toBe(bundle)
  })

  it('renomear recria no novo nome e apaga o antigo; nomes iguais ganham sufixo', async () => {
    const { root, index } = setup()
    const shortcuts = new DarwinShortcuts(path.join(root, 'Apps'), index, 'com.test.shortcut')
    const a = makeProfile('Same')
    const b = makeProfile('Same')
    const first = await shortcuts.create(a)
    const second = await shortcuts.create(b)
    expect(path.basename(second)).toBe('Claude - Same 2.app')

    a.update({ name: 'Renamed', color: '#6a9bcc' }, new Date())
    const renamed = await shortcuts.create(a)
    expect(existsSync(first)).toBe(false)
    expect(path.basename(renamed)).toBe('Claude - Renamed.app')

    await shortcuts.remove(a)
    expect(existsSync(renamed)).toBe(false)
    expect(await shortcuts.find(a)).toBeNull()
  })

  it('nunca apaga caminhos fora da pasta de atalhos, mesmo se o índice for adulterado', async () => {
    const { root, index } = setup()
    const shortcuts = new DarwinShortcuts(path.join(root, 'Apps'), index, 'com.test.shortcut')
    const profile = makeProfile('X')
    const outside = path.join(root, 'important.app')
    await import('node:fs').then((fs) => fs.mkdirSync(outside))
    await index.set(profile.id.value, outside)

    await shortcuts.remove(profile)
    expect(existsSync(outside)).toBe(true)
  })
})

describe('WinShortcuts', () => {
  it('gera .ico e chama writeShortcutLink com o link do perfil como argumento', async () => {
    const { root, index } = setup()
    const write = vi.fn(() => true)
    const shortcuts = new WinShortcuts(
      path.join(root, 'Start Menu'),
      path.join(root, 'icons'),
      index,
      { target: 'C:\\App\\Claude MultiSpace.exe', baseArgs: ['C:\\dev app'] },
      write,
    )
    const profile = makeProfile('Personal')

    const file = await shortcuts.create(profile)
    expect(path.basename(file)).toBe('Claude - Personal.lnk')
    const [, options] = write.mock.calls[0] as unknown as [string, { args: string; icon: string }]
    expect(options.args).toBe(`"C:\\dev app" claude-multispace://desktop/${profile.id.value}`)
    expect(readFileSync(options.icon).readUInt16LE(2)).toBe(1)
  })

  it('falha clara quando o Windows recusa o atalho', async () => {
    const { root, index } = setup()
    const shortcuts = new WinShortcuts(
      root,
      root,
      index,
      { target: 'x', baseArgs: [] },
      () => false,
    )
    await expect(shortcuts.create(makeProfile('A'))).rejects.toThrow('rejected')
  })
})
