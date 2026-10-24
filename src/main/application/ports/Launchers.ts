import type { Profile } from '../../domain/entities/Profile'

export interface ProcessHandle {
  readonly pid: number | undefined
  /** Registra callback de término; retorna função para remover o listener. */
  onExit(listener: () => void): () => void
}

export interface DesktopLauncher {
  resolveExecutable(): Promise<string | null>
  launch(profile: Profile): Promise<ProcessHandle>
  /** Detecta instância já aberta (inclusive iniciada antes deste app). */
  isRunning(profile: Profile): Promise<boolean>
  /** Traz para frente a janela da instância aberta. Retorna false se não encontrou o processo. */
  focus(profile: Profile): Promise<boolean>
}

export interface CliLauncher {
  resolveExecutable(): Promise<string | null>
  /** Abre um terminal do SO com CLAUDE_CONFIG_DIR do perfil executando `claude`. */
  openTerminal(profile: Profile): Promise<void>
}
