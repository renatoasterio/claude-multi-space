import type { ProfileDetails } from '../../domain/entities/Profile'
import type { ProfileRepository } from '../ports/ProfileRepository'
import type { ProfileShortcuts } from '../ports/ProfileShortcuts'
import type { Clock } from '../ports/System'
import type { ProfileFinder } from '../services/ProfileFinder'
import type { ProfileStatusReader, ProfileView } from '../services/ProfileStatusReader'

export class UpdateProfile {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly finder: ProfileFinder,
    private readonly status: ProfileStatusReader,
    private readonly clock: Clock,
    private readonly shortcuts: ProfileShortcuts,
  ) {}

  async execute(id: string, details: ProfileDetails): Promise<ProfileView> {
    const profile = await this.finder.getById(id)
    await this.finder.assertNameAvailable(details.name, profile.id)
    profile.update(details, this.clock.now())
    await this.repository.save(profile)
    // O atalho carrega nome e cor: se existir, é recriado para acompanhar a edição.
    if (await this.shortcuts.find(profile)) await this.shortcuts.create(profile)
    return this.status.read(profile)
  }
}
