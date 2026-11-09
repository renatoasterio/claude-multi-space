import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { DesktopDataCloner } from '../../application/ports/DesktopDataCloner'
import { execFileText } from '../../utils/spawnSafe'

/** Arquivos de controle de outros apps que não pertencem ao perfil copiado. */
const SKIP_TOP_LEVEL = new Set(['.swivel-manifest.json'])

/**
 * macOS: `cp -c` pede clone APFS (copy-on-write): leva segundos para gigabytes e só ocupa
 * espaço conforme os arquivos divergem. Em outros sistemas (ou se o clone falhar), copia.
 */
export class NodeDesktopDataCloner implements DesktopDataCloner {
  constructor(private readonly platform: NodeJS.Platform = process.platform) {}

  async clone(source: string, target: string): Promise<void> {
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
    if (this.platform === 'darwin') {
      try {
        await execFileText('/bin/cp', ['-cR', source, target], { timeout: 10 * 60_000 })
      } catch {
        await fs.rm(target, { recursive: true, force: true })
        await fs.cp(source, target, { recursive: true, errorOnExist: true, force: false })
      }
    } else {
      await fs.cp(source, target, { recursive: true, errorOnExist: true, force: false })
    }
    await fs.chmod(target, 0o700)
    for (const name of SKIP_TOP_LEVEL) await fs.rm(path.join(target, name), { force: true })
  }
}
