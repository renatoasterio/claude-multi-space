import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs'
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

describe('cópia do CLAUDE_CONFIG_DIR (~/.claude) para o perfil', () => {
  /** Monta um ~/.claude com histórico, caches e manifestos de plugin com caminho absoluto. */
  function fakeClaudeHome(home: string) {
    const dir = path.join(home, '.claude')
    for (const sub of [
      'projects/-Users-u-proj',
      'plugins',
      'cache',
      'telemetry',
      'sessions',
      'ide',
    ]) {
      mkdirSync(path.join(dir, sub), { recursive: true })
    }
    writeFileSync(
      path.join(dir, '.claude.json'),
      JSON.stringify({ oauthAccount: { emailAddress: 'a@b' } }),
    )
    writeFileSync(path.join(dir, 'settings.json'), '{}')
    writeFileSync(path.join(dir, 'projects', '-Users-u-proj', 's1.jsonl'), '{"type":"user"}\n')
    writeFileSync(
      path.join(dir, 'plugins', 'installed_plugins.json'),
      JSON.stringify({ plugins: { x: { installPath: `${dir}/plugins/cache/x` } } }),
    )
    writeFileSync(path.join(dir, 'cache', 'big.bin'), 'c'.repeat(100))
    writeFileSync(path.join(dir, 'telemetry', 't.log'), 't')
    writeFileSync(path.join(dir, 'sessions', '123.json'), '{}')
    writeFileSync(path.join(dir, 'ide', '1.lock'), '')
    return dir
  }

  it('leva histórico e plugins, deixa caches/sessões vivas e religa os caminhos absolutos', async () => {
    const home = mkdtempSync(path.join(tmpdir(), 'mc-home-'))
    const source = fakeClaudeHome(home)
    const profilesRoot = path.join(home, '.claude-multispace', 'profiles')
    const workspace = new NodeProfileWorkspace(profilesRoot, home, [], new NodeDesktopDataCloner())

    const id = ProfileId.from(nextUuid())
    const dirs = await workspace.provision(id, { cliSourceDir: source })

    const cli = dirs.cliConfigDir
    expect(cli).toBe(path.join(profilesRoot, id.value, 'cli'))
    expect(existsSync(path.join(cli, 'projects', '-Users-u-proj', 's1.jsonl'))).toBe(true)
    expect(existsSync(path.join(cli, '.claude.json'))).toBe(true)
    expect(existsSync(path.join(cli, 'settings.json'))).toBe(true)
    for (const skipped of ['cache', 'telemetry', 'sessions', 'ide']) {
      expect(existsSync(path.join(cli, skipped))).toBe(false)
    }
    const plugins = readFileSync(path.join(cli, 'plugins', 'installed_plugins.json'), 'utf8')
    expect(plugins).toContain(`${cli}/plugins/cache/x`)
    // `${cli}` começa com `${source}-multispace…`, então o teste real é o caminho antigo + separador.
    expect(plugins).not.toContain(`${source}/`)
    // Origem intacta, inclusive o manifesto com o caminho antigo.
    expect(readFileSync(path.join(source, 'plugins', 'installed_plugins.json'), 'utf8')).toContain(
      source,
    )
    expect(existsSync(path.join(source, 'cache', 'big.bin'))).toBe(true)
    if (process.platform !== 'win32') expect(statSync(cli).mode & 0o777).toBe(0o700)
  })

  it('Desktop e CLI copiados juntos no mesmo provision', async () => {
    const home = mkdtempSync(path.join(tmpdir(), 'mc-home-'))
    const cliSource = fakeClaudeHome(home)
    const swivelRoot = path.join(home, 'swivel')
    fakeSwivel(swivelRoot, { ALBA: {} })
    const desktopSource = path.join(swivelRoot, 'profiles', 'ALBA', 'Claude')
    const workspace = new NodeProfileWorkspace(
      path.join(home, 'p'),
      home,
      [],
      new NodeDesktopDataCloner(),
    )

    const dirs = await workspace.provision(ProfileId.from(nextUuid()), {
      desktopSourceDir: desktopSource,
      cliSourceDir: cliSource,
      importedFrom: desktopSource,
    })
    expect(readFileSync(path.join(dirs.desktopDataDir, 'Cookies'), 'utf8')).toBe('x'.repeat(100))
    expect(existsSync(path.join(dirs.cliConfigDir, 'projects'))).toBe(true)
    expect(dirs.importedFrom).toBe(desktopSource)
  })

  it('SwivelFilesSource informa o ~/.claude só quando ele existe', async () => {
    const home = mkdtempSync(path.join(tmpdir(), 'mc-home-'))
    const swivelRoot = path.join(home, 'swivel')
    fakeSwivel(swivelRoot, { ALBA: {} })
    const missing = new SwivelFilesSource(swivelRoot, { cliConfigDir: path.join(home, '.claude') })
    expect(await missing.sharedCliConfigDir()).toBeNull()
    fakeClaudeHome(home)
    expect(await missing.sharedCliConfigDir()).toBe(path.join(home, '.claude'))
    expect(await new SwivelFilesSource(swivelRoot).sharedCliConfigDir()).toBeNull()
  })
})

