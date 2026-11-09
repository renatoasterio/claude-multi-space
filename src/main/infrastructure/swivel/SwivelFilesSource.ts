import { promises as fs, type Dirent } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { SwivelProfile, SwivelSource } from '../../application/ports/SwivelSource'

const StateSchema = z.object({
  activeProfile: z.string().optional(),
  colors: z.record(z.string(), z.string()).optional(),
})

const HEX_COLOR = /^#[0-9a-f]{6}$/i
/** Nome de pasta aceito como perfil do Swivel (evita ".staging-*" e nomes estranhos). */
const PROFILE_DIR = /^[^.][^/\\]{0,60}$/

/**
 * Lê ~/Library/Application Support/Swivel: `state.json` (cor e perfil ativo) e
 * `profiles/<nome>/Claude` (snapshot da pasta de dados do Claude Desktop).
 * Só leitura: nada aqui altera arquivos do Swivel.
 */
export class SwivelFilesSource implements SwivelSource {
  /**
   * Somar o tamanho de um snapshot de gigabytes leva segundos; o valor é só informativo,
   * então fica em cache por `sizeTtlMs` e chamadas simultâneas compartilham a mesma soma.
   */
  private readonly sizes = new Map<string, { at: number; size: Promise<number> }>()

  constructor(
    private readonly swivelDir: string,
    private readonly options: {
      sizeTtlMs?: number
      now?: () => number
      /** ~/.claude do usuário; ausente nos testes que não o exercitam. */
      cliConfigDir?: string
      /** ~/Library/Application Support/Claude do usuário. */
      desktopDataDir?: string
    } = {},
  ) {}

  sharedCliConfigDir(): Promise<string | null> {
    return existingDir(this.options.cliConfigDir)
  }

  liveDesktopDataDir(): Promise<string | null> {
    return existingDir(this.options.desktopDataDir)
  }

  async isAvailable(): Promise<boolean> {
    try {
      return (await fs.stat(path.join(this.swivelDir, 'profiles'))).isDirectory()
    } catch {
      return false
    }
  }

  async listProfiles(): Promise<SwivelProfile[]> {
    if (!(await this.isAvailable())) return []
    const state = await this.readState()
    const entries = await fs.readdir(path.join(this.swivelDir, 'profiles'), {
      withFileTypes: true,
    })

    const profiles = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && PROFILE_DIR.test(entry.name))
        .map(async (entry): Promise<SwivelProfile | null> => {
          const desktopDataDir = path.join(this.swivelDir, 'profiles', entry.name, 'Claude')
          // Um snapshot válido tem o banco de cookies (é onde mora a sessão).
          if (!(await exists(path.join(desktopDataDir, 'Cookies')))) return null
          const color = state.colors?.[entry.name]
          return {
            name: entry.name,
            color: color && HEX_COLOR.test(color) ? color.toLowerCase() : null,
            desktopDataDir,
            sizeBytes: await this.sizeOf(desktopDataDir),
            active: state.activeProfile === entry.name,
          }
        }),
    )
    return profiles
      .filter((profile): profile is SwivelProfile => profile !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  private sizeOf(dir: string): Promise<number> {
    const now = (this.options.now ?? Date.now)()
    const ttl = this.options.sizeTtlMs ?? 60_000
    const cached = this.sizes.get(dir)
    if (cached && now - cached.at < ttl) return cached.size
    const size = directorySize(dir).catch(() => 0)
    this.sizes.set(dir, { at: now, size })
    return size
  }

  private async readState(): Promise<z.infer<typeof StateSchema>> {
    try {
      const raw = await fs.readFile(path.join(this.swivelDir, 'state.json'), 'utf8')
      const parsed = StateSchema.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data : {}
    } catch {
      return {}
    }
  }
}

async function existingDir(dir: string | undefined): Promise<string | null> {
  if (!dir) return null
  try {
    return (await fs.stat(dir)).isDirectory() ? dir : null
  } catch {
    return null
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

/** Soma os tamanhos dos arquivos (sem seguir symlinks). */
async function directorySize(dir: string): Promise<number> {
  let total = 0
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()!
    let entries: Dirent[]
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile()) {
        try {
          total += (await fs.lstat(full)).size
        } catch {
          // arquivo sumiu entre readdir e lstat
        }
      }
    }
  }
  return total
}
