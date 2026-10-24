import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ImportCandidate, ProfileWorkspace } from '../../application/ports/ProfileWorkspace'
import type { Profile, ProfileDirectories } from '../../domain/entities/Profile'
import { DomainError } from '../../domain/errors/DomainError'
import type { ProfileId } from '../../domain/value-objects/ProfileId'
import { isPathInside } from '../../utils/paths'

const IMPORTABLE_DIR = /^\.claude-([\w.-]{1,40})$/
const PRIVATE_DIR = 0o700

export class NodeProfileWorkspace implements ProfileWorkspace {
  constructor(
    readonly root: string,
    private readonly home: string,
    /** Pastas que nunca são candidatas à importação (a do próprio app casa com ~/.claude-*). */
    private readonly excludedDirs: string[] = [],
  ) {}

  async provision(id: ProfileId, importedCliDir?: string): Promise<ProfileDirectories> {
    const base = path.join(this.root, id.value)
    const desktopDataDir = path.join(base, 'desktop')
    const cliConfigDir = importedCliDir ?? path.join(base, 'cli')

    await fs.mkdir(this.root, { recursive: true, mode: PRIVATE_DIR })
    await fs.mkdir(desktopDataDir, { recursive: true, mode: PRIVATE_DIR })
    if (!importedCliDir) await fs.mkdir(cliConfigDir, { recursive: true, mode: PRIVATE_DIR })
    // mkdir respeita umask; garante 0700 mesmo assim.
    await Promise.all([fs.chmod(base, PRIVATE_DIR), fs.chmod(desktopDataDir, PRIVATE_DIR)])

    return { desktopDataDir, cliConfigDir, imported: Boolean(importedCliDir) }
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
