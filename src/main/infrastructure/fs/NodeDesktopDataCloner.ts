import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  CloneOptions,
  DesktopDataCloner,
  PathRewrite,
} from '../../application/ports/DesktopDataCloner'
import { execFileText } from '../../utils/spawnSafe'
import { writeFileAtomic } from './atomicWrite'

/** Arquivos de controle de outros apps que nunca pertencem à cópia. */
const ALWAYS_SKIP = ['.swivel-manifest.json']
/** Arquivos de texto maiores que isso não são religados (índices do Claude têm poucos KB). */
const MAX_REWRITE_BYTES = 4 * 1024 * 1024

/**
 * macOS: `cp -c` pede clone APFS (copy-on-write): leva segundos para gigabytes e só ocupa
 * espaço conforme os arquivos divergem. Em outros sistemas (ou se o clone falhar), copia.
 */
export class NodeDesktopDataCloner implements DesktopDataCloner {
  constructor(private readonly platform: NodeJS.Platform = process.platform) {}

  async clone(rawSource: string, target: string, options: CloneOptions = {}): Promise<void> {
    // Se a origem for um symlink (ex.: ~/.claude relocado), copiamos o conteúdo real; copiar o
    // link faria o perfil escrever na pasta original.
    const source = await fs.realpath(rawSource)
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

    // Remover depois de clonar é barato (clone é instantâneo) e mantém um único caminho de cópia.
    for (const name of [...ALWAYS_SKIP, ...(options.skipTopLevel ?? [])]) {
      await fs.rm(path.join(target, name), { recursive: true, force: true })
    }

    if (options.rewrite) {
      // A origem pode ser citada pelo caminho digitado ou pelo real; as duas formas são trocadas.
      const rules = (
        await Promise.all(
          options.rewrite.rules.map(async (rule) => {
            const to = rule.to ?? target
            const refersToSource = [rawSource, source].some(
              (candidate) => path.resolve(candidate) === path.resolve(rule.from),
            )
            // Arquivos podem guardar o caminho como digitado ou já resolvido (symlinks).
            const aliases = new Set([rule.from, await realpathOrSelf(rule.from)])
            if (refersToSource) [rawSource, source].forEach((alias) => aliases.add(alias))
            return [...aliases].map((from) => ({ from, to }))
          }),
        )
      ).flat()
      const files = [...(options.rewrite.files ?? []).map((f) => path.join(target, f))]
      if (options.rewrite.allJson) files.push(...(await listJsonFiles(target)))
      await Promise.all(files.map((file) => rewritePaths(file, rules)))
    }
  }
}

/** Troca cada `from` por `to` quando seguido de separador, aspas, espaço ou fim da string. */
async function rewritePaths(file: string, rules: readonly Required<PathRewrite>[]) {
  let text: string
  try {
    const stat = await fs.stat(file)
    if (!stat.isFile() || stat.size > MAX_REWRITE_BYTES) return
    text = await fs.readFile(file, 'utf8')
  } catch {
    return
  }
  let next = text
  // Mais longo primeiro: um prefixo não pode "comer" parte de um caminho maior.
  for (const { from, to } of [...rules].sort((a, b) => b.from.length - a.from.length)) {
    const resolved = path.resolve(from)
    const boundary = `(?=[/\\\\"']|\\s|$)`
    next = next.replace(new RegExp(escapeRegExp(resolved) + boundary, 'g'), () => to)
  }
  if (next !== text) await writeFileAtomic(file, next)
}

async function listJsonFiles(root: string): Promise<string[]> {
  const out: string[] = []
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()!
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full)
    }
  }
  return out
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function realpathOrSelf(target: string): Promise<string> {
  try {
    return await fs.realpath(target)
  } catch {
    return target
  }
}
