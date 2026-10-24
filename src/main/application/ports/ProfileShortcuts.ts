import type { Profile } from '../../domain/entities/Profile'

/** Atalho do sistema (app no macOS, item do Menu Iniciar no Windows) com o ícone do perfil. */
export interface ProfileShortcuts {
  readonly supported: boolean
  /** Cria ou recria o atalho (nome e cor atuais); retorna o caminho criado. */
  create(profile: Profile): Promise<string>
  remove(profile: Profile): Promise<void>
  /** Caminho do atalho existente, se houver. */
  find(profile: Profile): Promise<string | null>
}
