import { execFileText } from '../../utils/spawnSafe'

export interface ProcessEntry {
  pid: number
  command: string
}

/** Fonte dos processos (PID + linha de comando) do Claude Desktop em execução. */
export type ProcessSource = () => Promise<ProcessEntry[]>

/** "  123 /path/bin --flag" -> { pid: 123, command: "/path/bin --flag" } */
export function parsePidLines(output: string): ProcessEntry[] {
  return output.split(/\r?\n/).flatMap((line) => {
    const match = /^\s*(\d+)\s+(.+?)\s*$/.exec(line)
    return match ? [{ pid: Number(match[1]), command: match[2]! }] : []
  })
}

export const darwinProcesses: ProcessSource = async () =>
  parsePidLines(await execFileText('/bin/ps', ['-axww', '-o', 'pid=,command=']))

export const win32Processes: ProcessSource = async () =>
  parsePidLines(
    await execFileText('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }`,
    ]),
  )

/**
 * Detecta instâncias pelo argumento --user-data-dir na linha de comando.
 * (O Claude Desktop não cria SingletonLock, então essa é a forma confiável — inclusive para
 * instâncias abertas antes deste app.) O resultado é cacheado por `ttlMs` e chamadas
 * simultâneas compartilham a mesma consulta, então listar N perfis custa um único `ps`.
 */
export class ProcessScanner {
  private cached: { at: number; entries: Promise<ProcessEntry[]> } | null = null

  constructor(
    private readonly source: ProcessSource,
    private readonly options: {
      ttlMs?: number
      caseInsensitive?: boolean
      now?: () => number
    } = {},
  ) {}

  async hasUserDataDir(dir: string): Promise<boolean> {
    return (await this.matching(dir)).length > 0
  }

  /** PID do processo principal (os auxiliares do Chromium têm --type=). */
  async findMainPid(dir: string): Promise<number | null> {
    const main = (await this.matching(dir)).find((entry) => !/\s--type=/.test(entry.command))
    return main?.pid ?? null
  }

  /** Descarta o cache (ex.: logo após abrir uma instância). */
  invalidate(): void {
    this.cached = null
  }

  private async matching(dir: string): Promise<ProcessEntry[]> {
    const needle = this.normalize(`--user-data-dir=${dir}`)
    return (await this.entries()).filter((entry) =>
      this.hasArgument(this.normalize(entry.command), needle),
    )
  }

  private hasArgument(command: string, needle: string): boolean {
    let index = command.indexOf(needle)
    while (index !== -1) {
      const next = command[index + needle.length]
      if (next === undefined || next === ' ' || next === '"') return true
      index = command.indexOf(needle, index + 1)
    }
    return false
  }

  private entries(): Promise<ProcessEntry[]> {
    const now = (this.options.now ?? Date.now)()
    const ttl = this.options.ttlMs ?? 1500
    if (this.cached && now - this.cached.at < ttl) return this.cached.entries
    const entries = this.source().catch(() => [] as ProcessEntry[])
    this.cached = { at: now, entries }
    return entries
  }

  private normalize(value: string): string {
    return this.options.caseInsensitive ? value.toLowerCase() : value
  }
}
