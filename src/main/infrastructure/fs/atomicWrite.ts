import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/** Grava em arquivo temporário e renomeia: nunca deixa o arquivo final pela metade. */
export async function writeFileAtomic(file: string, contents: string, mode = 0o600): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await fs.writeFile(tmp, contents, { mode })
    await fs.rename(tmp, file)
  } catch (error) {
    await fs.rm(tmp, { force: true })
    throw error
  }
}
