import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { NodeDesktopDataCloner } from '@main/infrastructure/fs/NodeDesktopDataCloner'
import { NodeProfileWorkspace } from '@main/infrastructure/fs/NodeProfileWorkspace'
import { SwivelFilesSource } from '@main/infrastructure/swivel/SwivelFilesSource'
import { ProfileId } from '@main/domain/value-objects/ProfileId'
import { nextUuid } from '../fakes'

/** Monta uma pasta no formato real do Swivel (state.json + profiles/<nome>/Claude). */
function fakeSwivel(root: string, profiles: Record<string, { color?: string; cookies?: boolean }>) {
  mkdirSync(path.join(root, 'profiles'), { recursive: true })
  const colors: Record<string, string> = {}
  for (const [name, opts] of Object.entries(profiles)) {
    const claude = path.join(root, 'profiles', name, 'Claude')
    mkdirSync(path.join(claude, 'Local Storage'), { recursive: true })
    if (opts.cookies !== false) writeFileSync(path.join(claude, 'Cookies'), 'x'.repeat(100))
    writeFileSync(path.join(claude, 'Local Storage', 'a.ldb'), 'y'.repeat(50))
    writeFileSync(path.join(claude, '.swivel-manifest.json'), '{}')
    writeFileSync(path.join(root, 'profiles', name, 'safe_storage.key'), 'k')
    if (opts.color) colors[name] = opts.color
  }
  mkdirSync(path.join(root, 'profiles', '.staging-ABC'), { recursive: true })
  writeFileSync(
    path.join(root, 'state.json'),
    JSON.stringify({ activeProfile: 'Pessoal', previousProfile: 'ALBA', colors }),
  )
}

describe('SwivelFilesSource', () => {
  it('lê perfis, cor, ativo e tamanho; ignora staging e snapshots sem cookies', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'mc-swivel-'))
    fakeSwivel(root, {
      ALBA: { color: '#BE3A3A' },
      Pessoal: { color: '#4A8659' },
      Quebrado: { cookies: false },
    })
    const source = new SwivelFilesSource(root)
    expect(await source.isAvailable()).toBe(true)
    const profiles = await source.listProfiles()
    expect(profiles.map((p) => p.name)).toEqual(['ALBA', 'Pessoal'])
    expect(profiles[0]).toMatchObject({ color: '#be3a3a', active: false, sizeBytes: 152 })
    expect(profiles[1]).toMatchObject({ color: '#4a8659', active: true })
    expect(profiles[1]!.desktopDataDir).toBe(path.join(root, 'profiles', 'Pessoal', 'Claude'))
  })

  it('sem Swivel instalado: indisponível e lista vazia', async () => {
    const source = new SwivelFilesSource(path.join(mkdtempSync(path.join(tmpdir(), 'mc-')), 'nope'))
    expect(await source.isAvailable()).toBe(false)
    expect(await source.listProfiles()).toEqual([])
  })

  it('state.json inválido não derruba a listagem (só perde cor/ativo)', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'mc-swivel-'))
    fakeSwivel(root, { ALBA: { color: '#be3a3a' } })
    writeFileSync(path.join(root, 'state.json'), '{ quebrado')
    const [alba] = await new SwivelFilesSource(root).listProfiles()
    expect(alba).toMatchObject({ name: 'ALBA', color: null, active: false })
  })
})

describe('NodeDesktopDataCloner + workspace', () => {
  it('copia o snapshot para o perfil, sem o manifesto do Swivel e sem tocar na origem', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'mc-swivel-'))
    fakeSwivel(root, { ALBA: { color: '#be3a3a' } })
    const source = path.join(root, 'profiles', 'ALBA', 'Claude')
    const home = mkdtempSync(path.join(tmpdir(), 'mc-home-'))
    const profilesRoot = path.join(home, '.claude-multispace', 'profiles')
    const workspace = new NodeProfileWorkspace(profilesRoot, home, [], new NodeDesktopDataCloner())

    const id = ProfileId.from(nextUuid())
    const dirs = await workspace.provision(id, { desktopSourceDir: source, importedFrom: source })

    expect(dirs.importedFrom).toBe(source)
    expect(readFileSync(path.join(dirs.desktopDataDir, 'Cookies'), 'utf8')).toBe('x'.repeat(100))
    expect(existsSync(path.join(dirs.desktopDataDir, 'Local Storage', 'a.ldb'))).toBe(true)
    expect(existsSync(path.join(dirs.desktopDataDir, '.swivel-manifest.json'))).toBe(false)
    expect(existsSync(path.join(source, '.swivel-manifest.json'))).toBe(true)
    expect(existsSync(dirs.cliConfigDir)).toBe(true)
    if (process.platform !== 'win32') expect(statSync(dirs.desktopDataDir).mode & 0o777).toBe(0o700)
  })

  it('cópia é independente: alterar o perfil não altera o snapshot', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'mc-swivel-'))
    fakeSwivel(root, { ALBA: {} })
    const source = path.join(root, 'profiles', 'ALBA', 'Claude')
    const target = path.join(mkdtempSync(path.join(tmpdir(), 'mc-')), 'desktop')
    await new NodeDesktopDataCloner().clone(source, target)
    writeFileSync(path.join(target, 'Cookies'), 'alterado')
    expect(readFileSync(path.join(source, 'Cookies'), 'utf8')).toBe('x'.repeat(100))
  })

  it('fallback sem APFS (plataforma não-darwin) também copia', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'mc-swivel-'))
    fakeSwivel(root, { ALBA: {} })
    const source = path.join(root, 'profiles', 'ALBA', 'Claude')
    const target = path.join(mkdtempSync(path.join(tmpdir(), 'mc-')), 'desktop')
    await new NodeDesktopDataCloner('linux').clone(source, target)
    expect(readFileSync(path.join(target, 'Cookies'), 'utf8')).toBe('x'.repeat(100))
    expect(existsSync(path.join(target, '.swivel-manifest.json'))).toBe(false)
  })
})

describe('SwivelFilesSource: cache de tamanho', () => {
  it('reaproveita a soma dentro do TTL e recalcula depois', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'mc-swivel-'))
    fakeSwivel(root, { ALBA: {} })
    let now = 0
    const source = new SwivelFilesSource(root, { sizeTtlMs: 1000, now: () => now })
    const first = (await source.listProfiles())[0]!.sizeBytes
    writeFileSync(path.join(root, 'profiles', 'ALBA', 'Claude', 'extra'), 'z'.repeat(1000))
    expect((await source.listProfiles())[0]!.sizeBytes).toBe(first) // ainda em cache
    now = 2000
    expect((await source.listProfiles())[0]!.sizeBytes).toBe(first + 1000)
  })
})
