/**
 * Ícone de perfil: uma "faísca" de 4 pontas (desenho próprio do projeto, não o logo da Anthropic)
 * em branco sobre um quadrado arredondado na cor do perfil.
 * Coordenadas num quadro 0..100; a interface usa como SVG e o main rasteriza em PNG.
 */
export const IconGeometry = {
  viewBox: 100,
  cornerRadius: 22,
  center: 50,
  outerRadius: 35,
  innerRadius: 13,
  /** Pontas longas (N, L, S, O) intercaladas com pontas curtas nas diagonais. */
  shortTipRadius: 22,
} as const

export type Point = readonly [number, number]

/** Polígono da faísca: 16 vértices alternando ponta longa, vale, ponta curta, vale. */
export function sparklePolygon(): Point[] {
  const { center, outerRadius, innerRadius, shortTipRadius } = IconGeometry
  const points: Point[] = []
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI / 8) * i - Math.PI / 2
    const radius = i % 2 === 1 ? innerRadius : i % 4 === 0 ? outerRadius : shortTipRadius
    points.push([center + radius * Math.cos(angle), center + radius * Math.sin(angle)])
  }
  return points
}

export function sparkleSvgPath(): string {
  return (
    sparklePolygon()
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' ') + ' Z'
  )
}

export function parseHexColor(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) throw new Error(`Cor inválida: ${hex}`)
  return [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)]
}
