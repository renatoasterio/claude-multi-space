import {
  execFile,
  spawn,
  type ChildProcess,
  type ExecFileOptions,
  type SpawnOptions,
} from 'node:child_process'

export type SafeSpawnOptions = Omit<SpawnOptions, 'shell'>

/**
 * spawn sem shell (args nunca são interpretados), resolvendo quando o processo de fato inicia.
 * Rejeita em ENOENT/EACCES em vez de deixar um 'error' sem tratamento.
 */
export function spawnSafe(
  command: string,
  args: string[],
  options: SafeSpawnOptions = {},
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, shell: false })
    const onSpawn = () => {
      child.off('error', onError)
      resolve(child)
    }
    const onError = (error: Error) => {
      child.off('spawn', onSpawn)
      reject(error)
    }
    child.once('spawn', onSpawn)
    child.once('error', onError)
  })
}

/** Inicia um processo independente do app (sobrevive ao fechamento) sem prender o event loop. */
export async function spawnDetached(
  command: string,
  args: string[],
  options: SafeSpawnOptions = {},
): Promise<ChildProcess> {
  const child = await spawnSafe(command, args, { ...options, detached: true, stdio: 'ignore' })
  // Evita 'error' tardio derrubar o main process.
  child.on('error', () => undefined)
  child.unref()
  return child
}

/** execFile sem shell retornando stdout; limite de buffer evita consumo excessivo de memória. */
export function execFileText(
  command: string,
  args: string[],
  options: ExecFileOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        maxBuffer: 8 * 1024 * 1024,
        timeout: 10_000,
        windowsHide: true,
        ...options,
        encoding: 'utf8',
        shell: false,
      },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    )
  })
}
