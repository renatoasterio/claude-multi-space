import { useState, type FormEvent } from 'react'
import { ProfileColorPresets, ProfileConstraints } from '@shared/schemas/profile.constraints'
import {
  ProfileInputSchema,
  type ProfileDTO,
  type ProfileInput,
} from '@shared/schemas/profile.schema'
import { Button } from '../../../shared/components/Button'
import { Dialog } from '../../../shared/components/Dialog'
import { useI18n } from '../../../shared/i18n/I18nProvider'
import { errorMessage } from '../../../shared/utils/apiClient'
import { profilesService } from '../services/profilesService'
import { ColorPicker } from './ColorPicker'

/** Montado apenas enquanto aberto; o pai usa `key` para reiniciar o estado entre aberturas. */
interface ProfileFormDialogProps {
  /** Perfil em edição; null = criação. */
  profile: ProfileDTO | null
  suggestedColor: string
  onClose: () => void
  onSubmit: (input: ProfileInput) => Promise<void>
}

const toForm = (profile: ProfileDTO | null, color: string) => ({
  name: profile?.name ?? '',
  color: profile?.color ?? color,
  email: profile?.email ?? '',
  workingDir: profile?.workingDir ?? '',
})

export function ProfileFormDialog({
  profile,
  suggestedColor,
  onClose,
  onSubmit,
}: ProfileFormDialogProps) {
  const { t } = useI18n()
  const [form, setForm] = useState(() => toForm(profile, suggestedColor))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }))

  const pickDirectory = async () => {
    try {
      const dir = await profilesService.pickDirectory()
      if (dir) update({ workingDir: dir })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    // Mesmo schema usado no main: feedback imediato, validação definitiva continua no main.
    const parsed = ProfileInputSchema.safeParse(form)
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0]
      setError(t(field === 'email' ? 'form.invalidEmail' : 'form.invalidFields'))
      return
    }
    setSaving(true)
    try {
      await onSubmit(parsed.data)
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
      title={t(profile ? 'form.titleEdit' : 'form.titleNew')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('form.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="profile-form" busy={saving}>
            {t(profile ? 'form.save' : 'form.create')}
          </Button>
        </>
      }
    >
      <form id="profile-form" className="form" onSubmit={submit} noValidate>
        <label>
          {t('form.name')}
          <input
            autoFocus
            required
            maxLength={ProfileConstraints.nameMaxLength}
            value={form.name}
            placeholder={t('form.namePlaceholder')}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <label>
          {t('form.email')}
          <input
            type="email"
            maxLength={ProfileConstraints.emailMaxLength}
            value={form.email}
            placeholder={t('form.emailPlaceholder')}
            onChange={(e) => update({ email: e.target.value })}
          />
          <small className="muted">{t('form.emailHint')}</small>
        </label>
        <label>
          {t('form.workingDir')}
          <div className="input-row">
            <input
              value={form.workingDir}
              placeholder={t('form.workingDirPlaceholder')}
              onChange={(e) => update({ workingDir: e.target.value })}
            />
            <Button onClick={pickDirectory}>{t('form.choose')}</Button>
          </div>
        </label>
        <fieldset>
          <legend>{t('form.color')}</legend>
          <ColorPicker value={form.color} onChange={(color) => update({ color })} />
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

export const defaultColorFor = (count: number) =>
  ProfileColorPresets[count % ProfileColorPresets.length]!
