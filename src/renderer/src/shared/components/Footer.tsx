import { Credits } from '@shared/contracts/credits'
import { useI18n } from '../i18n/I18nProvider'

/** Créditos de autoria exigidos pela licença do projeto. */
export function Footer() {
  const { t } = useI18n()
  return (
    <footer className="footer">
      {t('credits.createdBy')}{' '}
      <a href={Credits.authorUrl} target="_blank" rel="noreferrer">
        {Credits.author}
      </a>{' '}
      · {t('credits.license', { license: Credits.license })} ·{' '}
      <a href={Credits.repositoryUrl} target="_blank" rel="noreferrer">
        GitHub
      </a>
    </footer>
  )
}
