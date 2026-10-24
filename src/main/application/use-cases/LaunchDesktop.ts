import { ErrorCodes } from '@shared/contracts/errors'
import { DomainError } from '../../domain/errors/DomainError'
import type { DesktopLauncher } from '../ports/Launchers'
import type { ProcessRegistry } from '../ports/ProcessRegistry'
import type { ProfileFinder } from '../services/ProfileFinder'

export class LaunchDesktop {
  constructor(
    private readonly finder: ProfileFinder,
    private readonly launcher: DesktopLauncher,
    private readonly registry: ProcessRegistry,
  ) {}

  async execute(id: string): Promise<void> {
    const profile = await this.finder.getById(id)
    if (!(await this.launcher.resolveExecutable())) {
      throw new DomainError(ErrorCodes.NotInstalled, 'errors.desktopNotInstalled')
    }
    // Se já estiver aberto, o próprio Claude foca a janela existente (lock por user-data-dir).
    const handle = await this.launcher.launch(profile)
    this.registry.track(profile.id.value, handle)
  }
}
