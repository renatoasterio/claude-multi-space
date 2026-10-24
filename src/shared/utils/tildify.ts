/** Exibe caminhos dentro da home como "~/..." (só apresentação). */
export function tildify(path: string, home: string | undefined): string {
  if (!home) return path
  if (path === home) return '~'
  for (const sep of ['/', '\\']) {
    if (path.startsWith(home + sep)) return `~${sep}${path.slice(home.length + 1)}`
  }
  return path
}
