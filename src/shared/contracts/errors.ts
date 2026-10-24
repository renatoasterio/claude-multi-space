export const ErrorCodes = {
  Validation: 'VALIDATION',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  NotInstalled: 'NOT_INSTALLED',
  LaunchFailed: 'LAUNCH_FAILED',
  UnsupportedPlatform: 'UNSUPPORTED_PLATFORM',
  Forbidden: 'FORBIDDEN',
  Internal: 'INTERNAL',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export interface ErrorPayload {
  code: ErrorCode
  message: string
}
