/** Links que os atalhos do sistema usam para pedir ações ao app. */
export const DeepLinkScheme = 'claude-multispace'

const DESKTOP_LINK = new RegExp(
  `^${DeepLinkScheme}://desktop/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/?$`,
  'i',
)

export type DeepLink = { action: 'open-desktop'; profileId: string }

export function buildDesktopLink(profileId: string): string {
  return `${DeepLinkScheme}://desktop/${profileId}`
}

/** Aceita apenas o formato exato; qualquer outra coisa é ignorada. */
export function parseDeepLink(value: string): DeepLink | null {
  const match = DESKTOP_LINK.exec(value.trim())
  return match ? { action: 'open-desktop', profileId: match[1]!.toLowerCase() } : null
}

/** Procura um link válido entre os argumentos de linha de comando (Windows/Linux). */
export function findDeepLinkInArgs(argv: readonly string[]): DeepLink | null {
  for (const arg of argv) {
    const link = parseDeepLink(arg)
    if (link) return link
  }
  return null
}
