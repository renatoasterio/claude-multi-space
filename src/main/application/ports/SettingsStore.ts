import type { Locale } from '@shared/i18n/locales'

export interface AppSettings {
  language: Locale
}

export interface SettingsStore {
  get(): Promise<AppSettings>
  update(patch: Partial<AppSettings>): Promise<AppSettings>
}