describe('cópia de origem que é symlink (~/.claude relocado)', () => {
  it.runIf(process.platform !== 'win32')(
    'copia o conteúdo real (não o link), exclui e religa com o caminho real',
    async () => {
      const home = realpathSync(mkdtempSync(path.join(tmpdir(), 'mc-home-')))
      const real = path.join(home, 'Volumes-Data', 'claude-config')
      mkdirSync(path.join(real, 'projects', 'p'), { recursive: true })
      mkdirSync(path.join(real, 'plugins'), { recursive: true })
      mkdirSync(path.join(real, 'cache'), { recursive: true })
      writeFileSync(path.join(real, 'projects', 'p', 's.jsonl'), '{}\n')
      writeFileSync(path.join(real, 'cache', 'c'), 'c')
      // O manifesto guarda o caminho REAL (é o que o Claude grava), não o symlink.
      writeFileSync(
        path.join(real, 'plugins', 'installed_plugins.json'),
        JSON.stringify({ a: `${real}/plugins/cache/a`, b: `${real}-outro/x` }),
      )
      const link = path.join(home, '.claude')
      const { symlinkSync, lstatSync } = await import('node:fs')
      symlinkSync(real, link)

      const target = path.join(home, 'p', 'cli')
      await new NodeDesktopDataCloner().clone(link, target, {
        skipTopLevel: ['cache'],
        rewrite: { rules: [{ from: link }], files: ['plugins/installed_plugins.json'] },
      })

      expect(lstatSync(target).isSymbolicLink()).toBe(false)
      expect(existsSync(path.join(target, 'projects', 'p', 's.jsonl'))).toBe(true)
      expect(existsSync(path.join(target, 'cache'))).toBe(false)
      expect(existsSync(path.join(real, 'cache', 'c'))).toBe(true) // origem intacta
      const manifest = readFileSync(path.join(target, 'plugins', 'installed_plugins.json'), 'utf8')
      expect(manifest).toContain(`${target}/plugins/cache/a`)
      expect(manifest).toContain(`${real}-outro/x`) // prefixo parecido não é tocado
    },
  )
})

describe('estado da aba Code vindo da pasta do Claude padrão', () => {
  const ACC = 'ca0c80de-0000-4000-8000-000000000001'
  const ORG = '47e58d47-0000-4000-8000-000000000002'

  /** Pasta do Claude Desktop em uso, com o índice de sessões que o Swivel não copia. */
  function fakeLiveClaude(home: string, cliDir: string) {
    const live = path.join(home, 'Library', 'Application Support', 'Claude')
    const sessions = path.join(live, 'claude-code-sessions', ACC, ORG)
    mkdirSync(sessions, { recursive: true })
    writeFileSync(
      path.join(sessions, 'local_abc.json'),
      JSON.stringify({
        title: 'Sessão A',
        cwd: `${live}/scratch-workspaces/${ACC}/x`,
        planPath: `${cliDir}/plans/p.md`,
        sessionPermissionUpdates: [{ directories: [`${live}/side-session-notes/local_abc`] }],
      }),
    )
    writeFileSync(path.join(sessions, 'archived-sessions.idx'), '{"v":1,"archived":[]}')
    mkdirSync(path.join(live, 'local-agent-mode-sessions', ACC, ORG, 's1'), { recursive: true })
    writeFileSync(path.join(live, 'local-agent-mode-sessions', ACC, ORG, 's1', 'tasks.json'), '{}')
    mkdirSync(path.join(live, 'claude-code', '2.1.0'), { recursive: true }) // binário: não copiar
    writeFileSync(path.join(live, 'Cookies'), 'cookies-da-conta-ativa') // não copiar
    return live
  }

  it('copia o índice de sessões e tarefas, religa caminhos e deixa binários/cookies de fora', async () => {
    const home = realpathSync(mkdtempSync(path.join(tmpdir(), 'mc-home-')))
    const cliSource = path.join(home, '.claude')
    mkdirSync(path.join(cliSource, 'projects'), { recursive: true })
    const live = fakeLiveClaude(home, cliSource)
    const swivelRoot = path.join(home, 'swivel')
    fakeSwivel(swivelRoot, { ALBA: {} })
    const workspace = new NodeProfileWorkspace(
      path.join(home, 'p'),
      home,
      [],
      new NodeDesktopDataCloner(),
    )

    const dirs = await workspace.provision(ProfileId.from(nextUuid()), {
      desktopSourceDir: path.join(swivelRoot, 'profiles', 'ALBA', 'Claude'),
      cliSourceDir: cliSource,
      desktopStateSourceDir: live,
    })

    const index = path.join(dirs.desktopDataDir, 'claude-code-sessions', ACC, ORG)
    expect(existsSync(path.join(index, 'archived-sessions.idx'))).toBe(true)
    const card = JSON.parse(readFileSync(path.join(index, 'local_abc.json'), 'utf8'))
    expect(card.cwd).toBe(`${dirs.desktopDataDir}/scratch-workspaces/${ACC}/x`)
    expect(card.planPath).toBe(`${dirs.cliConfigDir}/plans/p.md`)
    expect(card.sessionPermissionUpdates[0].directories[0]).toBe(
      `${dirs.desktopDataDir}/side-session-notes/local_abc`,
    )
    expect(
      existsSync(
        path.join(dirs.desktopDataDir, 'local-agent-mode-sessions', ACC, ORG, 's1', 'tasks.json'),
      ),
    ).toBe(true)
    expect(existsSync(path.join(dirs.desktopDataDir, 'claude-code'))).toBe(false)
    // Cookies continuam os do snapshot do Swivel (a conta do perfil), não os do Claude padrão.
    expect(readFileSync(path.join(dirs.desktopDataDir, 'Cookies'), 'utf8')).toBe('x'.repeat(100))
    // Origem intacta: o índice do Claude padrão ainda aponta para os caminhos antigos.
    expect(
      readFileSync(path.join(live, 'claude-code-sessions', ACC, ORG, 'local_abc.json'), 'utf8'),
    ).toContain(`${live}/scratch`)
  })

  it('não sobrescreve um índice que o snapshot já traga', async () => {
    const home = realpathSync(mkdtempSync(path.join(tmpdir(), 'mc-home-')))
    const live = fakeLiveClaude(home, path.join(home, '.claude'))
    const swivelRoot = path.join(home, 'swivel')
    fakeSwivel(swivelRoot, { ALBA: {} })
    const snapIndex = path.join(swivelRoot, 'profiles', 'ALBA', 'Claude', 'claude-code-sessions')
    mkdirSync(snapIndex, { recursive: true })
    writeFileSync(path.join(snapIndex, 'marker'), 'do-snapshot')
    const workspace = new NodeProfileWorkspace(
      path.join(home, 'p'),
      home,
      [],
      new NodeDesktopDataCloner(),
    )

    const dirs = await workspace.provision(ProfileId.from(nextUuid()), {
      desktopSourceDir: path.join(swivelRoot, 'profiles', 'ALBA', 'Claude'),
      desktopStateSourceDir: live,
    })
    expect(existsSync(path.join(dirs.desktopDataDir, 'claude-code-sessions', 'marker'))).toBe(true)
    expect(existsSync(path.join(dirs.desktopDataDir, 'claude-code-sessions', ACC))).toBe(false)
    expect(existsSync(path.join(dirs.desktopDataDir, 'local-agent-mode-sessions', ACC))).toBe(true)
  })
})

