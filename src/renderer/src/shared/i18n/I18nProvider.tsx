import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { resolveLocale, type Locale } from '@shared/i18n/locales'
import { createTranslator, type Translate } from '@shared/i18n/translate'
import { unwrap } from '../utils/apiClient'

interface I18nValue {
  locale: Locale
  t: Translate
  setLocale(locale: Locale): Promise<void>
}

const I18nContext = createContext<I18nValue | null>(null)

/**
 * Idioma da interface. A preferência fica no processo principal (vale também para bandeja e erros);
 * até ela chegar, nada é renderizado para evitar piscar no idioma errado.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale | null>(null)

  useEffect(() => {
    let active = true
    unwrap(window.api.getSettings())
      .then((settings) => active && setLocaleState(settings.language))
      .catch(() => active && setLocaleState(resolveLocale(navigator.language)))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (locale) document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback(async (next: Locale) => {
    const settings = await unwrap(window.api.setLanguage(next))
    setLocaleState(settings.language)
  }, [])

  const value = useMemo<I18nValue | null>(
    () => (locale ? { locale, t: createTranslator(locale), setLocale } : null),
    [locale, setLocale],
  )

  if (!value) return null
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n precisa de <I18nProvider>.')
  return context
}
