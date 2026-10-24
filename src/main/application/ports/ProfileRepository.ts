import type { Profile } from '../../domain/entities/Profile'
import type { ProfileId } from '../../domain/value-objects/ProfileId'

export interface ProfileRepository {
  findAll(): Promise<Profile[]>
  findById(id: ProfileId): Promise<Profile | null>
  save(profile: Profile): Promise<void>
  delete(id: ProfileId): Promise<void>
}
