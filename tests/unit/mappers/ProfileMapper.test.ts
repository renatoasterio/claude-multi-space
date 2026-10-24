import { describe, expect, it } from 'vitest'
import { Profile } from '@main/domain/entities/Profile'
import { ProfileId } from '@main/domain/value-objects/ProfileId'
import { ProfileMapper } from '@main/mappers/ProfileMapper'

describe('ProfileMapper', () => {
  const profile = Profile.create(
    ProfileId.from('22222222-2222-4222-8222-222222222222'),
    { name: 'Cliente', color: '#112233', email: 'x@y.com', workingDir: '/w' },
    { desktopDataDir: '/d', cliConfigDir: '/c', imported: true },
    new Date('2026-03-01T10:00:00.000Z'),
  )

  it('faz round-trip entidade -> record -> entidade', () => {
    const restored = ProfileMapper.toDomain(ProfileMapper.toRecord(profile))
    expect(ProfileMapper.toRecord(restored)).toEqual(ProfileMapper.toRecord(profile))
  })

  it('gera DTO com status e datas ISO', () => {
    const status = {
      desktopRunning: true,
      desktopInitialized: true,
      cliInitialized: false,
      hasShortcut: true,
    }
    const dto = ProfileMapper.toDTO({ profile, status })
    expect(dto).toMatchObject({
      name: 'Cliente',
      imported: true,
      createdAt: '2026-03-01T10:00:00.000Z',
      status,
    })
  })
})
