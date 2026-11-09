import { useEffect, useState } from 'react'
import type { ImportCandidateDTO, SwivelProfileDTO } from '@shared/schemas/profile.schema'
import { tildify } from '@shared/utils/tildify'
import { Button } from '../../../shared/components/Button'
import { Dialog } from '../../../shared/components/Dialog'
import { ProfileIcon } from '../../../shared/components/ProfileIcon'
import { useI18n } from '../../../shared/i18n/I18nProvider'
import { errorMessage } from '../../../shared/utils/apiClient'
import { formatBytes } from '../../../shared/utils/format'
import { cx } from '../../../shared/utils/text'
import { profilesService } from '../services/profilesService'

export type ImportSource = 'cli' | 'swivel'

/** Montado apenas enquanto aberto: cada abertura busca candidatos novos. */
interface ImportDialogProps {
  homeDir: string | undefined
  /** Mostra a aba do Swivel (só quando ele está instalado). */
  swivelAvailable: boolean
  onClose: () => void
  onImport: (source: ImportSource, keys: string[]) => Promise<void>
}

export function ImportDialog({ homeDir, swivelAvailable, onClose, onImport }: ImportDialogProps) {
  const { t, locale } = useI18n()
  const [source, setSource] = useState<ImportSource>(swivelAvailable ? 'swivel' : 'cli')
  const [cli, setCli] = useState<ImportCandidateDTO[] | null>(null)
  const [swivel, setSwivel] = useState<SwivelProfileDTO[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      const [cliList, swivelList] = await Promise.all([
        profilesService.importCandidates(),
        swivelAvailable ? profilesService.swivelProfiles() : Promise.resolve([]),
      ])
      if (!active) return
      setCli(cliList)
      setSwivel(swivelList)
      // Pré-seleciona o que ainda não foi importado na aba inicial.
      const initial = swivelAvailable
        ? swivelList.filter((p) => !p.alreadyImported).map((p) => p.name)
        : cliList.map((c) => c.path)
      setSelected(new Set(initial))
    }
    load().catch((e) => active && setError(errorMessage(e)))
    return () => {
      active = false
    }
  }, [swivelAvailable])

  const switchSource = (next: ImportSource) => {
    if (next === source) return
    setSource(next)
    setError(null)
    setSelected(
      new Set(
        next === 'swivel'
          ? (swivel ?? []).filter((p) => !p.alreadyImported).map((p) => p.name)
          : (cli ?? []).map((c) => c.path),
      ),
    )
  }

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const submit = async () => {
    setSaving(true)
    try {
      await onImport(source, [...selected])
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const loading = cli === null || swivel === null

  return (
    <Dialog
      open
      title={t('import.title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('form.cancel')}
          </Button>
          <Button variant="primary" busy={saving} disabled={!selected.size} onClick={submit}>
            {t('import.submit', { count: selected.size || '' }).trim()}
          </Button>
        </>
      }
    >
      {swivelAvailable && (
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={source === 'swivel'}
            className={cx('tab', source === 'swivel' && 'is-active')}
            onClick={() => switchSource('swivel')}
          >
            {t('import.tabSwivel')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === 'cli'}
            className={cx('tab', source === 'cli' && 'is-active')}
            onClick={() => switchSource('cli')}
          >
            {t('import.tabCli')}
          </button>
        </div>
      )}

      {source === 'swivel' ? (
        <>
          <p className="muted">{t('import.swivelBody')}</p>
          {loading && !error && <p className="muted">{t('import.searching')}</p>}
          {swivel?.length === 0 && <p>{t('import.swivelNone')}</p>}
          <ul className="checklist">
            {swivel?.map((p) => (
              <li key={p.name}>
                <label className={cx(p.alreadyImported && 'is-muted')}>
                  <input
                    type="checkbox"
                    checked={selected.has(p.name)}
                    onChange={() => toggle(p.name)}
                  />
                  <ProfileIcon color={p.color ?? '#9a9a9a'} size={22} />
                  <span className="checklist-main">
                    <strong>{p.name}</strong>
                    {p.active && <span className="badge badge-ok">{t('import.swivelActive')}</span>}
                    {p.alreadyImported && (
                      <span className="badge">{t('import.swivelImported')}</span>
                    )}
                    <small className="muted">
                      {t('import.swivelSize', { size: formatBytes(p.sizeBytes, locale) })}
                    </small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="muted">{t('import.body', { pattern: '~/.claude-*' })}</p>
          {loading && !error && <p className="muted">{t('import.searching')}</p>}
          {cli?.length === 0 && <p>{t('import.none')}</p>}
          <ul className="checklist">
            {cli?.map((c) => (
              <li key={c.path}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(c.path)}
                    onChange={() => toggle(c.path)}
                  />
                  <strong>{c.suggestedName}</strong>{' '}
                  <code title={c.path}>{tildify(c.path, homeDir)}</code>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  )
}
