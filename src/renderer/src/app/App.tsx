import { ProfilesPage } from '../features/profiles/ProfilesPage'
import { I18nProvider } from '../shared/i18n/I18nProvider'
import { ToastProvider } from '../shared/components/Toasts'

export function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <ProfilesPage />
      </ToastProvider>
    </I18nProvider>
  )
}
