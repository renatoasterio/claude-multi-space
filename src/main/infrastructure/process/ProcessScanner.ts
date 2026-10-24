import { execFileText } from '../../utils/spawnSafe'

/** Fonte das linhas de comando dos processos do Claude Desktop em execução. */
export type CommandLineSource = () => Promise<string[]>

export const darwinCommandLines: CommandLineSource = async () =>
  (await execFileText('/bin/ps', ['-axww', '-o', 'command='])).split('\n')

export const win32CommandLines: CommandLineSource = async () =>
  (
    await execFileText('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | ForEach-Object { $_.CommandLine }`,
    ])
  ).split(/\r?\n/)

/**
 * Detecta instâncias pelo argumento --user-data-dir na linha de comando.
 * (O Claude Desktop não cria SingletonLock, então essa é a forma confiável — inclusive para
 * instâncias abertas antes deste app.) O resultado é cacheado por `ttlMs` e chamadas
 * simultâneas compartilham a mesma consulta, então listar N perfis custa um único `ps`.
 */
export class ProcessScanner {
  private cached: { at: number; lines: Promise<string[]> } | null = null

  constructor(
    private readonly source: CommandLineSource,
    private readonly options: {
      ttlMs?: number
      caseInsensitive?: boolean
      now?: () => number
    } = {},
  ) {}

  async hasUserDataDir(dir: string): Promise<boolean> {
    const needle = this.normalize(`--user-data-dir=${dir}`)
    const lines = await this.lines()
    return lines.some((line) => {
      const normalized = this.normalize(line)
      let index = normalized.indexOf(needle)
      while (index !== -1) {
        const next = normalized[index + needle.length]
        if (next === undefined || next === ' ' || next === '"') return true
        index = normalized.indexOf(needle, index + 1)
      }
      return false
    })
  }

  private lines(): Promise<string[]> {
    const now = (this.options.now ?? Date.now)()
    const ttl = this.options.ttlMs ?? 1500
    if (this.cached && now - this.cached.at < ttl) return this.cached.lines
    const lines = this.source().catch(() => [] as string[])
    this.cached = { at: now, lines }
    return lines
  }

  private normalize(value: string): string {
    return this.options.caseInsensitive ? value.toLowerCase() : value
  }
}
