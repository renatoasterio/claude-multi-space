import { describe, expect, it } from 'vitest'
import { Profile } from '@main/domain/entities/Profile'
import { DomainError } from '@main/domain/errors/DomainError'
import { ProfileId } from '@main/domain/value-objects/ProfileId'
import { ProfileName } from '@main/domain/value-objects/ProfileName'

const id = ProfileId.from('11111111-1111-4111-8111-111111111111')
const dirs = { desktopDataDir: '/d', cliConfigDir: '/c', imported: false }
const t0 = new Date('2026-01-01T00:00:00Z')

describe('Profile', () => {
  it('normaliza nome, cor e email', () => {
    const p = Profile.create(
      id,
      { name: '  Meu   Perfil ', color: '#AABBCC', email: ' A@B.com ' },
      dirs,
      t0,
    )
    expect(p.name.value).toBe('Meu Perfil')
    expect(p.color.value).toBe('#aabbcc')
    expect(p.email).toBe('a@b.com')
    expect(p.workingDir).toBeNull()
  })

  it('rejeita nome vazio, nome longo e cor inválida', () => {
    expect(() => Profile.create(id, { name: '  ', color: '#000000' }, dirs, t0)).toThrow(
      DomainError,
    )
    expect(() => Profile.create(id, { name: 'x'.repeat(41), color: '#000000' }, dirs, t0)).toThrow(
      DomainError,
    )
    expect(() => Profile.create(id, { name: 'ok', color: 'red' }, dirs, t0)).toThrow(DomainError)
  })

  it('update altera detalhes e updatedAt, preservando diretórios', () => {
    const p = Profile.create(id, { name: 'A', color: '#000000' }, dirs, t0)
    const t1 = new Date('2026-02-01T00:00:00Z')
    p.update({ name: 'B', color: '#ffffff', workingDir: '/work' }, t1)
    expect(p.name.value).toBe('B')
    expect(p.workingDir).toBe('/work')
    expect(p.updatedAt).toEqual(t1)
    expect(p.createdAt).toEqual(t0)
    expect(p.cliConfigDir).toBe('/c')
  })

  it('ProfileId rejeita valores que não são UUID', () => {
    expect(() => ProfileId.from('../../etc')).toThrow(DomainError)
  })

  it('ProfileName compara sem diferenciar maiúsculas', () => {
    expect(ProfileName.from('Pessoal').sameAs(ProfileName.from('pessoal'))).toBe(true)
    expect(ProfileName.from('Pessoal').sameAs(ProfileName.from('Trabalho'))).toBe(false)
  })
})
