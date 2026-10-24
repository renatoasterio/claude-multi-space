import type { Locale } from './locales'
import { en, type MessageKey, type Messages } from './messages/en'
import { es } from './messages/es'
import { ptBR } from './messages/pt-BR'

export type { MessageKey } from './messages/en'
export type MessageParams = Record<string, string | number>
export type Translate = (key: MessageKey, params?: MessageParams) => string

const catalogs: Record<Locale, Messages> = { en, 'pt-BR': ptBR, es }

/** Substitui {param}; placeholders sem valor ficam visíveis para facilitar a detecção. */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

export function createTranslator(locale: Locale): Translate {
  const messages = catalogs[locale]
  return (key, params) => interpolate(messages[key] ?? en[key], params)
}

export function messagesFor(locale: Locale): Messages {
  return catalogs[locale]
}
