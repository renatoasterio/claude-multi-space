import { promises as fs } from 'node:fs'
import { z } from 'zod'
import { SerialQueue } from '../../utils/serialQueue'
import { writeFileAtomic } from '../fs/atomicWrite'

const IndexSchema = z.record(z.string(), z.string())

/** Mapa id do perfil -> caminho do atalho (o nome do arquivo muda quando o perfil é renomeado). */
export class ShortcutIndex {
  private cache: Record<string, string> | null = null
  private readonly queue = new SerialQueue()

  constructor(private readonly file: string) {}

  async get(id: string): Promise<string | null> {
    return (await this.load())[id] ?? null
  }

  set(id: string, target: string | null): Promise<void> {
    return this.queue.run(async () => {
      const next = { ...(await this.load()) }
      if (target) next[id] = target
      else delete next[id]
      await writeFileAtomic(this.file, JSON.stringify(next, null, 2))
      this.cache = next
    })
  }

  private async load(): Promise<Record<string, string>> {
    if (this.cache) return this.cache
    try {
      const parsed = IndexSchema.safeParse(JSON.parse(await fs.readFile(this.file, 'utf8')))
      this.cache = parsed.success ? parsed.data : {}
    } catch {
      this.cache = {}
    }
    return this.cache
  }
}
