import type { ProfileDTO } from '@shared/schemas/profile.schema'
import type { ProfileView } from '../application/services/ProfileStatusReader'
import { Profile } from '../domain/entities/Profile'
import { HexColor } from '../domain/value-objects/HexColor'
import { ProfileId } from '../domain/value-objects/ProfileId'
import { ProfileName } from '../domain/value-objects/ProfileName'
import type { ProfileRecord } from '../infrastructure/persistence/profileRecord.schema'

export const ProfileMapper = {
  toRecord(profile: Profile): ProfileRecord {
    return {
      id: profile.id.value,
      name: profile.name.value,
      color: profile.color.value,
      email: profile.email,
      workingDir: profile.workingDir,
      desktopDataDir: profile.desktopDataDir,
      cliConfigDir: profile.cliConfigDir,
      imported: profile.imported,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    }
  },

  toDomain(record: ProfileRecord): Profile {
    return Profile.restore({
      id: ProfileId.from(record.id),
      name: ProfileName.from(record.name),
      color: HexColor.from(record.color),
      email: record.email,
      workingDir: record.workingDir,
      desktopDataDir: record.desktopDataDir,
      cliConfigDir: record.cliConfigDir,
      imported: record.imported,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    })
  },

  toDTO({ profile, status }: ProfileView): ProfileDTO {
    return { ...ProfileMapper.toRecord(profile), status: { ...status } }
  },
}
