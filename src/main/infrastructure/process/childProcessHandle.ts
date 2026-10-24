import type { ChildProcess } from 'node:child_process'
import type { ProcessHandle } from '../../application/ports/Launchers'

export function toProcessHandle(child: ChildProcess): ProcessHandle {
  return {
    pid: child.pid,
    onExit(listener) {
      if (child.exitCode !== null || child.signalCode !== null) {
        queueMicrotask(listener)
        return () => undefined
      }
      child.once('exit', listener)
      return () => child.off('exit', listener)
    },
  }
}
