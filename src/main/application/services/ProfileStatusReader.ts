import type { Profile } from '../../domain/entities/Profile'
import type { DesktopLauncher } from '../ports/Launchers'
import type { ProcessRegistry } from '../ports/ProcessRegistry'
import type { ProfileWorkspace } from '../ports/ProfileWorkspace'

export interface ProfileStatus {
  desktopRunning: boolean
  desktopInitialized: boolean
  cliInitialized: boolean
}

export interface ProfileView {
  profile: Profile
  status: ProfileStatus
}

export class ProfileStatusReader {
  constructor(
    private readonly workspace: ProfileWorkspace,
    private readonly desktop: DesktopLauncher,
    private readonly registry: ProcessRegistry,
  ) {}

  async isDesktopRunning(profile: Profile): Promise<boolean> {
    return this.registry.isTracked(profile.id.value) || this.desktop.isRunning(profile)
  }

  async read(profile: Profile): Promise<ProfileView> {
    const [desktopRunning, desktopInitialized, cliInitialized] = await Promise.all([
      this.isDesktopRunning(profile),
      this.workspace.hasContent(profile.desktopDataDir),
      this.workspace.hasContent(profile.cliConfigDir),
    ])
    return { profile, status: { desktopRunning, desktopInitialized, cliInitialized } }
  }

  readMany(profiles: Profile[]): Promise<ProfileView[]> {
    return Promise.all(profiles.map((profile) => this.read(profile)))
  }
}
