import { Profile, type ProfileDetails } from '../../domain/entities/Profile'
import { ProfileId } from '../../domain/value-objects/ProfileId'
import type { ProfileRepository } from '../ports/ProfileRepository'
import type { ProfileWorkspace } from '../ports/ProfileWorkspace'
import type { Clock, IdGenerator } from '../ports/System'
import type { ProfileFinder } from '../services/ProfileFinder'
import type { ProfileStatusReader, ProfileView } from '../services/ProfileStatusReader'

export class CreateProfile {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly workspace: ProfileWorkspace,
    private readonly finder: ProfileFinder,
    private readonly status: ProfileStatusReader,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(details: ProfileDetails, importedCliDir?: string): Promise<ProfileView> {
    await this.finder.assertNameAvailable(details.name)
    const id = ProfileId.from(this.ids.next())
    const dirs = await this.workspace.provision(id, importedCliDir)
    const profile = Profile.create(id, details, dirs, this.clock.now())
    await this.repository.save(profile)
    return this.status.read(profile)
  }
}
