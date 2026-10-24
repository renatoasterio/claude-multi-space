import { EventEmitter } from 'node:events'
import type { CliLauncher, DesktopLauncher, ProcessHandle } from '@main/application/ports/Launchers'
import type { ProfileRepository } from '@main/application/ports/ProfileRepository'
import type { ImportCandidate, ProfileWorkspace } from '@main/application/ports/ProfileWorkspace'
import { ProfileFinder } from '@main/application/services/ProfileFinder'
import { ProfileStatusReader } from '@main/application/services/ProfileStatusReader'
import { CreateProfile } from '@main/application/use-cases/CreateProfile'
import type { Profile, ProfileDirectories } from '@main/domain/entities/Profile'
import type { ProfileId } from '@main/domain/value-objects/ProfileId'
import { ChildProcessRegistry } from '@main/infrastructure/process/ChildProcessRegistry'
import { ProfileMapper } from '@main/mappers/ProfileMapper'

export class InMemoryProfileRepository implements ProfileRepository {
  readonly records = new Map<string, ReturnType<typeof ProfileMapper.toRecord>>()
  async findAll() {
    return [...this.records.values()].map(ProfileMapper.toDomain)
  }
  async findById(id: ProfileId) {
    const r = this.records.get(id.value)
    return r ? ProfileMapper.toDomain(r) : null
  }
  async save(profile: Profile) {
    this.records.set(profile.id.value, ProfileMapper.toRecord(profile))
  }
  async delete(id: ProfileId) {
    this.records.delete(id.value)
  }
}

export class FakeWorkspace implements ProfileWorkspace {
  readonly root = '/root/profiles'
  removed: string[] = []
  candidates: ImportCandidate[] = []
  withContent = new Set<string>()
  async provision(id: ProfileId, importedCliDir?: string): Promise<ProfileDirectories> {
    return {
      desktopDataDir: `${this.root}/${id.value}/desktop`,
      cliConfigDir: importedCliDir ?? `${this.root}/${id.value}/cli`,
      imported: Boolean(importedCliDir),
    }
  }
  async remove(profile: Profile) {
    this.removed.push(profile.id.value)
  }
  async hasContent(dir: string) {
    return this.withContent.has(dir)
  }
  async findImportCandidates() {
    return this.candidates
  }
  async isDirectory() {
    return true
  }
}

export class FakeProcess implements ProcessHandle {
  private readonly emitter = new EventEmitter()
  constructor(readonly pid = 1234) {}
  onExit(listener: () => void) {
    this.emitter.once('exit', listener)
    return () => void this.emitter.off('exit', listener)
  }
  exit() {
    this.emitter.emit('exit')
  }
  listenerCount() {
    return this.emitter.listenerCount('exit')
  }
}

export class FakeDesktopLauncher implements DesktopLauncher {
  executable: string | null = '/Applications/Claude.app/Contents/MacOS/Claude'
  running = new Set<string>()
  launched: FakeProcess[] = []
  async resolveExecutable() {
    return this.executable
  }
  async launch() {
    const proc = new FakeProcess()
    this.launched.push(proc)
    return proc
  }
  async isRunning(profile: Profile) {
    return this.running.has(profile.id.value)
  }
}

export class FakeCliLauncher implements CliLauncher {
  executable: string | null = '/usr/local/bin/claude'
  opened: string[] = []
  async resolveExecutable() {
    return this.executable
  }
  async openTerminal(profile: Profile) {
    this.opened.push(profile.id.value)
  }
}

let uuidCounter = 0
export const nextUuid = () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`

export function makeContext() {
  const repository = new InMemoryProfileRepository()
  const workspace = new FakeWorkspace()
  const desktop = new FakeDesktopLauncher()
  const cli = new FakeCliLauncher()
  const registry = new ChildProcessRegistry()
  const clock = { now: () => new Date('2026-01-01T00:00:00.000Z') }
  const ids = { next: nextUuid }
  const finder = new ProfileFinder(repository)
  const status = new ProfileStatusReader(workspace, desktop, registry)
  const createProfile = new CreateProfile(repository, workspace, finder, status, ids, clock)
  return {
    repository,
    workspace,
    desktop,
    cli,
    registry,
    clock,
    ids,
    finder,
    status,
    createProfile,
  }
}
