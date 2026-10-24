import type { ShellKind } from '@shared/schemas/profile.schema'
import { escapeCmdValue, quotePosix, quotePowerShell } from './shellQuote'
import { slugify } from './slugify'

export interface CliCommandSpec {
  name: string
  configDir: string
  executable: string
}

/** Função de shell `claude-<perfil>` que roda o CLI com o CLAUDE_CONFIG_DIR do perfil. */
export function buildCliCommand(shell: ShellKind, spec: CliCommandSpec): string {
  const fn = `claude-${slugify(spec.name)}`
  switch (shell) {
    case 'posix':
      return `${fn}() { CLAUDE_CONFIG_DIR=${quotePosix(spec.configDir)} ${quotePosix(spec.executable)} "$@"; }`
    case 'powershell':
      return [
        `function ${fn} {`,
        `  $env:CLAUDE_CONFIG_DIR = ${quotePowerShell(spec.configDir)}`,
        `  try { & ${quotePowerShell(spec.executable)} @args } finally { Remove-Item Env:CLAUDE_CONFIG_DIR }`,
        `}`,
      ].join('\n')
    case 'cmd':
      // $T separa comandos em macros doskey; a variável é limpa ao final.
      return `doskey ${fn}=set "CLAUDE_CONFIG_DIR=${escapeCmdValue(spec.configDir)}" $T "${escapeCmdValue(spec.executable)}" $* $T set CLAUDE_CONFIG_DIR=`
  }
}

export interface LaunchScriptSpec {
  configDir: string
  executable: string
  cwd: string
  title: string
}

/** Script .command (macOS) executado pelo Terminal.app. */
export function buildPosixLaunchScript(spec: LaunchScriptSpec): string {
  return [
    '#!/bin/zsh -l',
    `printf '\\033]0;%s\\007' ${quotePosix(spec.title)}`,
    `cd ${quotePosix(spec.cwd)} || exit 1`,
    `export CLAUDE_CONFIG_DIR=${quotePosix(spec.configDir)}`,
    'clear',
    quotePosix(spec.executable),
    // Ao sair do claude, mantém um shell com o perfil ativo.
    'exec "${SHELL:-/bin/zsh}" -l',
    '',
  ].join('\n')
}

/** Script .cmd (Windows) executado em uma nova janela de console. */
export function buildCmdLaunchScript(spec: LaunchScriptSpec): string {
  return [
    '@echo off',
    `title ${escapeCmdValue(spec.title).replace(/[&|<>^]/g, '^$&')}`,
    `cd /d "${escapeCmdValue(spec.cwd)}"`,
    `set "CLAUDE_CONFIG_DIR=${escapeCmdValue(spec.configDir)}"`,
    `"${escapeCmdValue(spec.executable)}"`,
    '',
  ].join('\r\n')
}
