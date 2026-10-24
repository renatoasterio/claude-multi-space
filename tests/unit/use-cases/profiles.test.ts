import { describe, expect, it } from 'vitest'
import { ErrorCodes } from '@shared/contracts/errors'
import { CreateShortcut } from '@main/application/use-cases/CreateShortcut'
import { BuildLaunchCommand } from '@main/application/use-cases/BuildLaunchCommand'
import { DeleteProfile } from '@main/application/use-cases/DeleteProfile'
import { ImportProfiles, ListImportCandidates } from '@main/application/use-cases/ImportProfiles'
import { LaunchCli } from '@main/application/use-cases/LaunchCli'
import { LaunchDesktop } from '@main/application/use-cases/LaunchDesktop'
import { ListProfiles } from '@main/application/use-cases/ListProfiles'
import { UpdateProfile } from '@main/application/use-cases/UpdateProfile'
import { makeContext } from '../../fakes'

const input = (name: string) => ({ name, color: '#d97757' })

describe('CreateProfile / ListProfiles', () => {
  it('cria perfil com diretórios isolados e status inicial', async () => {
    const ctx = makeContext()
    const view = await ctx.createProfile.execute({ ...input('Pessoal'), email: 'eu@x.com' })
    expect(view.profile.desktopDataDir).toMatch(/\/desktop$/)
    expect(view.profile.cliConfigDir).toMatch(/\/cli$/)
    expect(view.status).toEqual({
      desktopRunning: false,
      desktopInitialized: false,
      cliInitialized: false,
      hasShortcut: false,
    })

    const list = await new ListProfiles(ctx.repository, ctx.status).execute()
    expect(list.map((v) => v.profile.name.value)).toEqual(['Pessoal'])
  })

  it('impede nomes duplicados (case-insensitive)', async () => {
    const ctx = makeContext()
    await ctx.createProfile.execute(input('Pessoal'))
    await expect(ctx.createProfile.execute(input('pessoal'))).rejects.toMatchObject({
      code: ErrorCodes.Conflict,
    })
  })
})

describe('UpdateProfile', () => {
  it('permite manter o próprio nome e bloqueia nome de outro perfil', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    await ctx.createProfile.execute(input('B'))
    const update = new UpdateProfile(
      ctx.repository,
      ctx.finder,
      ctx.status,
      ctx.clock,
      ctx.shortcuts,
    )

    await expect(
      update.execute(a.profile.id.value, { ...input('A'), color: '#000000' }),
    ).resolves.toBeDefined()
    await expect(update.execute(a.profile.id.value, input('b'))).rejects.toMatchObject({
      code: ErrorCodes.Conflict,
    })
  })

  it('retorna NOT_FOUND para id inexistente', async () => {
    const ctx = makeContext()
    const update = new UpdateProfile(
      ctx.repository,
      ctx.finder,
      ctx.status,
      ctx.clock,
      ctx.shortcuts,
    )
    await expect(
      update.execute('99999999-9999-4999-8999-999999999999', input('X')),
    ).rejects.toMatchObject({
      code: ErrorCodes.NotFound,
    })
  })
})

describe('DeleteProfile', () => {
  it('apaga dados apenas quando solicitado', async () => {
    const ctx = makeContext()
    const del = new DeleteProfile(
      ctx.repository,
      ctx.workspace,
      ctx.finder,
      ctx.status,
      ctx.shortcuts,
    )
    const a = await ctx.createProfile.execute(input('A'))
    const b = await ctx.createProfile.execute(input('B'))

    await del.execute(a.profile.id.value, false)
    await del.execute(b.profile.id.value, true)
    expect(ctx.workspace.removed).toEqual([b.profile.id.value])
    expect(ctx.repository.records.size).toBe(0)
  })

  it('recusa apagar dados com o Desktop do perfil aberto', async () => {
    const ctx = makeContext()
    const del = new DeleteProfile(
      ctx.repository,
      ctx.workspace,
      ctx.finder,
      ctx.status,
      ctx.shortcuts,
    )
    const a = await ctx.createProfile.execute(input('A'))
    ctx.desktop.running.add(a.profile.id.value)
    await expect(del.execute(a.profile.id.value, true)).rejects.toMatchObject({
      code: ErrorCodes.Conflict,
    })
    expect(ctx.repository.records.size).toBe(1)
  })
})

describe('LaunchDesktop / LaunchCli', () => {
  it('rastreia o processo do Desktop até ele encerrar', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    await new LaunchDesktop(ctx.finder, ctx.desktop, ctx.registry).execute(a.profile.id.value)

    expect((await ctx.status.read(a.profile)).status.desktopRunning).toBe(true)
    ctx.desktop.launched[0]!.exit()
    expect((await ctx.status.read(a.profile)).status.desktopRunning).toBe(false)
  })

  it('falha com NOT_INSTALLED quando o executável não existe', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    ctx.desktop.executable = null
    ctx.cli.executable = null
    await expect(
      new LaunchDesktop(ctx.finder, ctx.desktop, ctx.registry).execute(a.profile.id.value),
    ).rejects.toMatchObject({
      code: ErrorCodes.NotInstalled,
    })
    await expect(
      new LaunchCli(ctx.finder, ctx.cli).execute(a.profile.id.value),
    ).rejects.toMatchObject({
      code: ErrorCodes.NotInstalled,
    })
  })

  it('abre o terminal do perfil', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    await new LaunchCli(ctx.finder, ctx.cli).execute(a.profile.id.value)
    expect(ctx.cli.opened).toEqual([a.profile.id.value])
  })
})

