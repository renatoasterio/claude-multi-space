import type { ProfileRepository } from '../ports/ProfileRepository'
import type { ProfileStatusReader, ProfileView } from '../services/ProfileStatusReader'

export class ListProfiles {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly status: ProfileStatusReader,
  ) {}

  async execute(): Promise<ProfileView[]> {
    const profiles = await this.repository.findAll()
    profiles.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    return this.status.readMany(profiles)
  }
}
