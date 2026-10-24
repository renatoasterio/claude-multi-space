import { ErrorCodes } from '@shared/contracts/errors'
import type { CliLauncher, DesktopLauncher, ProcessHandle } from '../../application/ports/Launchers'
import { DomainError } from '../../domain/errors/DomainError'

const unsupported = () =>
  new DomainError(ErrorCodes.UnsupportedPlatform, 'errors.unsupportedPlatform')

export class UnsupportedLauncher implements DesktopLauncher, CliLauncher {
  async resolveExecutable(): Promise<string | null> {
    return null
  }
  async launch(): Promise<ProcessHandle> {
    throw unsupported()
  }
  async isRunning(): Promise<boolean> {
    return false
  }
  async focus(): Promise<boolean> {
    return false
  }
  async openTerminal(): Promise<void> {
    throw unsupported()
  }
}
