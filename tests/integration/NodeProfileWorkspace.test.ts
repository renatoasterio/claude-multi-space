import { existsSync, mkdirSync, mkdtempSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ErrorCodes } from '@shared/contracts/errors'
import { Profile } from '@main/domain/entities/Profile'
import { ProfileId } from '@main/domain/value-objects/ProfileId'
import { NodeProfileWorkspace } from '@main/infrastructure/fs/NodeProfileWorkspace'
import { nextUuid } from '../fakes'

function setup() {
  const home = mkdtempSync(path.join(tmpdir(), 'mc-home-'))
  const root = path.join(home, '.claude-multispace', 'profiles')
  return { home, root, workspace: new NodeProfileWorkspace(root, home, [path.dirname(root)]) }
}

const asProfile = (id: ProfileId, dirs: Awaited<ReturnType<NodeProfileWorkspace['provision']>>) =>
  Profile.create(id, { name: 'X', color: '#000000' }, dirs, new Date())

describe('NodeProfileWorkspace', () => {
  it('cria diretórios privados (0700) para desktop e cli', async () => {
    const { workspace, root } = setup()
    const id = ProfileId.from(nextUuid())
    const dirs = await workspace.provision(id)
    expect(dirs.desktopDataDir).toBe(path.join(root, id.value, 'desktop'))
    expect(existsSync(dirs.cliConfigDir)).toBe(true)
    if (process.platform !== 'win32') expect(statSync(dirs.desktopDataDir).mode & 0o777).toBe(0o700)
  })

  it('remove só a área gerenciada e preserva diretório importado', async () => {
    const { workspace, home } = setup()
    const imported = path.join(home, '.claude-cliente')
    mkdirSync(imported)
    writeFileSync(path.join(imported, '.claude.json'), '{}')

    const id = ProfileId.from(nextUuid())
    const dirs = await workspace.provision(id, imported)
    await workspace.remove(asProfile(id, dirs))

    expect(existsSync(dirs.desktopDataDir)).toBe(false)
    expect(existsSync(path.join(imported, '.claude.json'))).toBe(true)
  })

  it.runIf(process.platform !== 'win32')(
    'recusa remover quando o diretório do perfil é symlink para fora',
    async () => {
      const { workspace, root, home } = setup()
      const outside = path.join(home, 'importante')
      mkdirSync(outside)
      mkdirSync(root, { recursive: true })
      const id = ProfileId.from(nextUuid())
      symlinkSync(outside, path.join(root, id.value))

      const profile = asProfile(id, {
        desktopDataDir: path.join(root, id.value, 'desktop'),
        cliConfigDir: '/c',
        imported: false,
      })
      await expect(workspace.remove(profile)).rejects.toMatchObject({ code: ErrorCodes.Forbidden })
      expect(existsSync(outside)).toBe(true)
    },
  )

  it('encontra ~/.claude-* com conteúdo como candidatos', async () => {
    const { workspace, home } = setup()
    for (const name of [
      '.claude-cliente',
      '.claude-meu-trabalho',
      '.claude-vazio',
      '.claude',
      'outro',
    ]) {
      mkdirSync(path.join(home, name))
    }
    writeFileSync(path.join(home, '.claude-cliente', 'x'), '')
    writeFileSync(path.join(home, '.claude-meu-trabalho', 'x'), '')
    writeFileSync(path.join(home, '.claude', 'x'), '')
    // A pasta do próprio app também casa com ~/.claude-* e tem conteúdo, mas nunca é candidata.
    mkdirSync(path.join(home, '.claude-multispace'))
    writeFileSync(path.join(home, '.claude-multispace', 'profiles.json'), '{}')

    const candidates = await workspace.findImportCandidates()
    expect(candidates.map((c) => c.suggestedName).sort()).toEqual(['Cliente', 'Meu Trabalho'])
  })
})
