export const SupportedLocales = ['en', 'pt-BR'] as const

export type Locale = (typeof SupportedLocales)[number]

export const DefaultLocale: Locale = 'en'

/** Nome de cada idioma no próprio idioma (exibido no seletor). */
export const LocaleLabels: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SupportedLocales as readonly string[]).includes(value)
}

/** Mapeia o idioma do sistema ("pt", "pt-PT", "en-US"...) para um idioma suportado. */
export function resolveLocale(systemLocale: string | undefined): Locale {
  return systemLocale?.toLowerCase().startsWith('pt') ? 'pt-BR' : DefaultLocale
}
