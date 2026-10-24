import { ErrorCodes, type ErrorPayload } from '@shared/contracts/errors'
import type { Translate } from '@shared/i18n/translate'
import { ZodError } from 'zod'
import type { Logger } from '../../application/ports/System'
import { DomainError } from '../../domain/errors/DomainError'

/** Converte qualquer erro em payload traduzido e seguro: detalhes internos ficam só no log. */
export function toErrorPayload(
  error: unknown,
  logger: Logger,
  channel: string,
  t: Translate,
): ErrorPayload {
  if (error instanceof DomainError) {
    return { code: error.code, message: t(error.messageKey, error.params) }
  }
  if (error instanceof ZodError) {
    const fields = [...new Set(error.issues.map((i) => i.path.join('.')).filter(Boolean))]
    const message = t('errors.invalidData')
    return {
      code: ErrorCodes.Validation,
      message: fields.length ? `${message} (${fields.join(', ')})` : message,
    }
  }
  logger.error('Erro inesperado no IPC', {
    channel,
    error: error instanceof Error ? error.stack : String(error),
  })
  return { code: ErrorCodes.Internal, message: t('errors.unexpected') }
}
