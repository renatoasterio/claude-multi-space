import { ProfileColorPresets } from '@shared/schemas/profile.constraints'
import { DomainError } from '../../domain/errors/DomainError'
import type { ProfileRepository } from '../ports/ProfileRepository'
import type { SwivelProfile, SwivelSource } from '../ports/SwivelSource'
import type { ProfileFinder } from '../services/ProfileFinder'
import type { ProfileView } from '../services/ProfileStatusReader'
import type { CreateProfile } from './CreateProfile'

export interface SwivelCandidate extends SwivelProfile {
  /** true quando já existe um perfil importado deste snapshot. */
  alreadyImported: boolean
}

/** Lista os perfis do Swivel, marcando os que já viraram perfil aqui. */
export class ListSwivelProfiles {
  constructor(
    private readonly source: SwivelSource,
    private readonly repository: ProfileRepository,
  ) {}

  async isAvailable(): Promise<boolean> {
    return this.source.isAvailable()
  }

  async execute(): Promise<SwivelCandidate[]> {
    const [profiles, existing] = await Promise.all([
      this.source.listProfiles(),
      this.repository.findAll(),
    ])
    const imported = new Set(
      existing.map((p) => p.importedFrom).filter((v): v is string => v !== null),
    )
    return profiles.map((p) => ({ ...p, alreadyImported: imported.has(p.desktopDataDir) }))
  }
}

/**
 * Importa perfis do Swivel copiando o snapshot de cada um para dentro do app (uma vez).
 * Depois disso os dois apps são independentes; o usuário pode reimportar quando quiser.
 */
export class ImportSwivelProfiles {
  constructor(
    private readonly source: SwivelSource,
    private readonly list: ListSwivelProfiles,
    private readonly createProfile: CreateProfile,
    private readonly finder: ProfileFinder,
    private readonly repository: ProfileRepository,
  ) {}

  async execute(names: string[]): Promise<ProfileView[]> {
    // Só aceita perfis descobertos pelo próprio app — nunca caminhos vindos do renderer.
    const allowed = new Map((await this.list.execute()).map((c) => [c.name, c]))
    const selected = [...new Set(names)].map((name) => {
      const candidate = allowed.get(name)
      if (!candidate) throw DomainError.validation('errors.importNotAllowed', { path: name })
      return candidate
    })

    // A aba Code lê sessões e projetos do CLAUDE_CONFIG_DIR; sem copiá-lo o perfil abriria
    // logado, mas sem nenhuma conversa ou projeto do Code.
    const cliSourceDir = (await this.source.sharedCliConfigDir()) ?? undefined
    // O índice que a sidebar da aba Code lista (claude-code-sessions) fica na pasta do Claude
    // padrão e o Swivel não o copia; sem ele a sidebar fica vazia mesmo com os transcripts.
    const desktopStateSourceDir = (await this.source.liveDesktopDataDir()) ?? undefined
    const existingCount = (await this.repository.findAll()).length
    const created: ProfileView[] = []
    for (const [index, candidate] of selected.entries()) {
      const name = await this.finder.uniqueName(candidate.name)
      const color =
        candidate.color ??
        ProfileColorPresets[(existingCount + index) % ProfileColorPresets.length]!
      created.push(
        await this.createProfile.execute(
          { name, color },
          {
            desktopSourceDir: candidate.desktopDataDir,
            cliSourceDir,
            desktopStateSourceDir,
            importedFrom: candidate.desktopDataDir,
          },
        ),
      )
    }
    return created
  }
}
