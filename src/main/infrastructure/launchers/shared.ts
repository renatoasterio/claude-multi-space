import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Profile } from '../../domain/entities/Profile'
import { DomainError } from '../../domain/errors/DomainError'
import { ErrorCodes } from '@shared/contracts/errors'
import { writeFileAtomic } from '../fs/atomicWrite'

export interface LauncherContext {
  home: string
  scriptsDir: string
  env: NodeJS.ProcessEnv
}

/** Pasta onde o CLI abre: a pasta padrão do perfil, se ainda existir; senão a home. */
export async function resolveWorkingDir(profile: Profile, home: string): Promise<string> {
  if (!profile.workingDir) return home
  try {
    return (await fs.stat(profile.workingDir)).isDirectory() ? profile.workingDir : home
  } catch {
    return home
  }
}

export async function writeLaunchScript(
  ctx: LauncherContext,
  profile: Profile,
  ext: string,
  contents: string,
) {
  const file = path.join(ctx.scriptsDir, `${profile.id.value}${ext}`)
  await writeFileAtomic(file, contents, 0o700)
  return file
}

export function notInstalled(kind: 'desktop' | 'cli'): DomainError {
  return new DomainError(
    ErrorCodes.NotInstalled,
    kind === 'desktop' ? 'errors.desktopNotInstalled' : 'errors.cliNotInstalled',
  )
}

export function launchFailed(kind: 'desktop' | 'terminal', cause: unknown): DomainError {
  const reason = cause instanceof Error ? cause.message : String(cause)
  const key = kind === 'desktop' ? 'errors.launchDesktopFailed' : 'errors.launchTerminalFailed'
  return new DomainError(ErrorCodes.LaunchFailed, key, { reason }, { cause })
}
