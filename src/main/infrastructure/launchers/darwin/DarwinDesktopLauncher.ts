import path from 'node:path'
import type { DesktopLauncher, ProcessHandle } from '../../../application/ports/Launchers'
import type { Profile } from '../../../domain/entities/Profile'
import { buildChildEnv } from '../../../utils/childEnv'
import { spawnDetached } from '../../../utils/spawnSafe'
import { firstExisting } from '../../fs/findExecutable'
import { toProcessHandle } from '../../process/childProcessHandle'
import { darwinCommandLines, ProcessScanner } from '../../process/ProcessScanner'
import { launchFailed, notInstalled, type LauncherContext } from '../shared'

export class DarwinDesktopLauncher implements DesktopLauncher {
  private executable: Promise<string | null> | null = null

  constructor(
    private readonly ctx: LauncherContext,
    private readonly scanner = new ProcessScanner(darwinCommandLines),
  ) {}

  resolveExecutable(): Promise<string | null> {
    this.executable ??= firstExisting(
      ['/Applications', path.join(this.ctx.home, 'Applications')].map((dir) =>
        path.join(dir, 'Claude.app', 'Contents', 'MacOS', 'Claude'),
      ),
    ).then((found) => {
      if (!found) this.executable = null // permite detectar instalação posterior
      return found
    })
    return this.executable
  }

  async launch(profile: Profile): Promise<ProcessHandle> {
    const executable = await this.resolveExecutable()
    if (!executable) throw notInstalled('desktop')
    try {
      // Executa o binário direto (e não `open`) para obter o PID real da instância.
      const child = await spawnDetached(executable, [`--user-data-dir=${profile.desktopDataDir}`], {
        cwd: this.ctx.home,
        env: buildChildEnv(this.ctx.env, { CLAUDE_CONFIG_DIR: profile.cliConfigDir }),
      })
      return toProcessHandle(child)
    } catch (error) {
      throw launchFailed('desktop', error)
    }
  }

  isRunning(profile: Profile): Promise<boolean> {
    return this.scanner.hasUserDataDir(profile.desktopDataDir)
  }
}
