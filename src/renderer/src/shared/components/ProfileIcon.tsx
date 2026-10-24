import { memo } from 'react'
import { IconGeometry, sparkleSvgPath } from '@shared/icons/profileIcon'

const SPARKLE_PATH = sparkleSvgPath()

interface ProfileIconProps {
  color: string
  size?: number
  className?: string
}

/** Mesmo desenho usado na bandeja e nos atalhos do sistema, na cor do perfil. */
export const ProfileIcon = memo(function ProfileIcon({
  color,
  size = 40,
  className,
}: ProfileIconProps) {
  const { viewBox, cornerRadius } = IconGeometry
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      aria-hidden
      focusable="false"
    >
      <rect width={viewBox} height={viewBox} rx={cornerRadius} fill={color} />
      <path d={SPARKLE_PATH} fill="#fff" />
    </svg>
  )
})
