import { useState } from 'react'
import type { ProfileDTO } from '@shared/schemas/profile.schema'
import { tildify } from '@shared/utils/tildify'
import { Button } from '../../../shared/components/Button'
import { Dialog } from '../../../shared/components/Dialog'
import { useI18n } from '../../../shared/i18n/I18nProvider'
import { errorMessage } from '../../../shared/utils/apiClient'

/** Montado apenas enquanto aberto (key = id do perfil no pai). */
interface DeleteDialogProps {
  profile: ProfileDTO
  homeDir: string | undefined
  onClose: () => void
  onConfirm: (profile: ProfileDTO, removeData: boolean) => Promise<void>
}

export function DeleteDialog({ profile, homeDir, onClose, onConfirm }: DeleteDialogProps) {
  const { t } = useI18n()
  const [removeData, setRemoveData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    setSaving(true)
    try {
      await onConfirm(profile, removeData)
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
      title={t('delete.title', { name: profile.name })}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('form.cancel')}
          </Button>
          <Button variant="danger" busy={saving} onClick={confirm}>
            {t('delete.confirm')}
          </Button>
        </>
      }
    >
      <label className="check">
        <input
          type="checkbox"
          checked={removeData}
          onChange={(e) => setRemoveData(e.target.checked)}
        />
        {t('delete.removeData')}
      </label>
      {profile.imported && (
        <p className="muted">
          {t('delete.keepsImported', { path: tildify(profile.cliConfigDir, homeDir) })}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  )
}
