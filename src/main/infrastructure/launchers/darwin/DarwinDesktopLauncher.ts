import path from 'node:path'
import type { DesktopLauncher, ProcessHandle } from '../../../application/ports/Launchers'
import type { Profile } from '../../../domain/entities/Profile'
import { buildChildEnv } from '../../../utils/childEnv'
import { spawnDetached } from '../../../utils/spawnSafe'
import { firstExisting } from '../../fs/findExecutable'
import { toProcessHandle } from '../../process/childProcessHandle'
import { darwinProcesses, ProcessScanner } from '../../process/ProcessScanner'
import { execFileText } from '../../../utils/spawnSafe'
import { launchFailed, notInstalled, type LauncherContext } from '../shared'

export class DarwinDesktopLauncher implements DesktopLauncher {
  private executable: Promise<string | null> | null = null

  constructor(
    private readonly ctx: LauncherContext,
    private readonly scanner = new ProcessScanner(darwinProcesses),
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
      this.scanner.invalidate()
      return toProcessHandle(child)
    } catch (error) {
      throw launchFailed('desktop', error)
    }
  }

  isRunning(profile: Profile): Promise<boolean> {
    return this.scanner.hasUserDataDir(profile.desktopDataDir)
  }

  /**
   * Ativa a instância pelo PID via NSRunningApplication (JXA). Não usa Apple Events para
   * outro app, então não exige permissão de Automação/Acessibilidade.
   */
  async focus(profile: Profile): Promise<boolean> {
    const pid = await this.scanner.findMainPid(profile.desktopDataDir)
    if (!pid) return false
    try {
      const out = await execFileText('/usr/bin/osascript', [
        '-l',
        'JavaScript',
        '-e',
        ACTIVATE_BY_PID,
        String(pid),
      ])
      return out.trim() === 'ok'
    } catch {
      return false
    }
  }
}

// NSApplicationActivateAllWindows (1) | NSApplicationActivateIgnoringOtherApps (2)
const ACTIVATE_BY_PID = `
ObjC.import('AppKit')
function run(argv) {
  const app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(Number(argv[0]))
  if (!app || app.isNil()) return 'missing'
  app.unhide
  return app.activateWithOptions(3) ? 'ok' : 'failed'
}`
