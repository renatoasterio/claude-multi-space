import { useEffect, useState } from 'react'
import type { ImportCandidateDTO } from '@shared/schemas/profile.schema'
import { tildify } from '@shared/utils/tildify'
import { Button } from '../../../shared/components/Button'
import { Dialog } from '../../../shared/components/Dialog'
import { useI18n } from '../../../shared/i18n/I18nProvider'
import { errorMessage } from '../../../shared/utils/apiClient'
import { profilesService } from '../services/profilesService'

/** Montado apenas enquanto aberto: cada abertura busca candidatos novos. */
interface ImportDialogProps {
  homeDir: string | undefined
  onClose: () => void
  onImport: (paths: string[]) => Promise<void>
}

export function ImportDialog({ homeDir, onClose, onImport }: ImportDialogProps) {
  const { t } = useI18n()
  const [candidates, setCandidates] = useState<ImportCandidateDTO[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    profilesService
      .importCandidates()
      .then((list) => {
        if (!active) return
        setCandidates(list)
        setSelected(new Set(list.map((c) => c.path)))
      })
      .catch((e) => active && setError(errorMessage(e)))
    return () => {
      active = false
    }
  }, [])

  const toggle = (path: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const submit = async () => {
    setSaving(true)
    try {
      await onImport([...selected])
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

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
      <p className="muted">{t('import.body', { pattern: '~/.claude-*' })}</p>
      {!candidates && !error && <p className="muted">{t('import.searching')}</p>}
      {candidates?.length === 0 && <p>{t('import.none')}</p>}
      <ul className="checklist">
        {candidates?.map((c) => (
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
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  )
}
