/** Copia a pasta de dados de um Claude Desktop para dentro de um perfil. */
export interface DesktopDataCloner {
  /**
   * Copia `source` para `target` (que não deve existir). No macOS usa clone APFS,
   * então é instantâneo e não duplica espaço em disco; senão copia arquivo a arquivo.
   * Arquivos de controle de outros apps (ex.: manifesto do Swivel) ficam de fora.
   */
  clone(source: string, target: string): Promise<void>
}
