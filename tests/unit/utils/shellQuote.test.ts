import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { escapeCmdValue, quotePosix, quotePowerShell } from '@main/utils/shellQuote'

const nasty = [
  `simple`,
  `with space`,
  `it's`,
  `"; rm -rf ~; "`,
  '$(touch /tmp/pwned)',
  '`id`',
  `a\\b`,
  `\n`,
]

describe('quotePosix', () => {
  it.runIf(process.platform !== 'win32').each(nasty)('mantém %j literal no sh', (value) => {
    const out = execFileSync('/bin/sh', ['-c', `printf %s ${quotePosix(value)}`]).toString()
    expect(out).toBe(value)
  })
})

describe('quotePowerShell', () => {
  it('duplica aspas simples', () => {
    expect(quotePowerShell(`it's`)).toBe(`'it''s'`)
  })
})

describe('escapeCmdValue', () => {
  it('duplica % para não expandir variáveis', () => {
    expect(escapeCmdValue('C:\\100%\\x')).toBe('C:\\100%%\\x')
  })
  it('rejeita aspas e quebras de linha', () => {
    expect(() => escapeCmdValue('a"b')).toThrow()
    expect(() => escapeCmdValue('a\r\nb')).toThrow()
  })
})
