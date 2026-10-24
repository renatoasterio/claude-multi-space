import type { ShellKind } from '@shared/schemas/profile.schema'
import { buildCliCommand } from '../../utils/shellCommands'
import type { CliLauncher } from '../ports/Launchers'
import type { ProfileFinder } from '../services/ProfileFinder'

/** Gera um comando/alias para usar o perfil fora do app (ex.: no .zshrc). */
export class BuildLaunchCommand {
  constructor(
    private readonly finder: ProfileFinder,
    private readonly cli: CliLauncher,
  ) {}

  async execute(id: string, shell: ShellKind): Promise<string> {
    const profile = await this.finder.getById(id)
    const executable = (await this.cli.resolveExecutable()) ?? 'claude'
    return buildCliCommand(shell, {
      name: profile.name.value,
      configDir: profile.cliConfigDir,
      executable,
    })
  }
}
