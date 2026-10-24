import { memo } from 'react'
import type { MessageKey } from '@shared/i18n/translate'
import type { ProfileDTO, ShellKind } from '@shared/schemas/profile.schema'
import { Button } from '../../../shared/components/Button'
import { tildify } from '@shared/utils/tildify'
import { initials } from '../../../shared/utils/text'
import { useI18n } from '../../../shared/i18n/I18nProvider'

export interface ProfileCardActions {
  onLaunchDesktop(profile: ProfileDTO): void
  onLaunchCli(profile: ProfileDTO): void
  onCopyCommand(profile: ProfileDTO, shell: ShellKind): void
  onEdit(profile: ProfileDTO): void
  onDelete(profile: ProfileDTO): void
}

interface ProfileCardProps extends ProfileCardActions {
  profile: ProfileDTO
  shell: ShellKind
  homeDir: string | undefined
  isBusy: (key: string) => boolean
}

function statusOf(profile: ProfileDTO): { key: MessageKey; tone: 'on' | 'ok' | 'new' } {
  if (profile.status.desktopRunning) return { key: 'status.running', tone: 'on' }
  if (profile.status.desktopInitialized || profile.status.cliInitialized)
    return { key: 'status.configured', tone: 'ok' }
  return { key: 'status.new', tone: 'new' }
}

export const ProfileCard = memo(function ProfileCard({
  profile,
  shell,
  homeDir,
  isBusy,
  ...actions
}: ProfileCardProps) {
  const { t } = useI18n()
  const status = statusOf(profile)
  return (
    <article className="card" style={{ '--accent': profile.color } as React.CSSProperties}>
      <div className="card-head">
        <span className="avatar" aria-hidden>
          {initials(profile.name)}
        </span>
        <div className="card-title">
          <h3>{profile.name}</h3>
          <p className="muted">{profile.email ?? t('card.noEmail')}</p>
        </div>
        <span className={`badge badge-${status.tone}`}>{t(status.key)}</span>
      </div>

      <dl className="card-meta">
        <div>
          <dt>{t('card.cli')}</dt>
          <dd title={profile.cliConfigDir}>
            {profile.imported ? `${t('card.imported')} · ` : ''}
            {tildify(profile.cliConfigDir, homeDir)}
          </dd>
        </div>
        {profile.workingDir && (
          <div>
            <dt>{t('card.folder')}</dt>
            <dd title={profile.workingDir}>{tildify(profile.workingDir, homeDir)}</dd>
          </div>
        )}
      </dl>

      <div className="card-actions">
        <Button
          variant="primary"
          busy={isBusy(`desktop:${profile.id}`)}
          onClick={() => actions.onLaunchDesktop(profile)}
        >
          {t('card.openDesktop')}
        </Button>
        <Button busy={isBusy(`cli:${profile.id}`)} onClick={() => actions.onLaunchCli(profile)}>
          {t('card.openCli')}
        </Button>
        <div className="card-tools">
          <Button
            variant="ghost"
            title={t('card.copyCommandHint')}
            onClick={() => actions.onCopyCommand(profile, shell)}
          >
            {t('card.copyCommand')}
          </Button>
          <Button variant="ghost" onClick={() => actions.onEdit(profile)}>
            {t('card.edit')}
          </Button>
          <Button variant="ghost" className="danger-text" onClick={() => actions.onDelete(profile)}>
            {t('card.delete')}
          </Button>
        </div>
      </div>
    </article>
  )
})
