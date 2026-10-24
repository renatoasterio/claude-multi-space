import type { Profile } from '../../domain/entities/Profile'
import { DomainError } from '../../domain/errors/DomainError'
import { ProfileId } from '../../domain/value-objects/ProfileId'
import { ProfileName } from '../../domain/value-objects/ProfileName'
import { ProfileConstraints } from '@shared/schemas/profile.constraints'
import type { ProfileRepository } from '../ports/ProfileRepository'

/** Consultas reaproveitadas pelos casos de uso. */
export class ProfileFinder {
  constructor(private readonly repository: ProfileRepository) {}

  async getById(rawId: string): Promise<Profile> {
    const profile = await this.repository.findById(ProfileId.from(rawId))
    if (!profile) throw DomainError.notFound('errors.profileNotFound')
    return profile
  }

  async assertNameAvailable(rawName: string, ignoreId?: ProfileId): Promise<void> {
    const name = ProfileName.from(rawName)
    const profiles = await this.repository.findAll()
    const taken = profiles.some((p) => p.name.sameAs(name) && !(ignoreId && p.id.equals(ignoreId)))
    if (taken) throw DomainError.conflict('errors.nameTaken', { name: name.value })
  }

  /** Gera "Nome", "Nome 2", "Nome 3"... evitando colisões. */
  async uniqueName(rawBase: string): Promise<string> {
    // Reserva espaço para o sufixo numérico sem ultrapassar o limite do nome.
    const base =
      rawBase
        .trim()
        .slice(0, ProfileConstraints.nameMaxLength - 4)
        .trim() || 'Perfil'
    const profiles = await this.repository.findAll()
    const exists = (candidate: string) => {
      const name = ProfileName.from(candidate)
      return profiles.some((p) => p.name.sameAs(name))
    }
    if (!exists(base)) return base
    for (let i = 2; ; i++) {
      const candidate = `${base} ${i}`
      if (!exists(candidate)) return candidate
    }
  }
}
