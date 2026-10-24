import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { DesktopLauncher, ProcessHandle } from '../../../application/ports/Launchers'
import type { Profile } from '../../../domain/entities/Profile'
import { buildChildEnv } from '../../../utils/childEnv'
import { spawnDetached } from '../../../utils/spawnSafe'
import { compareVersions } from '../../../utils/versions'
import { firstExisting } from '../../fs/findExecutable'
import { toProcessHandle } from '../../process/childProcessHandle'
import { ProcessScanner, win32CommandLines } from '../../process/ProcessScanner'
import { launchFailed, notInstalled, type LauncherContext } from '../shared'

export class WinDesktopLauncher implements DesktopLauncher {
  constructor(
    private readonly ctx: LauncherContext,
    private readonly scanner = new ProcessScanner(win32CommandLines, {
      ttlMs: 3000,
      caseInsensitive: true,
    }),
  ) {}

  async resolveExecutable(): Promise<string | null> {
    const localAppData = this.ctx.env.LOCALAPPDATA ?? path.join(this.ctx.home, 'AppData', 'Local')
    const programFiles = this.ctx.env.ProgramFiles ?? 'C:\\Program Files'
    const squirrelRoot = path.join(localAppData, 'AnthropicClaude')

    return firstExisting([
      // Squirrel: o claude.exe da raiz é só um stub que reabre o app-x.y.z e sai (perderíamos o PID).
      ...(await latestSquirrelApp(squirrelRoot)),
      path.join(squirrelRoot, 'claude.exe'),
      path.join(localAppData, 'Programs', 'Claude', 'Claude.exe'),
      path.join(programFiles, 'Claude', 'Claude.exe'),
    ])
  }

  async launch(profile: Profile): Promise<ProcessHandle> {
    const executable = await this.resolveExecutable()
    if (!executable) throw notInstalled('desktop')
    try {
      const child = await spawnDetached(executable, [`--user-data-dir=${profile.desktopDataDir}`], {
        cwd: path.dirname(executable),
        env: buildChildEnv(this.ctx.env, { CLAUDE_CONFIG_DIR: profile.cliConfigDir }),
        windowsHide: false,
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

async function latestSquirrelApp(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && e.name.startsWith('app-'))
      .map((e) => e.name)
      .sort((a, b) => compareVersions(b.slice(4), a.slice(4)))
      .map((dir) => path.join(root, dir, 'claude.exe'))
  } catch {
    return []
  }
}
