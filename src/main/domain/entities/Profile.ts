import { HexColor } from '../value-objects/HexColor'
import type { ProfileId } from '../value-objects/ProfileId'
import { ProfileName } from '../value-objects/ProfileName'

export interface ProfileDetails {
  name: string
  color: string
  email?: string | undefined
  workingDir?: string | undefined
}

export interface ProfileDirectories {
  /** userData isolado da instância do Claude Desktop. */
  desktopDataDir: string
  /** CLAUDE_CONFIG_DIR do Claude Code CLI. */
  cliConfigDir: string
  /** true quando cliConfigDir foi importado (ex.: ~/.claude-cliente) e não pertence ao app. */
  imported: boolean
}

export interface ProfileProps extends ProfileDirectories {
  id: ProfileId
  name: ProfileName
  color: HexColor
  email: string | null
  workingDir: string | null
  createdAt: Date
  updatedAt: Date
}

export class Profile {
  private constructor(private props: ProfileProps) {}

  static create(
    id: ProfileId,
    details: ProfileDetails,
    dirs: ProfileDirectories,
    now: Date,
  ): Profile {
    return new Profile({
      id,
      ...Profile.normalizeDetails(details),
      ...dirs,
      createdAt: now,
      updatedAt: now,
    })
  }

  static restore(props: ProfileProps): Profile {
    return new Profile({ ...props })
  }

  update(details: ProfileDetails, now: Date): void {
    this.props = { ...this.props, ...Profile.normalizeDetails(details), updatedAt: now }
  }

  get id(): ProfileId {
    return this.props.id
  }
  get name(): ProfileName {
    return this.props.name
  }
  get color(): HexColor {
    return this.props.color
  }
  get email(): string | null {
    return this.props.email
  }
  get workingDir(): string | null {
    return this.props.workingDir
  }
  get desktopDataDir(): string {
    return this.props.desktopDataDir
  }
  get cliConfigDir(): string {
    return this.props.cliConfigDir
  }
  get imported(): boolean {
    return this.props.imported
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }

  private static normalizeDetails(details: ProfileDetails) {
    return {
      name: ProfileName.from(details.name),
      color: HexColor.from(details.color),
      email: details.email?.trim().toLowerCase() || null,
      workingDir: details.workingDir?.trim() || null,
    }
  }
}
