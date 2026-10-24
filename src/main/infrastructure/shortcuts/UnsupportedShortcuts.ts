import type { ProfileShortcuts } from '../../application/ports/ProfileShortcuts'

export class UnsupportedShortcuts implements ProfileShortcuts {
  readonly supported = false
  async create(): Promise<string> {
    throw new Error('Shortcuts are not supported on this platform.')
  }
  async remove(): Promise<void> {}
  async find(): Promise<string | null> {
    return null
  }
}
