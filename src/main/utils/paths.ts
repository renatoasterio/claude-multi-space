import path from 'node:path'

/** true quando `child` está estritamente dentro de `parent` (proteção contra path traversal). */
export function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child))
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}
