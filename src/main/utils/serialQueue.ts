/**
 * Executa tarefas assíncronas uma por vez, na ordem de chegada.
 * Usado para que escritas concorrentes no arquivo de perfis nunca se intercalem.
 */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve()

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task)
    this.tail = result.catch(() => undefined)
    return result
  }
}
