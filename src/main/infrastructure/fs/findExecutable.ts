import { constants, promises as fs } from 'node:fs'
import path from 'node:path'

export async function isExecutableFile(file: string): Promise<boolean> {
  try {
    const stat = await fs.stat(file)
    if (!stat.isFile()) return false
    if (process.platform !== 'win32') await fs.access(file, constants.X_OK)
    return true
  } catch {
    return false
  }
}

export interface FindExecutableOptions {
  /** Nomes a procurar (no Windows inclua extensões: claude.exe, claude.cmd). */
  names: string[]
  /** Diretórios prioritários antes do PATH (instaladores conhecidos). */
  preferredDirs?: string[]
  pathEnv?: string | undefined
}

/** Equivalente a `which`/`where` sem abrir shell. */
export async function findExecutable({
  names,
  preferredDirs = [],
  pathEnv,
}: FindExecutableOptions): Promise<string | null> {
  const pathDirs = (pathEnv ?? '').split(path.delimiter).filter(Boolean)
  const dirs = [...new Set([...preferredDirs, ...pathDirs])]
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name)
      if (await isExecutableFile(candidate)) return candidate
    }
  }
  return null
}

export async function firstExisting(files: string[]): Promise<string | null> {
  for (const file of files) {
    if (await isExecutableFile(file)) return file
  }
  return null
}
