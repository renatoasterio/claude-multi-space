import { ProfileConstraints as C } from '@shared/schemas/profile.constraints'
import { DomainError } from '../errors/DomainError'

export class ProfileName {
  private constructor(readonly value: string) {}

  static from(raw: string): ProfileName {
    const value = raw.trim().replace(/\s+/g, ' ')
    if (value.length < C.nameMinLength || value.length > C.nameMaxLength) {
      throw DomainError.validation('errors.invalidName', {
        min: C.nameMinLength,
        max: C.nameMaxLength,
      })
    }
    return new ProfileName(value)
  }

  /** Comparação usada para impedir nomes duplicados ("Pessoal" == "pessoal"). */
  sameAs(other: ProfileName): boolean {
    return this.value.localeCompare(other.value, undefined, { sensitivity: 'accent' }) === 0
  }
}
