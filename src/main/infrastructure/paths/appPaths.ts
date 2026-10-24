import path from 'node:path'

export interface AppPaths {
  home: string
  /** Pasta do app: ~/.claude-multispace */
  baseDir: string
  /** Raiz dos dados isolados de cada perfil: ~/.claude-multispace/profiles */
  profilesRoot: string
  /** Scripts gerados para abrir o CLI no terminal. */
  scriptsDir: string
  /** Metadados dos perfis (nome, cor, caminhos). */
  profilesFile: string
  /** Preferências do app (idioma). */
  settingsFile: string
  /** Índice id do perfil -> caminho do atalho do sistema. */
  shortcutsIndexFile: string
  /** Ícones .ico gerados para os atalhos do Windows. */
  iconsDir: string
}

export function resolveAppPaths(home: string): AppPaths {
  const base = path.join(home, '.claude-multispace')
  return {
    home,
    baseDir: base,
    profilesRoot: path.join(base, 'profiles'),
    scriptsDir: path.join(base, 'scripts'),
    profilesFile: path.join(base, 'profiles.json'),
    settingsFile: path.join(base, 'settings.json'),
    shortcutsIndexFile: path.join(base, 'shortcuts.json'),
    iconsDir: path.join(base, 'icons'),
  }
}
