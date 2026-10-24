const BLOCKED_PREFIXES = ['ELECTRON_', 'VITE_', 'CHROME_']
const BLOCKED_KEYS = new Set(['NODE_OPTIONS', 'NODE_ENV', 'CLAUDE_CONFIG_DIR'])

/**
 * Ambiente para processos filhos: remove variáveis do nosso Electron que poderiam alterar
 * o comportamento do Claude (ex.: ELECTRON_RUN_AS_NODE) e aplica os overrides do perfil.
 */
export function buildChildEnv(
  base: NodeJS.ProcessEnv,
  overrides: Record<string, string>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue
    if (BLOCKED_KEYS.has(key) || BLOCKED_PREFIXES.some((p) => key.startsWith(p))) continue
    env[key] = value
  }
  return { ...env, ...overrides }
}
