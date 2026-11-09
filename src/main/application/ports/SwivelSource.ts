/** Perfil salvo pelo Swivel (app de troca de contas do Claude Desktop no macOS). */
export interface SwivelProfile {
  /** Nome do perfil no Swivel; também é o nome da pasta. */
  name: string
  /** Cor escolhida no Swivel (#RRGGBB), se houver. */
  color: string | null
  /** Snapshot da pasta de dados do Claude Desktop: vira o --user-data-dir do perfil. */
  desktopDataDir: string
  /** Tamanho aproximado do snapshot, em bytes (para informar o usuário). */
  sizeBytes: number
  /** true quando este é o perfil que o Swivel está usando no Claude padrão agora. */
  active: boolean
}

/** Lê os perfis salvos pelo Swivel; retorna lista vazia quando ele não está instalado. */
export interface SwivelSource {
  isAvailable(): Promise<boolean>
  listProfiles(): Promise<SwivelProfile[]>
  /**
   * CLAUDE_CONFIG_DIR que a aba Code usa no Claude padrão (~/.claude). O Swivel não o troca,
   * então ele acumula o histórico de todas as contas; null quando não existe.
   */
  sharedCliConfigDir(): Promise<string | null>
  /**
   * Pasta de dados do Claude Desktop em uso (~/Library/Application Support/Claude). O Swivel
   * não copia dela o índice de sessões da aba Code; null quando não existe.
   */
  liveDesktopDataDir(): Promise<string | null>
}