describe('.claude.json do perfil', () => {
  it('vem do ~/.claude.json (irmão da pasta) quando é o mais completo, sem a conta logada', async () => {
    const home = realpathSync(mkdtempSync(path.join(tmpdir(), 'mc-home-')))
    const src = path.join(home, '.claude')
    mkdirSync(path.join(src, 'projects'), { recursive: true })
    writeFileSync(
      path.join(src, '.claude.json'),
      JSON.stringify({ userID: 'u', firstStartTime: 1 }),
    )
    writeFileSync(
      path.join(home, '.claude.json'),
      JSON.stringify({
        userID: 'u',
        hasCompletedOnboarding: true,
        projects: { '/Users/u/proj': { hasTrustDialogAccepted: true } },
        oauthAccount: { emailAddress: 'default@acct', organizationUuid: 'org' },
        mcpServers: { x: {} },
      }),
    )
    const workspace = new NodeProfileWorkspace(
      path.join(home, 'p'),
      home,
      [],
      new NodeDesktopDataCloner(),
    )
    const dirs = await workspace.provision(ProfileId.from(nextUuid()), { cliSourceDir: src })

    const cfg = JSON.parse(readFileSync(path.join(dirs.cliConfigDir, '.claude.json'), 'utf8'))
    expect(cfg.hasCompletedOnboarding).toBe(true)
    expect(Object.keys(cfg.projects)).toEqual(['/Users/u/proj'])
    expect(cfg.mcpServers).toEqual({ x: {} })
    expect(cfg.oauthAccount).toBeUndefined()
    // O original na HOME continua com a conta.
    expect(
      JSON.parse(readFileSync(path.join(home, '.claude.json'), 'utf8')).oauthAccount.emailAddress,
    ).toBe('default@acct')
  })

  it('config dir customizado (~/.claude-x): usa o .claude.json de dentro da pasta', async () => {
    const home = realpathSync(mkdtempSync(path.join(tmpdir(), 'mc-home-')))
    const src = path.join(home, '.claude-x')
    mkdirSync(src, { recursive: true })
    writeFileSync(
      path.join(src, '.claude.json'),
      JSON.stringify({ projects: { '/a': {} }, oauthAccount: { e: 1 } }),
    )
    const workspace = new NodeProfileWorkspace(
      path.join(home, 'p'),
      home,
      [],
      new NodeDesktopDataCloner(),
    )
    const dirs = await workspace.provision(ProfileId.from(nextUuid()), { cliSourceDir: src })
    const cfg = JSON.parse(readFileSync(path.join(dirs.cliConfigDir, '.claude.json'), 'utf8'))
    expect(cfg.projects).toEqual({ '/a': {} })
    expect(cfg.oauthAccount).toBeUndefined()
  })
})
