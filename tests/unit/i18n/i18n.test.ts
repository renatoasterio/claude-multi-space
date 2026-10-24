import { describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { ErrorCodes } from '@shared/contracts/errors'
import { isLocale, resolveLocale } from '@shared/i18n/locales'
import { en } from '@shared/i18n/messages/en'
import { ptBR } from '@shared/i18n/messages/pt-BR'
import { createTranslator, interpolate } from '@shared/i18n/translate'
import { LocaleState } from '@main/application/services/LocaleState'
import { DomainError } from '@main/domain/errors/DomainError'
import { toErrorPayload } from '@main/presentation/ipc/toErrorPayload'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('dicionários', () => {
  it('pt-BR tem exatamente as mesmas chaves do inglês', () => {
    expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort())
  })

  it.each(Object.keys(en) as (keyof typeof en)[])(
    '%s usa os mesmos placeholders nos dois idiomas',
    (key) => {
      expect(placeholders(ptBR[key])).toEqual(placeholders(en[key]))
      expect(ptBR[key].trim()).not.toBe('')
    },
  )
})

describe('translate', () => {
  it('interpola parâmetros e mantém placeholders desconhecidos', () => {
    expect(interpolate('Hi {name}, {x}', { name: 'Ana' })).toBe('Hi Ana, {x}')
  })

  it('traduz por idioma', () => {
    expect(createTranslator('en')('delete.title', { name: 'Work' })).toBe('Delete "Work"?')
    expect(createTranslator('pt-BR')('delete.title', { name: 'Work' })).toBe('Excluir "Work"?')
  })
})

describe('locales', () => {
  it('resolve o idioma do sistema', () => {
    expect(resolveLocale('pt-BR')).toBe('pt-BR')
    expect(resolveLocale('pt-PT')).toBe('pt-BR')
    expect(resolveLocale('en-US')).toBe('en')
    expect(resolveLocale('fr')).toBe('en')
    expect(resolveLocale(undefined)).toBe('en')
  })

  it('valida códigos suportados', () => {
    expect(isLocale('pt-BR')).toBe(true)
    expect(isLocale('es')).toBe(false)
    expect(isLocale(1)).toBe(false)
  })
})

describe('LocaleState', () => {
  it('troca o idioma e notifica apenas quando muda', () => {
    const state = new LocaleState('en')
    const listener = vi.fn()
    const off = state.onChange(listener)
    state.set('en')
    state.set('pt-BR')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(state.t('tray.quit')).toBe('Sair')
    off()
    state.set('en')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('toErrorPayload', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  it('traduz erros de domínio no idioma atual', () => {
    const error = DomainError.conflict('errors.nameTaken', { name: 'Work' })
    expect(toErrorPayload(error, logger, 'c', createTranslator('en'))).toEqual({
      code: ErrorCodes.Conflict,
      message: 'A profile named "Work" already exists.',
    })
    expect(toErrorPayload(error, logger, 'c', createTranslator('pt-BR')).message).toBe(
      'Já existe um perfil chamado "Work".',
    )
  })

  it('erros de validação citam só os campos, e erros inesperados não vazam detalhes', () => {
    const zod = new ZodError([{ code: 'custom', path: ['name'], message: 'x', input: '' }])
    expect(toErrorPayload(zod, logger, 'c', createTranslator('en')).message).toBe(
      'Invalid data. (name)',
    )

    const payload = toErrorPayload(
      new Error('segredo interno'),
      logger,
      'c',
      createTranslator('en'),
    )
    expect(payload).toEqual({
      code: ErrorCodes.Internal,
      message: 'Unexpected error. Check the app logs.',
    })
    expect(logger.error).toHaveBeenCalled()
  })
})
