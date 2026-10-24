import { ErrorCodes, type ErrorCode } from '@shared/contracts/errors'
import type { MessageKey, MessageParams } from '@shared/i18n/translate'

/**
 * Erro de negócio sem texto fixo: carrega a chave da mensagem e seus parâmetros,
 * e a camada de apresentação traduz para o idioma escolhido pelo usuário.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly messageKey: MessageKey,
    readonly params?: MessageParams,
    options?: { cause?: unknown },
  ) {
    super(messageKey, options)
    this.name = 'DomainError'
  }

  static validation(key: MessageKey, params?: MessageParams): DomainError {
    return new DomainError(ErrorCodes.Validation, key, params)
  }

  static notFound(key: MessageKey, params?: MessageParams): DomainError {
    return new DomainError(ErrorCodes.NotFound, key, params)
  }

  static conflict(key: MessageKey, params?: MessageParams): DomainError {
    return new DomainError(ErrorCodes.Conflict, key, params)
  }

  static forbidden(key: MessageKey, params?: MessageParams): DomainError {
    return new DomainError(ErrorCodes.Forbidden, key, params)
  }
}
