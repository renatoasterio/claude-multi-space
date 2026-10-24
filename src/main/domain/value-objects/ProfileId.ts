import { DomainError } from '../errors/DomainError'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class ProfileId {
  private constructor(readonly value: string) {}

  static from(value: string): ProfileId {
    if (!UUID_PATTERN.test(value)) throw DomainError.validation('errors.invalidProfileId')
    return new ProfileId(value.toLowerCase())
  }

  equals(other: ProfileId): boolean {
    return this.value === other.value
  }
}
