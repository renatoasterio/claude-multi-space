import path from 'node:path'
import type { ProfileShortcuts } from '../../application/ports/ProfileShortcuts'
import type { AppPaths } from '../paths/appPaths'
import { DarwinShortcuts } from './DarwinShortcuts'
import { ShortcutIndex } from './ShortcutIndex'
import { UnsupportedShortcuts } from './UnsupportedShortcuts'
import { WinShortcuts, type WriteShortcutLink } from './WinShortcuts'

export interface ShortcutOptions {
  platform: NodeJS.Platform
  paths: AppPaths
  env: NodeJS.ProcessEnv
  appName: string
  bundleIdPrefix: string
  /** Como o atalho do Windows reabre este app (executável + argumentos fixos). */
  launcher?: { target: string; baseArgs: string[] }
  writeShortcutLink?: WriteShortcutLink
}

export function createShortcuts(options: ShortcutOptions): ProfileShortcuts {
  const { platform, paths, env, appName } = options
  const index = new ShortcutIndex(paths.shortcutsIndexFile)
  if (platform === 'darwin') {
    const dir = path.join(paths.home, 'Applications', appName)
    return new DarwinShortcuts(dir, index, `${options.bundleIdPrefix}.shortcut`)
  }
  if (platform === 'win32' && options.launcher && options.writeShortcutLink) {
    const appData = env.APPDATA ?? path.join(paths.home, 'AppData', 'Roaming')
    const dir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', appName)
    return new WinShortcuts(dir, paths.iconsDir, index, options.launcher, options.writeShortcutLink)
  }
  return new UnsupportedShortcuts()
}
