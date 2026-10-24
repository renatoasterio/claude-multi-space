import { promises as fs } from 'node:fs'
import type { ProfileRepository } from '../../application/ports/ProfileRepository'
import type { Logger } from '../../application/ports/System'
import type { Profile } from '../../domain/entities/Profile'
import type { ProfileId } from '../../domain/value-objects/ProfileId'
import { ProfileMapper } from '../../mappers/ProfileMapper'
import { SerialQueue } from '../../utils/serialQueue'
import { writeFileAtomic } from '../fs/atomicWrite'
import { ProfilesFileSchema, type ProfileRecord } from './profileRecord.schema'

/**
 * Persistência em JSON com cache em memória: o disco só é lido uma vez;
 * escritas são serializadas e atômicas.
 */
export class JsonProfileRepository implements ProfileRepository {
  private cache: Map<string, ProfileRecord> | null = null
  private loading: Promise<Map<string, ProfileRecord>> | null = null
  private readonly queue = new SerialQueue()

  constructor(
    private readonly file: string,
    private readonly logger: Logger,
  ) {}

  async findAll(): Promise<Profile[]> {
    const records = await this.load()
    return [...records.values()].map(ProfileMapper.toDomain)
  }

  async findById(id: ProfileId): Promise<Profile | null> {
    const record = (await this.load()).get(id.value)
    return record ? ProfileMapper.toDomain(record) : null
  }

  save(profile: Profile): Promise<void> {
    return this.mutate((records) => records.set(profile.id.value, ProfileMapper.toRecord(profile)))
  }

  delete(id: ProfileId): Promise<void> {
    return this.mutate((records) => records.delete(id.value))
  }

  private mutate(change: (records: Map<string, ProfileRecord>) => void): Promise<void> {
    return this.queue.run(async () => {
      const records = await this.load()
      const next = new Map(records)
      change(next)
      await this.persist(next)
      this.cache = next
    })
  }

  private load(): Promise<Map<string, ProfileRecord>> {
    if (this.cache) return Promise.resolve(this.cache)
    this.loading ??= this.readFromDisk().then((records) => {
      this.cache = records
      this.loading = null
      return records
    })
    return this.loading
  }

  private async readFromDisk(): Promise<Map<string, ProfileRecord>> {
    let raw: string
    try {
      raw = await fs.readFile(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map()
      throw error
    }

    const parsed = ProfilesFileSchema.safeParse(safeJson(raw))
    if (!parsed.success) {
      const backup = `${this.file}.corrupted-${Date.now()}`
      await fs.rename(this.file, backup)
      this.logger.warn('Arquivo de perfis inválido; backup criado e lista reiniciada.', { backup })
      return new Map()
    }
    return new Map(parsed.data.profiles.map((record) => [record.id, record]))
  }

  private persist(records: Map<string, ProfileRecord>): Promise<void> {
    const contents = JSON.stringify({ version: 1, profiles: [...records.values()] }, null, 2)
    return writeFileAtomic(this.file, contents)
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}
