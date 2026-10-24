import { ErrorCodes } from '@shared/contracts/errors'
import type { DesktopLaunchResult } from '@shared/schemas/profile.schema'
import { DomainError } from '../../domain/errors/DomainError'
import type { DesktopLauncher } from '../ports/Launchers'
import type { ProcessRegistry } from '../ports/ProcessRegistry'
import type { ProfileFinder } from '../services/ProfileFinder'

/**
 * Abre o Claude Desktop do perfil garantindo **uma única instância por perfil**: o Claude não
 * bloqueia duas instâncias no mesmo user-data-dir (o que corromperia a sessão), então, se já
 * houver uma aberta — ou sendo aberta agora —, a janela existente é trazida para frente.
 */
export class LaunchDesktop {
  private readonly inFlight = new Map<string, Promise<DesktopLaunchResult>>()

  constructor(
    private readonly finder: ProfileFinder,
    private readonly launcher: DesktopLauncher,
    private readonly registry: ProcessRegistry,
  ) {}

  execute(id: string): Promise<DesktopLaunchResult> {
    // Cliques repetidos (botão, bandeja, atalho) enquanto a abertura está em andamento
    // reaproveitam a mesma operação em vez de abrir outra instância.
    const pending = this.inFlight.get(id)
    if (pending) return pending
    const task = this.run(id).finally(() => this.inFlight.delete(id))
    this.inFlight.set(id, task)
    return task
  }

  private async run(id: string): Promise<DesktopLaunchResult> {
    const profile = await this.finder.getById(id)
    if (this.registry.isTracked(profile.id.value) || (await this.launcher.isRunning(profile))) {
      await this.launcher.focus(profile)
      return 'focused'
    }
    if (!(await this.launcher.resolveExecutable())) {
      throw new DomainError(ErrorCodes.NotInstalled, 'errors.desktopNotInstalled')
    }
    const handle = await this.launcher.launch(profile)
    this.registry.track(profile.id.value, handle)
    return 'launched'
  }
}
