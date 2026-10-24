import { promises as fs } from 'node:fs'
import { z } from 'zod'
import { SupportedLocales, type Locale } from '@shared/i18n/locales'
import type { AppSettings, SettingsStore } from '../../application/ports/SettingsStore'
import { SerialQueue } from '../../utils/serialQueue'
import { writeFileAtomic } from '../fs/atomicWrite'

const SettingsFileSchema = z.object({
  version: z.literal(1),
  language: z.enum(SupportedLocales),
})

/** Preferências em JSON; na primeira execução o idioma vem do sistema operacional. */
export class JsonSettingsStore implements SettingsStore {
  private cache: AppSettings | null = null
  private readonly queue = new SerialQueue()

  constructor(
    private readonly file: string,
    private readonly systemLocale: () => Locale,
  ) {}

  async get(): Promise<AppSettings> {
    this.cache ??= await this.read()
    return { ...this.cache }
  }

  update(patch: Partial<AppSettings>): Promise<AppSettings> {
    return this.queue.run(async () => {
      const next = { ...(await this.get()), ...patch }
      await writeFileAtomic(this.file, JSON.stringify({ version: 1, ...next }, null, 2))
      this.cache = next
      return { ...next }
    })
  }

  private async read(): Promise<AppSettings> {
    try {
      const parsed = SettingsFileSchema.safeParse(JSON.parse(await fs.readFile(this.file, 'utf8')))
      if (parsed.success) return { language: parsed.data.language }
    } catch {
      // Arquivo ausente ou inválido: usa os padrões.
    }
    return { language: this.systemLocale() }
  }
}
