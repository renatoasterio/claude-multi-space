import type { Profile, ProfileDirectories } from '../../domain/entities/Profile'
import type { ProfileId } from '../../domain/value-objects/ProfileId'

export interface ImportCandidate {
  path: string
  suggestedName: string
}

export interface ProvisionOptions {
  /** Reaproveita um CLAUDE_CONFIG_DIR existente (ex.: ~/.claude-cliente) em vez de criar um novo. */
  importedCliDir?: string
  /** Copia esta pasta de dados do Claude Desktop (ex.: snapshot do Swivel) para o perfil. */
  desktopSourceDir?: string
  /** Origem registrada no perfil para evitar importar o mesmo snapshot duas vezes. */
  importedFrom?: string
}

/** Gerencia os diretórios isolados de cada perfil no disco. */
export interface ProfileWorkspace {
  readonly root: string
  /** Cria (0700) os diretórios gerenciados, importando ou copiando conforme `options`. */
  provision(id: ProfileId, options?: ProvisionOptions): Promise<ProfileDirectories>
  /** Remove somente diretórios gerenciados pelo app (dentro de `root`). */
  remove(profile: Profile): Promise<void>
  hasContent(dir: string): Promise<boolean>
  /** Diretórios ~/.claude-* existentes que podem virar perfis. */
  findImportCandidates(): Promise<ImportCandidate[]>
  /** Valida que o caminho é um diretório existente e acessível. */
  isDirectory(path: string): Promise<boolean>
}
