import { ProfileConstraints } from '@shared/schemas/profile.constraints'
import { DomainError } from '../errors/DomainError'

export class HexColor {
  private constructor(readonly value: string) {}

  static from(value: string): HexColor {
    if (!ProfileConstraints.hexColorPattern.test(value)) {
      throw DomainError.validation('errors.invalidColor')
    }
    return new HexColor(value.toLowerCase())
  }
}
