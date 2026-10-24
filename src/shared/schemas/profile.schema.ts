import { z } from 'zod'
import { ProfileConstraints as C } from './profile.constraints'

const optionalText = <T extends z.ZodType<string>>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional(),
  )

export const ProfileIdSchema = z.uuid()

export const ProfileInputSchema = z.strictObject({
  name: z.string().trim().min(C.nameMinLength).max(C.nameMaxLength),
  color: z.string().regex(C.hexColorPattern),
  email: optionalText(z.string().trim().max(C.emailMaxLength).pipe(z.email())),
  workingDir: optionalText(z.string().max(C.pathMaxLength)),
})

export const DeleteProfileSchema = z.strictObject({
  id: ProfileIdSchema,
  removeData: z.boolean(),
})

export const UpdateProfileSchema = z.strictObject({
  id: ProfileIdSchema,
  input: ProfileInputSchema,
})

export const ImportProfilesSchema = z.strictObject({
  paths: z.array(z.string().min(1).max(C.pathMaxLength)).min(1).max(C.maxImportBatch),
})

export const ShellKindSchema = z.enum(['posix', 'powershell', 'cmd'])

export const CopyCommandSchema = z.strictObject({
  id: ProfileIdSchema,
  shell: ShellKindSchema,
})

export type ProfileInput = z.infer<typeof ProfileInputSchema>
export type ShellKind = z.infer<typeof ShellKindSchema>

export interface ProfileStatusDTO {
  desktopRunning: boolean
  desktopInitialized: boolean
  cliInitialized: boolean
}

export interface ProfileDTO {
  id: string
  name: string
  color: string
  email: string | null
  workingDir: string | null
  desktopDataDir: string
  cliConfigDir: string
  imported: boolean
  createdAt: string
  updatedAt: string
  status: ProfileStatusDTO
}

export interface ImportCandidateDTO {
  path: string
  suggestedName: string
}

export interface EnvironmentDTO {
  platform: 'darwin' | 'win32' | 'linux'
  desktopExecutable: string | null
  cliExecutable: string | null
  profilesRoot: string
  homeDir: string
}
