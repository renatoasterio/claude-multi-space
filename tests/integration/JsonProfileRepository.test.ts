import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Profile } from '@main/domain/entities/Profile'
import { ProfileId } from '@main/domain/value-objects/ProfileId'
import { JsonProfileRepository } from '@main/infrastructure/persistence/JsonProfileRepository'
import { nextUuid } from '../fakes'

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const tmp = () => mkdtempSync(path.join(tmpdir(), 'mc-repo-'))
const make = (name: string) =>
  Profile.create(
    ProfileId.from(nextUuid()),
    { name, color: '#000000' },
    { desktopDataDir: '/d', cliConfigDir: '/c', imported: false },
    new Date(),
  )

describe('JsonProfileRepository', () => {
  it('persiste e recarrega de outro processo (nova instância)', async () => {
    const file = path.join(tmp(), 'profiles.json')
    const repo = new JsonProfileRepository(file, logger)
    const p = make('A')
    await repo.save(p)

    const reloaded = new JsonProfileRepository(file, logger)
    expect((await reloaded.findById(p.id))?.name.value).toBe('A')
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
  })

  it('serializa escritas concorrentes sem perder dados nem deixar .tmp', async () => {
    const dir = tmp()
    const file = path.join(dir, 'profiles.json')
    const repo = new JsonProfileRepository(file, logger)
    await Promise.all(Array.from({ length: 25 }, (_, i) => repo.save(make(`P${i}`))))

    const onDisk = JSON.parse(readFileSync(file, 'utf8'))
    expect(onDisk.profiles).toHaveLength(25)
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('arquivo corrompido vira backup e a lista recomeça vazia', async () => {
    const dir = tmp()
    const file = path.join(dir, 'profiles.json')
    writeFileSync(file, '{ não é json')
    const repo = new JsonProfileRepository(file, logger)
    expect(await repo.findAll()).toEqual([])
    expect(readdirSync(dir).some((f) => f.startsWith('profiles.json.corrupted-'))).toBe(true)
    expect(logger.warn).toHaveBeenCalled()
  })

  it('delete remove do disco', async () => {
    const file = path.join(tmp(), 'profiles.json')
    const repo = new JsonProfileRepository(file, logger)
    const p = make('A')
    await repo.save(p)
    await repo.delete(p.id)
    expect(await new JsonProfileRepository(file, logger).findAll()).toEqual([])
  })
})
