export const SupportedLocales = ['en', 'pt-BR', 'es'] as const

export type Locale = (typeof SupportedLocales)[number]

export const DefaultLocale: Locale = 'en'

/** Nome de cada idioma no próprio idioma (exibido no seletor). */
export const LocaleLabels: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  es: 'Español',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SupportedLocales as readonly string[]).includes(value)
}

/** Mapeia o idioma do sistema ("pt-PT", "es-MX", "en-US"...) para um idioma suportado. */
export function resolveLocale(systemLocale: string | undefined): Locale {
  const language = systemLocale?.toLowerCase().split(/[-_]/)[0]
  if (language === 'pt') return 'pt-BR'
  if (language === 'es') return 'es'
  return DefaultLocale
}
