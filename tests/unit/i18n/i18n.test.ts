import { describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { ErrorCodes } from '@shared/contracts/errors'
import { isLocale, resolveLocale, SupportedLocales } from '@shared/i18n/locales'
import { en } from '@shared/i18n/messages/en'
import { createTranslator, interpolate, messagesFor } from '@shared/i18n/translate'
import { LocaleState } from '@main/application/services/LocaleState'
import { DomainError } from '@main/domain/errors/DomainError'
import { toErrorPayload } from '@main/presentation/ipc/toErrorPayload'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

const translations = SupportedLocales.filter((locale) => locale !== 'en')
const keys = Object.keys(en) as (keyof typeof en)[]

describe.each(translations)('dicionário %s', (locale) => {
  const messages = messagesFor(locale)

  it('tem exatamente as mesmas chaves do inglês', () => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort())
  })

  it.each(keys)('%s usa os mesmos placeholders do inglês', (key) => {
    expect(placeholders(messages[key])).toEqual(placeholders(en[key]))
    expect(messages[key].trim()).not.toBe('')
  })
})

describe('translate', () => {
  it('interpola parâmetros e mantém placeholders desconhecidos', () => {
    expect(interpolate('Hi {name}, {x}', { name: 'Ana' })).toBe('Hi Ana, {x}')
  })

  it('traduz por idioma', () => {
    expect(createTranslator('en')('delete.title', { name: 'Work' })).toBe('Delete "Work"?')
    expect(createTranslator('pt-BR')('delete.title', { name: 'Work' })).toBe('Excluir "Work"?')
    expect(createTranslator('es')('delete.title', { name: 'Work' })).toBe('¿Eliminar "Work"?')
  })
})

describe('locales', () => {
  it('resolve o idioma do sistema', () => {
    expect(resolveLocale('pt-BR')).toBe('pt-BR')
    expect(resolveLocale('pt-PT')).toBe('pt-BR')
    expect(resolveLocale('en-US')).toBe('en')
    expect(resolveLocale('es')).toBe('es')
    expect(resolveLocale('es-MX')).toBe('es')
    expect(resolveLocale('es_AR')).toBe('es')
    expect(resolveLocale('fr')).toBe('en')
    expect(resolveLocale('estonian-like')).toBe('en')
    expect(resolveLocale(undefined)).toBe('en')
  })

  it('valida códigos suportados', () => {
    expect(isLocale('pt-BR')).toBe(true)
    expect(isLocale('es')).toBe(true)
    expect(isLocale('fr')).toBe(false)
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
