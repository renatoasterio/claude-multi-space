import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { JsonSettingsStore } from '@main/infrastructure/persistence/JsonSettingsStore'

const file = () => path.join(mkdtempSync(path.join(tmpdir(), 'mc-settings-')), 'settings.json')

describe('JsonSettingsStore', () => {
  it('usa o idioma do sistema na primeira execução', async () => {
    expect(await new JsonSettingsStore(file(), () => 'pt-BR').get()).toEqual({ language: 'pt-BR' })
  })

  it('persiste a escolha do usuário', async () => {
    const f = file()
    await new JsonSettingsStore(f, () => 'en').update({ language: 'pt-BR' })
    expect(await new JsonSettingsStore(f, () => 'en').get()).toEqual({ language: 'pt-BR' })
  })

  it('ignora arquivo inválido ou idioma não suportado', async () => {
    const f = file()
    writeFileSync(f, JSON.stringify({ version: 1, language: 'xx' }))
    expect(await new JsonSettingsStore(f, () => 'en').get()).toEqual({ language: 'en' })
  })
})
