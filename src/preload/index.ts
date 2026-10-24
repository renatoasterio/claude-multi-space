import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type MultiSpaceApi } from '@shared/contracts/ipc'

const invoke = (channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload)

/** Superfície mínima exposta ao renderer: nada de ipcRenderer cru. */
const api: MultiSpaceApi = {
  environment: () => invoke(IpcChannels.environment),
  getSettings: () => invoke(IpcChannels.getSettings),
  setLanguage: (language) => invoke(IpcChannels.setLanguage, language),
  pickDirectory: () => invoke(IpcChannels.pickDirectory),
  listProfiles: () => invoke(IpcChannels.listProfiles),
  createProfile: (input) => invoke(IpcChannels.createProfile, input),
  updateProfile: (id, input) => invoke(IpcChannels.updateProfile, { id, input }),
  deleteProfile: (id, removeData) => invoke(IpcChannels.deleteProfile, { id, removeData }),
  launchDesktop: (id) => invoke(IpcChannels.launchDesktop, id),
  launchCli: (id) => invoke(IpcChannels.launchCli, id),
  createShortcut: (id) => invoke(IpcChannels.createShortcut, id),
  copyCommand: (id, shell) => invoke(IpcChannels.copyCommand, { id, shell }),
  listImportCandidates: () => invoke(IpcChannels.listImportCandidates),
  importProfiles: (paths) => invoke(IpcChannels.importProfiles, { paths }),
  onProfilesChanged: (listener) => {
    const wrapped = () => listener()
    ipcRenderer.on(IpcChannels.profilesChanged, wrapped)
    return () => {
      ipcRenderer.off(IpcChannels.profilesChanged, wrapped)
    }
  },
}

contextBridge.exposeInMainWorld('api', api)
