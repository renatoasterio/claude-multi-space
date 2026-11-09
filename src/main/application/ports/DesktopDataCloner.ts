export interface PathRewrite {
  /** Caminho absoluto como a origem se refere a si mesma (ex.: ~/.claude). */
  from: string
  /** Caminho que o substitui no destino (padrão: o próprio `target` da cópia). */
  to?: string
}

export interface CloneOptions {
  /** Nomes (no nível raiz da origem) que não devem ser copiados. */
  skipTopLevel?: readonly string[]
  /**
   * Caminhos absolutos a religar nos arquivos de texto copiados. `files` lista caminhos
   * relativos ao destino; `allJson: true` percorre todos os *.json do destino.
   */
  rewrite?: { rules: readonly PathRewrite[]; files?: readonly string[]; allJson?: boolean }
}

/** Copia uma pasta de dados (Claude Desktop ou Claude Code) para dentro de um perfil. */
export interface DesktopDataCloner {
  /**
   * Copia `source` para `target` (que não deve existir). No macOS usa clone APFS,
   * então é instantâneo e não duplica espaço em disco; senão copia arquivo a arquivo.
   */
  clone(source: string, target: string, options?: CloneOptions): Promise<void>
}
