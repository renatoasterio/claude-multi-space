/** Regras de perfil compartilhadas entre domínio (main) e validação de formulário (renderer). */
export const ProfileConstraints = {
  nameMinLength: 1,
  nameMaxLength: 40,
  emailMaxLength: 254,
  pathMaxLength: 1024,
  maxImportBatch: 20,
  hexColorPattern: /^#[0-9a-f]{6}$/i,
} as const

export const ProfileColorPresets = [
  '#d97757',
  '#6a9bcc',
  '#788c5d',
  '#c46686',
  '#8e7cc3',
  '#e0a84f',
  '#4fa3a5',
  '#9a9a9a',
] as const
