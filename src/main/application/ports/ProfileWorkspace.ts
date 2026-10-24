import type { Profile, ProfileDirectories } from '../../domain/entities/Profile'
import type { ProfileId } from '../../domain/value-objects/ProfileId'

export interface ImportCandidate {
  path: string
  suggestedName: string
}

/** Gerencia os diretórios isolados de cada perfil no disco. */
export interface ProfileWorkspace {
  readonly root: string
  /** Cria (0700) os diretórios gerenciados; `importedCliDir` reaproveita um CLAUDE_CONFIG_DIR existente. */
  provision(id: ProfileId, importedCliDir?: string): Promise<ProfileDirectories>
  /** Remove somente diretórios gerenciados pelo app (dentro de `root`). */
  remove(profile: Profile): Promise<void>
  hasContent(dir: string): Promise<boolean>
  /** Diretórios ~/.claude-* existentes que podem virar perfis. */
  findImportCandidates(): Promise<ImportCandidate[]>
  /** Valida que o caminho é um diretório existente e acessível. */
  isDirectory(path: string): Promise<boolean>
}
