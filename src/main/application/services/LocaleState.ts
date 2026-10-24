import type { Locale } from '@shared/i18n/locales'
import { createTranslator, type Translate } from '@shared/i18n/translate'

/** Idioma atual do processo principal (mensagens de erro, bandeja e "Sobre"). */
export class LocaleState {
  private current: Locale
  private translate: Translate
  private readonly listeners = new Set<(locale: Locale) => void>()

  constructor(initial: Locale) {
    this.current = initial
    this.translate = createTranslator(initial)
  }

  get locale(): Locale {
    return this.current
  }

  readonly t: Translate = (key, params) => this.translate(key, params)

  set(locale: Locale): void {
    if (locale === this.current) return
    this.current = locale
    this.translate = createTranslator(locale)
    for (const listener of this.listeners) listener(locale)
  }

  onChange(listener: (locale: Locale) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
