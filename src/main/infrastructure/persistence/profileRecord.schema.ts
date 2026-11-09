import { z } from 'zod'

export const ProfileRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  email: z.string().nullable(),
  workingDir: z.string().nullable(),
  desktopDataDir: z.string(),
  cliConfigDir: z.string(),
  imported: z.boolean(),
  // Opcional para ler arquivos gravados antes do campo existir.
  importedFrom: z.string().nullable().default(null),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const ProfilesFileSchema = z.object({
  version: z.literal(1),
  profiles: z.array(ProfileRecordSchema),
})

export type ProfileRecord = z.infer<typeof ProfileRecordSchema>
export type ProfilesFile = z.infer<typeof ProfilesFileSchema>
