import { randomUUID } from 'node:crypto'
import { DefaultLocale, type Locale } from '@shared/i18n/locales'
import type { CliLauncher, DesktopLauncher } from './application/ports/Launchers'
import type { ProcessRegistry } from './application/ports/ProcessRegistry'
import type { ProfileWorkspace } from './application/ports/ProfileWorkspace'
import type { SettingsStore } from './application/ports/SettingsStore'
import type { Logger } from './application/ports/System'
import { LocaleState } from './application/services/LocaleState'
import { ProfileFinder } from './application/services/ProfileFinder'
import { ProfileStatusReader } from './application/services/ProfileStatusReader'
import { BuildLaunchCommand } from './application/use-cases/BuildLaunchCommand'
import { CreateProfile } from './application/use-cases/CreateProfile'
import { DeleteProfile } from './application/use-cases/DeleteProfile'
import { ImportProfiles, ListImportCandidates } from './application/use-cases/ImportProfiles'
import { LaunchCli } from './application/use-cases/LaunchCli'
import { LaunchDesktop } from './application/use-cases/LaunchDesktop'
import { ListProfiles } from './application/use-cases/ListProfiles'
import { UpdateProfile } from './application/use-cases/UpdateProfile'
import { NodeProfileWorkspace } from './infrastructure/fs/NodeProfileWorkspace'
import { createLaunchers } from './infrastructure/launchers/LauncherFactory'
import { resolveAppPaths, type AppPaths } from './infrastructure/paths/appPaths'
import { JsonProfileRepository } from './infrastructure/persistence/JsonProfileRepository'
import { JsonSettingsStore } from './infrastructure/persistence/JsonSettingsStore'
import { createShortcuts } from './infrastructure/shortcuts/createShortcuts'
import type { WriteShortcutLink } from './infrastructure/shortcuts/WinShortcuts'
import type { ProfileShortcuts } from './application/ports/ProfileShortcuts'
import { CreateShortcut } from './application/use-cases/CreateShortcut'
import { Credits } from '@shared/contracts/credits'
import { ChildProcessRegistry } from './infrastructure/process/ChildProcessRegistry'
import { ConsoleLogger } from './utils/logger'

export interface Container {
  paths: AppPaths
  logger: Logger
  settings: SettingsStore
  locale: LocaleState
  registry: ProcessRegistry
  workspace: ProfileWorkspace
  launchers: { desktop: DesktopLauncher; cli: CliLauncher }
  shortcuts: ProfileShortcuts
  useCases: {
    listProfiles: ListProfiles
    createProfile: CreateProfile
    updateProfile: UpdateProfile
    deleteProfile: DeleteProfile
    launchDesktop: LaunchDesktop
    launchCli: LaunchCli
    buildLaunchCommand: BuildLaunchCommand
    listImportCandidates: ListImportCandidates
    importProfiles: ImportProfiles
    createShortcut: CreateShortcut
  }
  dispose(): void
}

export interface ContainerOptions {
  home: string
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  /** Idioma do sistema operacional, usado até o usuário escolher um. */
  systemLocale: () => Locale
  /** Windows: como o atalho reabre este app; ausente = atalhos indisponíveis. */
  shortcutLauncher?: { target: string; baseArgs: string[] }
  writeShortcutLink?: WriteShortcutLink
}

/** Composition root: único lugar que conhece implementações concretas. */
export function createContainer({
  home,
  platform,
  env,
  systemLocale,
  shortcutLauncher,
  writeShortcutLink,
}: ContainerOptions): Container {
  const paths = resolveAppPaths(home)
  const logger = new ConsoleLogger()
  const settings = new JsonSettingsStore(paths.settingsFile, systemLocale)
  const locale = new LocaleState(DefaultLocale)
  const clock = { now: () => new Date() }
  const ids = { next: () => randomUUID() }

  const repository = new JsonProfileRepository(paths.profilesFile, logger)
  const workspace = new NodeProfileWorkspace(paths.profilesRoot, home, [paths.baseDir])
  const registry = new ChildProcessRegistry()
  const launchers = createLaunchers(platform, { home, scriptsDir: paths.scriptsDir, env })

  const shortcuts = createShortcuts({
    platform,
    paths,
    env,
    appName: Credits.appName,
    bundleIdPrefix: 'com.asoft.claude-multispace',
    launcher: shortcutLauncher,
    writeShortcutLink,
  })

  const finder = new ProfileFinder(repository)
  const status = new ProfileStatusReader(workspace, launchers.desktop, registry, shortcuts)
  const createProfile = new CreateProfile(repository, workspace, finder, status, ids, clock)
  const listImportCandidates = new ListImportCandidates(repository, workspace)

  return {
    paths,
    logger,
    settings,
    locale,
    registry,
    workspace,
    launchers,
    shortcuts,
    useCases: {
      listProfiles: new ListProfiles(repository, status),
      createProfile,
      updateProfile: new UpdateProfile(repository, finder, status, clock, shortcuts),
      deleteProfile: new DeleteProfile(repository, workspace, finder, status, shortcuts),
      launchDesktop: new LaunchDesktop(finder, launchers.desktop, registry),
      launchCli: new LaunchCli(finder, launchers.cli),
      buildLaunchCommand: new BuildLaunchCommand(finder, launchers.cli),
      listImportCandidates,
      importProfiles: new ImportProfiles(listImportCandidates, createProfile, finder, repository),
      createShortcut: new CreateShortcut(finder, shortcuts),
    },
    dispose: () => registry.dispose(),
  }
}
