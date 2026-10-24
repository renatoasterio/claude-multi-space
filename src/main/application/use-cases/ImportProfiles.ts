import { ProfileColorPresets } from '@shared/schemas/profile.constraints'
import { DomainError } from '../../domain/errors/DomainError'
import type { ProfileRepository } from '../ports/ProfileRepository'
import type { ImportCandidate, ProfileWorkspace } from '../ports/ProfileWorkspace'
import type { ProfileFinder } from '../services/ProfileFinder'
import type { ProfileView } from '../services/ProfileStatusReader'
import type { CreateProfile } from './CreateProfile'

export class ListImportCandidates {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly workspace: ProfileWorkspace,
  ) {}

  async execute(): Promise<ImportCandidate[]> {
    const [candidates, profiles] = await Promise.all([
      this.workspace.findImportCandidates(),
      this.repository.findAll(),
    ])
    const used = new Set(profiles.map((p) => p.cliConfigDir))
    return candidates.filter((c) => !used.has(c.path))
  }
}

export class ImportProfiles {
  constructor(
    private readonly candidates: ListImportCandidates,
    private readonly createProfile: CreateProfile,
    private readonly finder: ProfileFinder,
    private readonly repository: ProfileRepository,
  ) {}

  async execute(paths: string[]): Promise<ProfileView[]> {
    // Só aceita caminhos descobertos pelo próprio app — nunca caminhos arbitrários vindos do renderer.
    const allowed = new Map((await this.candidates.execute()).map((c) => [c.path, c]))
    const selected = [...new Set(paths)].map((path) => {
      const candidate = allowed.get(path)
      if (!candidate) throw DomainError.validation('errors.importNotAllowed', { path })
      return candidate
    })

    const existingCount = (await this.repository.findAll()).length
    const created: ProfileView[] = []
    for (const [index, candidate] of selected.entries()) {
      const name = await this.finder.uniqueName(candidate.suggestedName)
      const color = ProfileColorPresets[(existingCount + index) % ProfileColorPresets.length]!
      created.push(await this.createProfile.execute({ name, color }, candidate.path))
    }
    return created
  }
}
