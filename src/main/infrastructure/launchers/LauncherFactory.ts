import type { CliLauncher, DesktopLauncher } from '../../application/ports/Launchers'
import { DarwinCliLauncher } from './darwin/DarwinCliLauncher'
import { DarwinDesktopLauncher } from './darwin/DarwinDesktopLauncher'
import type { LauncherContext } from './shared'
import { UnsupportedLauncher } from './UnsupportedLaunchers'
import { WinCliLauncher } from './win32/WinCliLauncher'
import { WinDesktopLauncher } from './win32/WinDesktopLauncher'

export interface Launchers {
  desktop: DesktopLauncher
  cli: CliLauncher
}

export function createLaunchers(platform: NodeJS.Platform, ctx: LauncherContext): Launchers {
  switch (platform) {
    case 'darwin':
      return { desktop: new DarwinDesktopLauncher(ctx), cli: new DarwinCliLauncher(ctx) }
    case 'win32':
      return { desktop: new WinDesktopLauncher(ctx), cli: new WinCliLauncher(ctx) }
    default: {
      const unsupported = new UnsupportedLauncher()
      return { desktop: unsupported, cli: unsupported }
    }
  }
}
