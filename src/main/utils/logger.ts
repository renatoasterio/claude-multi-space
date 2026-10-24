import type { Logger } from '../application/ports/System'

const SENSITIVE_KEY = /token|secret|password|credential|authorization|cookie/i

function redact(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined
  return Object.fromEntries(
    Object.entries(meta).map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? '[redacted]' : v]),
  )
}

export class ConsoleLogger implements Logger {
  constructor(private readonly scope = 'claude-multispace') {}

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(`[${this.scope}] ${message}`, redact(meta) ?? '')
  }
  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[${this.scope}] ${message}`, redact(meta) ?? '')
  }
  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[${this.scope}] ${message}`, redact(meta) ?? '')
  }
}
