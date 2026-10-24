import { DomainError } from '../../domain/errors/DomainError'
import type { ProfileRepository } from '../ports/ProfileRepository'
import type { ProfileShortcuts } from '../ports/ProfileShortcuts'
import type { ProfileWorkspace } from '../ports/ProfileWorkspace'
import type { ProfileFinder } from '../services/ProfileFinder'
import type { ProfileStatusReader } from '../services/ProfileStatusReader'

export class DeleteProfile {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly workspace: ProfileWorkspace,
    private readonly finder: ProfileFinder,
    private readonly status: ProfileStatusReader,
    private readonly shortcuts: ProfileShortcuts,
  ) {}

  async execute(id: string, removeData: boolean): Promise<void> {
    const profile = await this.finder.getById(id)
    if (removeData && (await this.status.isDesktopRunning(profile))) {
      throw DomainError.conflict('errors.closeDesktopFirst')
    }
    if (removeData) await this.workspace.remove(profile)
    await this.shortcuts.remove(profile)
    await this.repository.delete(profile.id)
  }
}
