import path from 'node:path'
import type { CliLauncher } from '../../../application/ports/Launchers'
import type { Profile } from '../../../domain/entities/Profile'
import { buildCmdLaunchScript } from '../../../utils/shellCommands'
import { spawnDetached } from '../../../utils/spawnSafe'
import { findExecutable } from '../../fs/findExecutable'
import {
  launchFailed,
  notInstalled,
  resolveWorkingDir,
  writeLaunchScript,
  type LauncherContext,
} from '../shared'

export class WinCliLauncher implements CliLauncher {
  constructor(private readonly ctx: LauncherContext) {}

  resolveExecutable(): Promise<string | null> {
    const { home, env } = this.ctx
    return findExecutable({
      names: ['claude.exe', 'claude.cmd'],
      preferredDirs: [
        path.join(home, '.local', 'bin'),
        path.join(env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'npm'),
      ],
      pathEnv: env.Path ?? env.PATH,
    })
  }

  async openTerminal(profile: Profile): Promise<void> {
    const executable = await this.resolveExecutable()
    if (!executable) throw notInstalled('cli')

    const cwd = await resolveWorkingDir(profile, this.ctx.home)
    const script = buildCmdLaunchScript({
      executable,
      cwd,
      configDir: profile.cliConfigDir,
      title: `Claude - ${profile.name.value}`,
    })
    const file = await writeLaunchScript(this.ctx, profile, '.cmd', script)
    const env = { ...this.ctx.env }

    try {
      const wt = await findExecutable({ names: ['wt.exe'], pathEnv: env.Path ?? env.PATH })
      if (wt) {
        await spawnDetached(wt, ['-d', cwd, 'cmd.exe', '/k', file], { env })
      } else {
        // detached no Windows cria uma nova janela de console.
        await spawnDetached('cmd.exe', ['/k', file], { cwd, env, windowsHide: false })
      }
    } catch (error) {
      throw launchFailed('terminal', error)
    }
  }
}
