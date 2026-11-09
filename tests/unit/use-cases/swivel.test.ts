import { describe, expect, it } from 'vitest'
import { ErrorCodes } from '@shared/contracts/errors'
import {
  ImportSwivelProfiles,
  ListSwivelProfiles,
} from '@main/application/use-cases/ImportSwivelProfiles'
import { FakeSwivelSource, makeContext } from '../../fakes'

const SNAP = '/Users/u/Library/Application Support/Swivel/profiles'

function setup() {
  const ctx = makeContext()
  const source = new FakeSwivelSource()
  source.profiles = [
    {
      name: 'ALBA',
      color: '#be3a3a',
      desktopDataDir: `${SNAP}/ALBA/Claude`,
      sizeBytes: 393e6,
      active: false,
    },
    {
      name: 'Pessoal',
      color: '#4a8659',
      desktopDataDir: `${SNAP}/Pessoal/Claude`,
      sizeBytes: 1.7e9,
      active: true,
    },
    {
      name: 'SemCor',
      color: null,
      desktopDataDir: `${SNAP}/SemCor/Claude`,
      sizeBytes: 10,
      active: false,
    },
  ]
  const list = new ListSwivelProfiles(source, ctx.repository)
  const importer = new ImportSwivelProfiles(
    source,
    list,
    ctx.createProfile,
    ctx.finder,
    ctx.repository,
  )
  return { ctx, source, list, importer }
}

describe('ListSwivelProfiles', () => {
  it('repassa disponibilidade e marca os já importados', async () => {
    const { ctx, list, importer } = setup()
    expect(await list.isAvailable()).toBe(true)
    await importer.execute(['ALBA'])
    const candidates = await list.execute()
    expect(candidates.map((c) => [c.name, c.alreadyImported])).toEqual([
      ['ALBA', true],
      ['Pessoal', false],
      ['SemCor', false],
    ])
    expect(ctx.workspace.cloned).toEqual([
      { from: `${SNAP}/ALBA/Claude`, to: expect.stringMatching(/\/desktop$/) },
    ])
  })

  it('Swivel ausente: lista vazia, sem erro', async () => {
    const { source, list } = setup()
    source.available = false
    expect(await list.isAvailable()).toBe(false)
    expect(await list.execute()).toEqual([])
  })
})

describe('ImportSwivelProfiles', () => {
  it('copia o snapshot e o ~/.claude (histórico do Code), mantém nome e cor e registra a origem', async () => {
    const { ctx, importer } = setup()
    const [view] = await importer.execute(['Pessoal'])
    expect(ctx.workspace.clonedCli).toEqual([
      { from: '/Users/u/.claude', to: expect.stringMatching(/\/cli$/) },
    ])
    expect(ctx.workspace.desktopStateFrom).toEqual(['/Users/u/Library/Application Support/Claude'])
    expect(view!.profile.name.value).toBe('Pessoal')
    expect(view!.profile.color.value).toBe('#4a8659')
    expect(view!.profile.importedFrom).toBe(`${SNAP}/Pessoal/Claude`)
    expect(view!.profile.imported).toBe(false) // o CLI continua próprio do perfil
    expect(view!.profile.cliConfigDir).toMatch(/\/cli$/)
  })

  it('sem cor no Swivel usa a paleta; nome repetido ganha sufixo', async () => {
    const { ctx, importer } = setup()
    await ctx.createProfile.execute({ name: 'SemCor', color: '#000000' })
    const [view] = await importer.execute(['SemCor'])
    expect(view!.profile.name.value).toBe('SemCor 2')
    expect(view!.profile.color.value).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('sem ~/.claude na máquina, importa só o Desktop e o cli/ nasce vazio', async () => {
    const { ctx, source, importer } = setup()
    source.cliConfigDir = null
    await importer.execute(['ALBA'])
    expect(ctx.workspace.cloned).toHaveLength(1)
    expect(ctx.workspace.clonedCli).toEqual([])
  })

  it('recusa nomes que não vieram do Swivel', async () => {
    const { importer } = setup()
    await expect(importer.execute(['../../etc'])).rejects.toMatchObject({
      code: ErrorCodes.Validation,
    })
  })

  it('permite reimportar: cria um segundo perfil a partir do mesmo snapshot', async () => {
    const { ctx, importer } = setup()
    await importer.execute(['ALBA'])
    const [again] = await importer.execute(['ALBA'])
    expect(again!.profile.name.value).toBe('ALBA 2')
    expect(ctx.workspace.cloned).toHaveLength(2)
  })
})
