import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { DesktopDataCloner } from '../../application/ports/DesktopDataCloner'
import type {
  ImportCandidate,
  ProfileWorkspace,
  ProvisionOptions,
} from '../../application/ports/ProfileWorkspace'
import type { Profile, ProfileDirectories } from '../../domain/entities/Profile'
import { DomainError } from '../../domain/errors/DomainError'
import type { ProfileId } from '../../domain/value-objects/ProfileId'
import { isPathInside } from '../../utils/paths'
import { writeFileAtomic } from './atomicWrite'

const IMPORTABLE_DIR = /^\.claude-([\w.-]{1,40})$/
const PRIVATE_DIR = 0o700

/**
 * Ao copiar um CLAUDE_CONFIG_DIR para um perfil, o que é só desta máquina/sessão fica de fora:
 * caches e telemetria são regenerados; `sessions`/`session-env` apontam para processos do CLI
 * de origem que estão vivos; `ide` guarda locks de editores abertos.
 */
const CLI_SKIP = [
  'cache',
  'telemetry',
  'shell-snapshots',
  'sessions',
  'session-env',
  'ide',
  'spares',
  'downloads',
]
/** Manifestos de plugins guardam o caminho absoluto do config dir de origem. */
const CLI_SELF_PATH_FILES = ['plugins/installed_plugins.json', 'plugins/known_marketplaces.json']
/**
 * Estado da aba Code que vive na pasta do Claude Desktop em uso e que o Swivel não inclui no
 * snapshot: o índice de sessões da sidebar (particionado por conta/organização) e as tarefas
 * agendadas. Binários e caches (claude-code*, vm_bundles, Cache) ficam de fora: o Claude os baixa.
 */
const DESKTOP_CODE_STATE_DIRS = ['claude-code-sessions', 'local-agent-mode-sessions']
/** Chaves de ~/.claude.json presas à conta do Claude padrão; o Desktop do perfil as regrava. */
const CLI_CONFIG_ACCOUNT_KEYS = ['oauthAccount']

export class NodeProfileWorkspace implements ProfileWorkspace {
  constructor(
    readonly root: string,
    private readonly home: string,
    /** Pastas que nunca são candidatas à importação (a do próprio app casa com ~/.claude-*). */
    private readonly excludedDirs: string[] = [],
    private readonly cloner?: DesktopDataCloner,
  ) {}

  async provision(id: ProfileId, options: ProvisionOptions = {}): Promise<ProfileDirectories> {
    const { importedCliDir, desktopSourceDir, cliSourceDir, desktopStateSourceDir, importedFrom } =
      options
    const base = path.join(this.root, id.value)
    const desktopDataDir = path.join(base, 'desktop')
    const cliConfigDir = importedCliDir ?? path.join(base, 'cli')

    await fs.mkdir(this.root, { recursive: true, mode: PRIVATE_DIR })
    await fs.mkdir(base, { recursive: true, mode: PRIVATE_DIR })
    if (desktopSourceDir) {
      if (!this.cloner)
        throw DomainError.validation('errors.importNotAllowed', { path: desktopSourceDir })
      await this.cloner.clone(desktopSourceDir, desktopDataDir)
    } else {
      await fs.mkdir(desktopDataDir, { recursive: true, mode: PRIVATE_DIR })
    }
    if (cliSourceDir) {
      if (!this.cloner)
        throw DomainError.validation('errors.importNotAllowed', { path: cliSourceDir })
      await this.cloner.clone(cliSourceDir, cliConfigDir, {
        skipTopLevel: CLI_SKIP,
        rewrite: { rules: [{ from: cliSourceDir }], files: CLI_SELF_PATH_FILES },
      })
      await this.copyCliConfigFile(cliSourceDir, cliConfigDir)
    } else if (!importedCliDir) {
      await fs.mkdir(cliConfigDir, { recursive: true, mode: PRIVATE_DIR })
    }
    if (desktopStateSourceDir && this.cloner) {
      await this.copyDesktopCodeState(desktopStateSourceDir, desktopDataDir, {
        from: cliSourceDir,
        to: cliConfigDir,
      })
    }
    // mkdir respeita umask; garante 0700 mesmo assim.
    await Promise.all([fs.chmod(base, PRIVATE_DIR), fs.chmod(desktopDataDir, PRIVATE_DIR)])

    return {
      desktopDataDir,
      cliConfigDir,
      imported: Boolean(importedCliDir),
      importedFrom: importedFrom ?? null,
    }
  }

