import type { ProfileInput, ShellKind } from '@shared/schemas/profile.schema'
import { unwrap } from '../../../shared/utils/apiClient'

/** Fachada do renderer sobre window.api — único ponto que conhece o IPC. */
export const profilesService = {
  environment: () => unwrap(window.api.environment()),
  pickDirectory: () => unwrap(window.api.pickDirectory()),
  list: () => unwrap(window.api.listProfiles()),
  create: (input: ProfileInput) => unwrap(window.api.createProfile(input)),
  update: (id: string, input: ProfileInput) => unwrap(window.api.updateProfile(id, input)),
  remove: (id: string, removeData: boolean) => unwrap(window.api.deleteProfile(id, removeData)),
  launchDesktop: (id: string) => unwrap(window.api.launchDesktop(id)),
  launchCli: (id: string) => unwrap(window.api.launchCli(id)),
  createShortcut: (id: string) => unwrap(window.api.createShortcut(id)),
  copyCommand: (id: string, shell: ShellKind) => unwrap(window.api.copyCommand(id, shell)),
  importCandidates: () => unwrap(window.api.listImportCandidates()),
  importProfiles: (paths: string[]) => unwrap(window.api.importProfiles(paths)),
  onChanged: (listener: () => void) => window.api.onProfilesChanged(listener),
}
