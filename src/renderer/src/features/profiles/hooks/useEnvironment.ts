import { useEffect, useState } from 'react'
import type { EnvironmentDTO } from '@shared/schemas/profile.schema'
import { profilesService } from '../services/profilesService'

export function useEnvironment(): EnvironmentDTO | null {
  const [environment, setEnvironment] = useState<EnvironmentDTO | null>(null)

  useEffect(() => {
    let active = true
    profilesService
      .environment()
      .then((env) => active && setEnvironment(env))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  return environment
}
