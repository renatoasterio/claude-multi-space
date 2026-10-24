import type { EnvironmentDTO } from '@shared/schemas/profile.schema'
import { useI18n } from '../../../shared/i18n/I18nProvider'

export function EnvironmentNotice({ environment }: { environment: EnvironmentDTO | null }) {
  const { t } = useI18n()
  if (!environment) return null
  const missing: string[] = []
  if (environment.platform === 'linux') missing.push(t('env.unsupported'))
  if (!environment.desktopExecutable) missing.push(t('env.noDesktop'))
  if (!environment.cliExecutable) missing.push(t('env.noCli'))
  if (!missing.length) return null
  return (
    <div className="notice" role="note">
      {missing.map((m) => (
        <p key={m}>{m}</p>
      ))}
    </div>
  )
}
