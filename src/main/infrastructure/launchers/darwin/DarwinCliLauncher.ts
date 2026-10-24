import path from 'node:path'
import type { CliLauncher } from '../../../application/ports/Launchers'
import type { Profile } from '../../../domain/entities/Profile'
import { buildPosixLaunchScript } from '../../../utils/shellCommands'
import { spawnSafe } from '../../../utils/spawnSafe'
import { findExecutable } from '../../fs/findExecutable'
import {
  launchFailed,
  notInstalled,
  resolveWorkingDir,
  writeLaunchScript,
  type LauncherContext,
} from '../shared'

export class DarwinCliLauncher implements CliLauncher {
  constructor(private readonly ctx: LauncherContext) {}

  resolveExecutable(): Promise<string | null> {
    const { home, env } = this.ctx
    return findExecutable({
      names: ['claude'],
      preferredDirs: [
        path.join(home, '.local', 'bin'),
        path.join(home, '.claude', 'local'),
        '/opt/homebrew/bin',
        '/usr/local/bin',
        path.join(home, '.npm-global', 'bin'),
      ],
      pathEnv: env.PATH,
    })
  }

  async openTerminal(profile: Profile): Promise<void> {
    const executable = await this.resolveExecutable()
    if (!executable) throw notInstalled('cli')

    const script = buildPosixLaunchScript({
      executable,
      configDir: profile.cliConfigDir,
      cwd: await resolveWorkingDir(profile, this.ctx.home),
      title: `Claude · ${profile.name.value}`,
    })
    const file = await writeLaunchScript(this.ctx, profile, '.command', script)

    // .command abre no Terminal.app sem exigir permissão de automação (AppleScript).
    try {
      const child = await spawnSafe('/usr/bin/open', ['-a', 'Terminal', file], { stdio: 'ignore' })
      await new Promise<void>((resolve, reject) => {
        child.once('exit', (code) =>
          code === 0 ? resolve() : reject(new Error(`open saiu com código ${code}`)),
        )
      })
    } catch (error) {
      throw launchFailed('terminal', error)
    }
  }
}
