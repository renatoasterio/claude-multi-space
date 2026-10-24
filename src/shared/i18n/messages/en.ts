/** Dicionário de referência: toda chave nova nasce aqui e o TypeScript exige a tradução nos demais. */
export const en = {
  // App
  'app.tagline': 'One Claude per account — side by side, no logging out.',
  'app.language': 'Language',
  'app.loading': 'Loading…',

  // Header and empty state
  'profiles.import': 'Import from CLI',
  'profiles.new': 'New profile',
  'profiles.empty.title': 'No profiles yet',
  'profiles.empty.body':
    'Create one profile per Claude account. Each profile opens its own isolated Claude Desktop and CLI, where you sign in only once.',
  'profiles.empty.cta': 'Create first profile',

  // Card
  'card.noEmail': 'No reference email',
  'card.cli': 'CLI',
  'card.folder': 'Folder',
  'card.imported': 'imported',
  'card.openDesktop': 'Open Desktop',
  'card.openCli': 'Open CLI',
  'card.copyCommand': 'Copy command',
  'card.copyCommandHint': 'Copies a shell function to use this profile outside the app',
  'card.edit': 'Edit',
  'card.delete': 'Delete',
  'status.running': 'Desktop open',
  'status.configured': 'Configured',
  'status.new': 'Waiting for sign-in',

  // Profile form
  'form.titleNew': 'New profile',
  'form.titleEdit': 'Edit profile',
  'form.name': 'Name',
  'form.namePlaceholder': 'e.g. Personal, Work, Client X',
  'form.email': 'Account email (reference)',
  'form.emailPlaceholder': 'you@example.com',
  'form.emailHint': 'Only to identify the profile. You sign in inside Claude itself.',
  'form.workingDir': 'Default CLI working folder',
  'form.workingDirPlaceholder': 'Optional — default: your home folder',
  'form.choose': 'Choose…',
  'form.color': 'Color',
  'form.customColor': 'Custom color',
  'form.cancel': 'Cancel',
  'form.save': 'Save',
  'form.create': 'Create profile',
  'form.invalidEmail': 'Invalid email.',
  'form.invalidFields': 'Check the name and color.',

  // Import dialog
  'import.title': 'Import CLI profiles',
  'import.body':
    'Existing {pattern} folders (for example, from your shell aliases) become profiles without signing in to the CLI again. The app never deletes them.',
  'import.searching': 'Searching…',
  'import.none': 'No new folders found.',
  'import.submit': 'Import {count}',

  // Delete dialog
  'delete.title': 'Delete "{name}"?',
  'delete.removeData': "Also delete this profile's sign-in session and data",
  'delete.keepsImported': 'The imported folder {path} is kept.',
  'delete.confirm': 'Delete',

  // Environment notices
  'env.unsupported': 'This operating system is not supported — use macOS or Windows.',
  'env.noDesktop': 'Claude Desktop was not found (install it from claude.ai/download).',
  'env.noCli': 'Claude Code CLI was not found in your PATH.',

  // Toasts
  'toast.openingDesktop': 'Opening Claude Desktop · {name}',
  'toast.openingCli': 'Opening terminal · {name}',
  'toast.copiedPosix': 'Function copied — paste it into your ~/.zshrc',
  'toast.copiedPowerShell': 'Function copied — paste it into your $PROFILE',
  'toast.created': 'Profile "{name}" created. Click "Open Desktop" to sign in.',
  'toast.imported': '{count} profile(s) imported.',
  'toast.deleted': 'Profile "{name}" deleted.',

  // Footer / about
  'credits.createdBy': 'Created by',
  'credits.license': 'Personal, non-commercial use ({license})',

  // Tray
  'tray.openDesktop': 'Open Claude Desktop',
  'tray.openCli': 'Open Claude Code (terminal)',
  'tray.noProfiles': 'No profiles yet',
  'tray.manage': 'Manage profiles…',
  'tray.about': 'About {app}',
  'tray.quit': 'Quit',

  // Errors (main process)
  'errors.unexpected': 'Unexpected error. Check the app logs.',
  'errors.invalidData': 'Invalid data.',
  'errors.invalidProfileId': 'Invalid profile identifier.',
  'errors.invalidName': 'Name must be between {min} and {max} characters.',
  'errors.invalidColor': 'Color must use the #RRGGBB format.',
  'errors.profileNotFound': 'Profile not found.',
  'errors.nameTaken': 'A profile named "{name}" already exists.',
  'errors.closeDesktopFirst': "Close this profile's Claude Desktop before deleting its data.",
  'errors.importNotAllowed': 'This folder cannot be imported: {path}',
  'errors.workingDirMissing': 'The working folder does not exist.',
  'errors.desktopNotInstalled': 'Claude Desktop was not found on this computer.',
  'errors.cliNotInstalled':
    'Claude Code CLI was not found. Install it with: curl -fsSL https://claude.ai/install.sh | bash',
  'errors.launchDesktopFailed': 'Could not open Claude Desktop: {reason}',
  'errors.launchTerminalFailed': 'Could not open the terminal: {reason}',
  'errors.unsupportedPlatform': 'Unsupported operating system (use macOS or Windows).',
  'errors.outsideManagedArea': "Folder is outside the app's managed area.",
  'errors.untrustedSender': 'Untrusted IPC sender.',
} as const

export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, string>