describe('LaunchDesktop: uma instância por perfil', () => {
  it('segundo clique foca a janela existente em vez de abrir outra', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    const launch = new LaunchDesktop(ctx.finder, ctx.desktop, ctx.registry)

    expect(await launch.execute(a.profile.id.value)).toBe('launched')
    expect(await launch.execute(a.profile.id.value)).toBe('focused')
    expect(ctx.desktop.launched).toHaveLength(1)
    expect(ctx.desktop.focused).toEqual([a.profile.id.value])
  })

  it('instância aberta fora do app também é focada, não duplicada', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    ctx.desktop.running.add(a.profile.id.value)
    const launch = new LaunchDesktop(ctx.finder, ctx.desktop, ctx.registry)

    expect(await launch.execute(a.profile.id.value)).toBe('focused')
    expect(ctx.desktop.launched).toHaveLength(0)
  })

  it('cliques simultâneos abrem uma única instância', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    const launch = new LaunchDesktop(ctx.finder, ctx.desktop, ctx.registry)

    const results = await Promise.all([1, 2, 3].map(() => launch.execute(a.profile.id.value)))
    expect(results).toEqual(['launched', 'launched', 'launched'])
    expect(ctx.desktop.launched).toHaveLength(1)
  })

  it('perfis diferentes abrem instâncias próprias', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    const b = await ctx.createProfile.execute(input('B'))
    const launch = new LaunchDesktop(ctx.finder, ctx.desktop, ctx.registry)

    await Promise.all([launch.execute(a.profile.id.value), launch.execute(b.profile.id.value)])
    expect(ctx.desktop.launched).toHaveLength(2)
  })
})

describe('BuildLaunchCommand', () => {
  it('usa o executável resolvido e o diretório do perfil', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('Trabalho'))
    const cmd = await new BuildLaunchCommand(ctx.finder, ctx.cli).execute(
      a.profile.id.value,
      'posix',
    )
    expect(cmd).toContain('claude-trabalho()')
    expect(cmd).toContain(a.profile.cliConfigDir)
    expect(cmd).toContain('/usr/local/bin/claude')
  })
})

describe('ImportProfiles', () => {
  const setup = () => {
    const ctx = makeContext()
    ctx.workspace.candidates = [
      { path: '/home/u/.claude-cliente', suggestedName: 'Cliente' },
      { path: '/home/u/.claude-personal', suggestedName: 'Personal' },
    ]
    const list = new ListImportCandidates(ctx.repository, ctx.workspace)
    const importer = new ImportProfiles(list, ctx.createProfile, ctx.finder, ctx.repository)
    return { ctx, list, importer }
  }

  it('importa reaproveitando o diretório do CLI e evita nomes repetidos', async () => {
    const { ctx, list, importer } = setup()
    await ctx.createProfile.execute(input('Cliente'))
    const created = await importer.execute(['/home/u/.claude-cliente'])

    expect(created[0]!.profile.cliConfigDir).toBe('/home/u/.claude-cliente')
    expect(created[0]!.profile.imported).toBe(true)
    expect(created[0]!.profile.name.value).toBe('Cliente 2')
    expect((await list.execute()).map((c) => c.path)).toEqual(['/home/u/.claude-personal'])
  })

  it('recusa caminhos que não foram descobertos pelo app', async () => {
    const { importer } = setup()
    await expect(importer.execute(['/etc'])).rejects.toMatchObject({ code: ErrorCodes.Validation })
  })
})

describe('Atalhos por perfil', () => {
  it('cria o atalho e o status passa a indicar que existe', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    const file = await new CreateShortcut(ctx.finder, ctx.shortcuts).execute(a.profile.id.value)
    expect(file).toContain('A-#d97757')
    expect((await ctx.status.read(a.profile)).status.hasShortcut).toBe(true)
  })

  it('editar nome/cor recria o atalho existente; sem atalho, nada é criado', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    const b = await ctx.createProfile.execute(input('B'))
    const update = new UpdateProfile(
      ctx.repository,
      ctx.finder,
      ctx.status,
      ctx.clock,
      ctx.shortcuts,
    )
    await new CreateShortcut(ctx.finder, ctx.shortcuts).execute(a.profile.id.value)

    await update.execute(a.profile.id.value, { name: 'A2', color: '#6a9bcc' })
    await update.execute(b.profile.id.value, { name: 'B2', color: '#6a9bcc' })
    expect(ctx.shortcuts.created.get(a.profile.id.value)).toContain('A2-#6a9bcc')
    expect(ctx.shortcuts.created.has(b.profile.id.value)).toBe(false)
  })

  it('excluir o perfil remove o atalho', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    await new CreateShortcut(ctx.finder, ctx.shortcuts).execute(a.profile.id.value)
    await new DeleteProfile(
      ctx.repository,
      ctx.workspace,
      ctx.finder,
      ctx.status,
      ctx.shortcuts,
    ).execute(a.profile.id.value, false)
    expect(ctx.shortcuts.removed).toEqual([a.profile.id.value])
  })

  it('plataforma sem suporte retorna erro claro', async () => {
    const ctx = makeContext()
    const a = await ctx.createProfile.execute(input('A'))
    ctx.shortcuts.supported = false
    await expect(
      new CreateShortcut(ctx.finder, ctx.shortcuts).execute(a.profile.id.value),
    ).rejects.toMatchObject({
      code: ErrorCodes.UnsupportedPlatform,
    })
  })
})
