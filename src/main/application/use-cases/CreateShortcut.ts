import { ErrorCodes } from '@shared/contracts/errors'
import { DomainError } from '../../domain/errors/DomainError'
import type { ProfileShortcuts } from '../ports/ProfileShortcuts'
import type { ProfileFinder } from '../services/ProfileFinder'

/** Cria (ou recria) o atalho do perfil com o ícone na cor dele. Retorna o caminho criado. */
export class CreateShortcut {
  constructor(
    private readonly finder: ProfileFinder,
    private readonly shortcuts: ProfileShortcuts,
  ) {}

  async execute(id: string): Promise<string> {
    if (!this.shortcuts.supported) {
      throw new DomainError(ErrorCodes.UnsupportedPlatform, 'errors.unsupportedPlatform')
    }
    const profile = await this.finder.getById(id)
    try {
      return await this.shortcuts.create(profile)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new DomainError(
        ErrorCodes.Internal,
        'errors.shortcutFailed',
        { reason },
        { cause: error },
      )
    }
  }
}
