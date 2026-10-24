import { LocaleLabels, SupportedLocales, isLocale } from '@shared/i18n/locales'
import { useToast } from '../components/Toasts'
import { errorMessage } from '../utils/apiClient'
import { useI18n } from './I18nProvider'

export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n()
  const { notify } = useToast()

  return (
    <label className="language">
      <span className="sr-only">{t('app.language')}</span>
      <select
        aria-label={t('app.language')}
        value={locale}
        onChange={(event) => {
          const next = event.target.value
          if (isLocale(next)) setLocale(next).catch((e) => notify(errorMessage(e), 'error'))
        }}
      >
        {SupportedLocales.map((code) => (
          <option key={code} value={code}>
            {LocaleLabels[code]}
          </option>
        ))}
      </select>
    </label>
  )
}
