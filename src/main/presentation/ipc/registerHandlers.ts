import {
  clipboard,
  dialog,
  type BrowserWindow,
  type IpcMain,
  type IpcMainInvokeEvent,
} from 'electron'
import { SupportedLocales } from '@shared/i18n/locales'
import { z } from 'zod'
import { IpcChannels, type IpcResult } from '@shared/contracts/ipc'
import {
  CopyCommandSchema,
  DeleteProfileSchema,
  ImportProfilesSchema,
  ProfileIdSchema,
  ProfileInputSchema,
  UpdateProfileSchema,
  type EnvironmentDTO,
} from '@shared/schemas/profile.schema'
import type { Container } from '../../container'
import { DomainError } from '../../domain/errors/DomainError'
import { ProfileMapper } from '../../mappers/ProfileMapper'
import { toErrorPayload } from './toErrorPayload'

const LanguageSchema = z.enum(SupportedLocales)

export interface HandlerDeps {
  ipcMain: IpcMain
  container: Container
  getWindow: () => BrowserWindow | null
  /** Valida que o IPC veio da nossa página (e não de conteúdo navegado/injetado). */
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean
  /** Chamado após mutações para atualizar tray etc. */
  onProfilesMutated: () => void
}

/** Registra os handlers e retorna função que os remove (usada no shutdown). */
export function registerHandlers(deps: HandlerDeps): () => void {
  const { ipcMain, container, getWindow, isTrustedSender, onProfilesMutated } = deps
  const { useCases, launchers, paths, logger, settings, locale } = container
  const channels: string[] = []

  const handle = <T>(channel: string, fn: (...args: unknown[]) => Promise<T>) => {
    channels.push(channel)
    ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<T>> => {
      try {
        if (!isTrustedSender(event)) {
          throw DomainError.forbidden('errors.untrustedSender')
        }
        return { ok: true, data: await fn(...args) }
      } catch (error) {
        return { ok: false, error: toErrorPayload(error, logger, channel, locale.t) }
      }
    })
  }

  const mutating =
    <A extends unknown[], T>(fn: (...args: A) => Promise<T>) =>
    async (...args: A) => {
      const result = await fn(...args)
      onProfilesMutated()
      return result
    }

  handle(IpcChannels.getSettings, () => settings.get())

  handle(IpcChannels.setLanguage, async (raw: unknown) => {
    const language = LanguageSchema.parse(raw)
    const next = await settings.update({ language })
    locale.set(language)
    return next
  })

  handle(IpcChannels.environment, async (): Promise<EnvironmentDTO> => {
    const [desktopExecutable, cliExecutable] = await Promise.all([
      launchers.desktop.resolveExecutable(),
      launchers.cli.resolveExecutable(),
    ])
    const platform =
      process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux'
    return {
      platform,
      desktopExecutable,
      cliExecutable,
      profilesRoot: paths.profilesRoot,
      homeDir: paths.home,
    }
  })

  handle(IpcChannels.pickDirectory, async () => {
    const window = getWindow()
    const options: Electron.OpenDialogOptions = { properties: ['openDirectory', 'createDirectory'] }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  handle(IpcChannels.listProfiles, async () =>
    (await useCases.listProfiles.execute()).map(ProfileMapper.toDTO),
  )

  handle(
    IpcChannels.createProfile,
    mutating(async (raw: unknown) => {
      const input = ProfileInputSchema.parse(raw)
      await assertWorkingDir(input.workingDir)
      return ProfileMapper.toDTO(await useCases.createProfile.execute(input))
    }),
  )

  handle(
    IpcChannels.updateProfile,
    mutating(async (raw: unknown) => {
      const { id, input } = UpdateProfileSchema.parse(raw)
      await assertWorkingDir(input.workingDir)
      return ProfileMapper.toDTO(await useCases.updateProfile.execute(id, input))
    }),
  )

  handle(
    IpcChannels.deleteProfile,
    mutating(async (raw: unknown) => {
      const { id, removeData } = DeleteProfileSchema.parse(raw)
      await useCases.deleteProfile.execute(id, removeData)
    }),
  )

  handle(IpcChannels.launchDesktop, async (raw: unknown) => {
    await useCases.launchDesktop.execute(ProfileIdSchema.parse(raw))
  })

  handle(IpcChannels.launchCli, async (raw: unknown) => {
    await useCases.launchCli.execute(ProfileIdSchema.parse(raw))
  })

  handle(IpcChannels.copyCommand, async (raw: unknown) => {
    const { id, shell } = CopyCommandSchema.parse(raw)
    const command = await useCases.buildLaunchCommand.execute(id, shell)
    clipboard.writeText(command)
    return command
  })

  handle(IpcChannels.listImportCandidates, () => useCases.listImportCandidates.execute())

  handle(
    IpcChannels.importProfiles,
    mutating(async (raw: unknown) => {
      const { paths: selected } = ImportProfilesSchema.parse(raw)
      return (await useCases.importProfiles.execute(selected)).map(ProfileMapper.toDTO)
    }),
  )

  async function assertWorkingDir(dir: string | undefined) {
    if (dir && !(await container.workspace.isDirectory(dir))) {
      throw DomainError.validation('errors.workingDirMissing')
    }
  }

  return () => {
    for (const channel of channels) ipcMain.removeHandler(channel)
  }
}
