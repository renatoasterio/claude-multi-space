import { useCallback, useMemo, useState } from 'react'
import { Credits } from '@shared/contracts/credits'
import type { ProfileDTO, ProfileInput, ShellKind } from '@shared/schemas/profile.schema'
import { Button } from '../../shared/components/Button'
import { Footer } from '../../shared/components/Footer'
import { useToast } from '../../shared/components/Toasts'
import { useI18n } from '../../shared/i18n/I18nProvider'
import { LanguageSelect } from '../../shared/i18n/LanguageSelect'
import { errorMessage } from '../../shared/utils/apiClient'
import { DeleteDialog } from './components/DeleteDialog'
import { EnvironmentNotice } from './components/EnvironmentNotice'
import { ImportDialog } from './components/ImportDialog'
import { ProfileCard } from './components/ProfileCard'
import { defaultColorFor, ProfileFormDialog } from './components/ProfileFormDialog'
import { useBusy } from './hooks/useBusy'
import { useEnvironment } from './hooks/useEnvironment'
import { useProfiles } from './hooks/useProfiles'
import { profilesService } from './services/profilesService'

type FormState = { open: false } | { open: true; profile: ProfileDTO | null }

export function ProfilesPage() {
  const { t } = useI18n()
  const { profiles, loading, error, reload } = useProfiles()
  const environment = useEnvironment()
  const { run, isBusy } = useBusy()
  const { notify } = useToast()
  const [form, setForm] = useState<FormState>({ open: false })
  const [importOpen, setImportOpen] = useState(false)
  const [deleting, setDeleting] = useState<ProfileDTO | null>(null)

  const shell: ShellKind = environment?.platform === 'win32' ? 'powershell' : 'posix'
  const homeDir = environment?.homeDir
  const suggestedColor = useMemo(() => defaultColorFor(profiles.length), [profiles.length])

  const attempt = useCallback(
    async (key: string, task: () => Promise<unknown>, success?: string) => {
      try {
        await run(key, task)
        if (success) notify(success)
      } catch (e) {
        notify(errorMessage(e), 'error')
      } finally {
        void reload()
      }
    },
    [run, notify, reload],
  )

  const actions = useMemo(
    () => ({
      onLaunchDesktop: (p: ProfileDTO) =>
        attempt(
          `desktop:${p.id}`,
          () => profilesService.launchDesktop(p.id),
          t('toast.openingDesktop', { name: p.name }),
        ),
      onLaunchCli: (p: ProfileDTO) =>
        attempt(
          `cli:${p.id}`,
          () => profilesService.launchCli(p.id),
          t('toast.openingCli', { name: p.name }),
        ),
      onCopyCommand: (p: ProfileDTO, kind: ShellKind) =>
        attempt(
          `copy:${p.id}`,
          () => profilesService.copyCommand(p.id, kind),
          t(kind === 'posix' ? 'toast.copiedPosix' : 'toast.copiedPowerShell'),
        ),
      onEdit: (p: ProfileDTO) => setForm({ open: true, profile: p }),
      onDelete: (p: ProfileDTO) => setDeleting(p),
    }),
    [attempt, t],
  )

  const closeForm = useCallback(() => setForm({ open: false }), [])
  const closeImport = useCallback(() => setImportOpen(false), [])
  const closeDelete = useCallback(() => setDeleting(null), [])

  const submitForm = async (input: ProfileInput) => {
    const editing = form.open ? form.profile : null
    if (editing) await profilesService.update(editing.id, input)
    else {
      const created = await profilesService.create(input)
      notify(t('toast.created', { name: created.name }))
    }
    await reload()
  }

  const importProfiles = async (paths: string[]) => {
    const created = await profilesService.importProfiles(paths)
    notify(t('toast.imported', { count: created.length }))
    await reload()
  }

  const confirmDelete = async (profile: ProfileDTO, removeData: boolean) => {
    await profilesService.remove(profile.id, removeData)
    notify(t('toast.deleted', { name: profile.name }))
    await reload()
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>{Credits.appName}</h1>
          <p className="muted">{t('app.tagline')}</p>
        </div>
        <div className="header-actions">
          <LanguageSelect />
          <Button onClick={() => setImportOpen(true)}>{t('profiles.import')}</Button>
          <Button variant="primary" onClick={() => setForm({ open: true, profile: null })}>
            {t('profiles.new')}
          </Button>
        </div>
      </header>

      <EnvironmentNotice environment={environment} />
      {error && <div className="notice notice-error">{error}</div>}

      {loading ? (
        <p className="muted">{t('app.loading')}</p>
      ) : profiles.length === 0 ? (
        <section className="empty">
          <h2>{t('profiles.empty.title')}</h2>
          <p className="muted">{t('profiles.empty.body')}</p>
          <Button variant="primary" onClick={() => setForm({ open: true, profile: null })}>
            {t('profiles.empty.cta')}
          </Button>
        </section>
      ) : (
        <section className="grid">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              shell={shell}
              homeDir={homeDir}
              isBusy={isBusy}
              {...actions}
            />
          ))}
        </section>
      )}

      {form.open && (
        <ProfileFormDialog
          key={form.profile?.id ?? 'new'}
          profile={form.profile}
          suggestedColor={suggestedColor}
          onClose={closeForm}
          onSubmit={submitForm}
        />
      )}
      {importOpen && (
        <ImportDialog homeDir={homeDir} onClose={closeImport} onImport={importProfiles} />
      )}
      {deleting && (
        <DeleteDialog
          key={deleting.id}
          profile={deleting}
          homeDir={homeDir}
          onClose={closeDelete}
          onConfirm={confirmDelete}
        />
      )}
      <Footer />
    </main>
  )
}
