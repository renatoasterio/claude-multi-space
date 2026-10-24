import { ErrorCodes } from '@shared/contracts/errors'
import { DomainError } from '../../domain/errors/DomainError'
import type { CliLauncher } from '../ports/Launchers'
import type { ProfileFinder } from '../services/ProfileFinder'

export class LaunchCli {
  constructor(
    private readonly finder: ProfileFinder,
    private readonly launcher: CliLauncher,
  ) {}

  async execute(id: string): Promise<void> {
    const profile = await this.finder.getById(id)
    if (!(await this.launcher.resolveExecutable())) {
      throw new DomainError(ErrorCodes.NotInstalled, 'errors.cliNotInstalled')
    }
    await this.launcher.openTerminal(profile)
  }
}
