import type { ErrorPayload } from './errors'
import type {
  EnvironmentDTO,
  ImportCandidateDTO,
  ProfileDTO,
  ProfileInput,
  ShellKind,
  DesktopLaunchResult,
} from '../schemas/profile.schema'
import type { Locale } from '../i18n/locales'

export interface SettingsDTO {
  language: Locale
}

export const IpcChannels = {
  environment: 'app:environment',
  pickDirectory: 'app:pick-directory',
  listProfiles: 'profiles:list',
  createProfile: 'profiles:create',
  updateProfile: 'profiles:update',
  deleteProfile: 'profiles:delete',
  launchDesktop: 'profiles:launch-desktop',
  launchCli: 'profiles:launch-cli',
  copyCommand: 'profiles:copy-command',
  listImportCandidates: 'profiles:import-candidates',
  importProfiles: 'profiles:import',
  createShortcut: 'profiles:create-shortcut',
  profilesChanged: 'profiles:changed',
  getSettings: 'settings:get',
  setLanguage: 'settings:set-language',
} as const

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: ErrorPayload }

type Async<T> = Promise<IpcResult<T>>

/** API exposta ao renderer pelo preload (window.api). */
export interface MultiSpaceApi {
  environment(): Async<EnvironmentDTO>
  getSettings(): Async<SettingsDTO>
  setLanguage(language: Locale): Async<SettingsDTO>
  pickDirectory(): Async<string | null>
  listProfiles(): Async<ProfileDTO[]>
  createProfile(input: ProfileInput): Async<ProfileDTO>
  updateProfile(id: string, input: ProfileInput): Async<ProfileDTO>
  deleteProfile(id: string, removeData: boolean): Async<void>
  launchDesktop(id: string): Async<DesktopLaunchResult>
  launchCli(id: string): Async<void>
  createShortcut(id: string): Async<void>
  copyCommand(id: string, shell: ShellKind): Async<string>
  listImportCandidates(): Async<ImportCandidateDTO[]>
  importProfiles(paths: string[]): Async<ProfileDTO[]>
  /** Retorna função de unsubscribe — sempre chamar no cleanup. */
  onProfilesChanged(listener: () => void): () => void
}
