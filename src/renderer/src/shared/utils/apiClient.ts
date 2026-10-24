import type { ErrorCode } from '@shared/contracts/errors'
import type { IpcResult } from '@shared/contracts/ipc'

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Desembrulha o envelope { ok, data | error } do IPC. */
export async function unwrap<T>(call: Promise<IpcResult<T>>): Promise<T> {
  const result = await call
  if (!result.ok) throw new ApiError(result.error.code, result.error.message)
  return result.data
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro inesperado.'
}