  /**
   * O Claude Code guarda a configuração (projetos confiáveis, onboarding, MCPs) em
   * `<CLAUDE_CONFIG_DIR>/.claude.json`, mas no diretório padrão o arquivo fica em ~/.claude.json
   * (irmão da pasta). Copia o mais completo dos dois, sem a conta logada do Claude padrão.
   */
  private async copyCliConfigFile(sourceDir: string, targetDir: string): Promise<void> {
    const candidates = [
      path.join(sourceDir, '.claude.json'),
      path.join(path.dirname(sourceDir), `${path.basename(sourceDir)}.json`),
    ]
    let best: Record<string, unknown> | null = null
    for (const file of candidates) {
      const parsed = await readJson(file)
      if (parsed && (!best || Object.keys(parsed).length > Object.keys(best).length)) best = parsed
    }
    if (!best) return
    for (const key of CLI_CONFIG_ACCOUNT_KEYS) delete best[key]
    await writeFileAtomic(path.join(targetDir, '.claude.json'), JSON.stringify(best, null, 2))
  }

  /** Copia as pastas de estado da aba Code que faltam no desktop do perfil, religando caminhos. */
  private async copyDesktopCodeState(
    liveDesktopDir: string,
    desktopDataDir: string,
    cli: { from?: string; to: string },
  ): Promise<void> {
    const rules = [{ from: liveDesktopDir, to: desktopDataDir }]
    if (cli.from) rules.push({ from: cli.from, to: cli.to })
    for (const name of DESKTOP_CODE_STATE_DIRS) {
      const source = path.join(liveDesktopDir, name)
      const target = path.join(desktopDataDir, name)
      if (!(await this.isDirectory(source)) || (await exists(target))) continue
      await this.cloner!.clone(source, target, { rewrite: { rules, allJson: true } })
    }
  }

  async remove(profile: Profile): Promise<void> {
    const base = path.join(this.root, profile.id.value)
    await this.assertManaged(base)
    // Diretórios importados (ex.: ~/.claude-cliente) nunca são apagados: só o que o app criou.
    await fs.rm(base, { recursive: true, force: true })
  }

  async hasContent(dir: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dir)
      return entries.length > 0
    } catch {
      return false
    }
  }

  async isDirectory(target: string): Promise<boolean> {
    try {
      return (await fs.stat(target)).isDirectory()
    } catch {
      return false
    }
  }

  async findImportCandidates(): Promise<ImportCandidate[]> {
    const excluded = new Set(this.excludedDirs.map((dir) => path.resolve(dir)))
    const entries = await fs.readdir(this.home, { withFileTypes: true })
    const candidates = entries
      .filter((entry) => entry.isDirectory() && IMPORTABLE_DIR.test(entry.name))
      .filter((entry) => !excluded.has(path.resolve(this.home, entry.name)))
      .map((entry) => ({
        path: path.join(this.home, entry.name),
        suggestedName: toTitle(IMPORTABLE_DIR.exec(entry.name)![1]!),
      }))
    const withContent = await Promise.all(candidates.map((c) => this.hasContent(c.path)))
    return candidates.filter((_, i) => withContent[i])
  }

  /** Bloqueia remoção fora da raiz, inclusive via symlink. */
  private async assertManaged(target: string): Promise<void> {
    const [realRoot, realTarget] = await Promise.all([
      safeRealpath(this.root),
      safeRealpath(target),
    ])
    if (!isPathInside(realRoot, realTarget)) {
      throw DomainError.forbidden('errors.outsideManagedArea')
    }
  }
}

async function safeRealpath(target: string): Promise<string> {
  try {
    return await fs.realpath(target)
  } catch {
    return path.resolve(target)
  }
}

function toTitle(value: string): string {
  return value
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
