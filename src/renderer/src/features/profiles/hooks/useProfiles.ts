import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProfileDTO } from '@shared/schemas/profile.schema'
import { errorMessage } from '../../../shared/utils/apiClient'
import { profilesService } from '../services/profilesService'

interface ProfilesState {
  profiles: ProfileDTO[]
  loading: boolean
  error: string | null
}

/**
 * Lista de perfis sincronizada com o main: recarrega em eventos de mudança e ao focar a janela.
 * Respostas antigas são descartadas (contador de requisição) e listeners são removidos no cleanup.
 */
export function useProfiles() {
  const [state, setState] = useState<ProfilesState>({ profiles: [], loading: true, error: null })
  const requestId = useRef(0)

  const reload = useCallback(async () => {
    const current = ++requestId.current
    try {
      const profiles = await profilesService.list()
      if (current === requestId.current) setState({ profiles, loading: false, error: null })
    } catch (error) {
      if (current === requestId.current)
        setState((s) => ({ ...s, loading: false, error: errorMessage(error) }))
    }
  }, [])

  useEffect(() => {
    const requests = requestId
    void reload()
    const unsubscribe = profilesService.onChanged(() => void reload())
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => {
      // Invalida respostas em voo para não atualizar estado após desmontar.
      requests.current++
      unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [reload])

  return { ...state, reload }
}
