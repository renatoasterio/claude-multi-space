export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters =
    parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [name.trim().slice(0, 2)]
  return letters.join('').toUpperCase()
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
