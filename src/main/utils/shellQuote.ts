/** Aspas simples POSIX: 'abc' com ' escapado como '\'' — seguro contra injeção em sh/zsh/bash. */
export function quotePosix(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** Aspas simples do PowerShell: ' vira ''. */
export function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * Valor para `set "VAR=valor"` / `"caminho"` em arquivos .cmd.
 * Aspas não são permitidas em caminhos Windows; % é duplicado para não expandir variáveis.
 */
export function escapeCmdValue(value: string): string {
  if (/["\r\n\0]/.test(value))
    throw new Error('Value contains characters that are not allowed in cmd.')
  return value.replace(/%/g, '%%')
}
