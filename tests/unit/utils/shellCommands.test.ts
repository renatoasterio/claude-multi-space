import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCliCommand,
  buildCmdLaunchScript,
  buildPosixLaunchScript,
} from '@main/utils/shellCommands'

describe('buildCliCommand', () => {
  // Nomes com hífen (claude-pessoal) são válidos em zsh/bash, os shells alvo do comando copiado.
  it.runIf(process.platform !== 'win32').each(['/bin/zsh', '/bin/bash'].filter(existsSync))(
    'função zsh/bash exporta CLAUDE_CONFIG_DIR sem injeção (%s)',
    (shell) => {
      const dir = mkdtempSync(path.join(tmpdir(), 'mc-'))
      const fakeClaude = path.join(dir, 'fake claude')
      writeFileSync(fakeClaude, '#!/bin/sh\nprintf "%s|%s" "$CLAUDE_CONFIG_DIR" "$1"\n')
      chmodSync(fakeClaude, 0o755)
      const configDir = `/tmp/it's "$(whoami)"`

      const fn = buildCliCommand('posix', {
        name: 'Ação Pessoal',
        configDir,
        executable: fakeClaude,
      })
      expect(fn.startsWith('claude-acao-pessoal()')).toBe(true)

      const out = execFileSync(shell, ['-c', `${fn}\nclaude-acao-pessoal --version`]).toString()
      expect(out).toBe(`${configDir}|--version`)
    },
  )

  it('gera função PowerShell e macro cmd', () => {
    const spec = {
      name: 'Work',
      configDir: 'C:\\Users\\a b\\.claude-work',
      executable: 'C:\\bin\\claude.exe',
    }
    expect(buildCliCommand('powershell', spec)).toContain(
      `$env:CLAUDE_CONFIG_DIR = 'C:\\Users\\a b\\.claude-work'`,
    )
    expect(buildCliCommand('cmd', spec)).toMatch(/^doskey claude-work=set "CLAUDE_CONFIG_DIR=/)
  })
})

describe('launch scripts', () => {
  const spec = {
    configDir: '/x/cli',
    executable: '/bin/claude',
    cwd: '/work dir',
    title: 'Claude · A',
  }

  it('posix: cd, export e execução com aspas', () => {
    const script = buildPosixLaunchScript(spec)
    expect(script).toContain(`cd '/work dir' || exit 1`)
    expect(script).toContain(`export CLAUDE_CONFIG_DIR='/x/cli'`)
    expect(script).toContain(`'/bin/claude'`)
  })

  it('cmd: usa CRLF e escapa metacaracteres do título', () => {
    const script = buildCmdLaunchScript({ ...spec, title: 'A & B' })
    expect(script).toContain('\r\n')
    expect(script).toContain('title A ^& B')
    expect(script).toContain('set "CLAUDE_CONFIG_DIR=/x/cli"')
  })
})

describe('script .command executado de verdade', () => {
  it.runIf(process.platform === 'darwin' || process.platform === 'linux')(
    'entra na pasta, exporta o perfil e chama o claude',
    () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'mc script '))
      const fakeClaude = path.join(dir, 'claude')
      writeFileSync(fakeClaude, '#!/bin/sh\nprintf "%s|%s" "$PWD" "$CLAUDE_CONFIG_DIR"\n')
      chmodSync(fakeClaude, 0o755)
      const script = buildPosixLaunchScript({
        executable: fakeClaude,
        configDir: `${dir}/it's cli`,
        cwd: dir,
        title: 'Claude · Teste',
      })
      const file = path.join(dir, 'launch.command')
      writeFileSync(file, script.replace('#!/bin/zsh -l', '#!/bin/sh'))
      chmodSync(file, 0o755)

      // SHELL=true faz o "exec $SHELL" final encerrar em vez de abrir um shell interativo.
      const out = execFileSync(file, {
        env: { PATH: '/usr/bin:/bin', SHELL: '/usr/bin/true', TERM: 'dumb' },
      }).toString()
      // Sequências de título/clear vêm antes; o final da saída é o que o claude imprimiu.
      expect(out.endsWith(`${dir}|${dir}/it's cli`)).toBe(true)
    },
  )
})
