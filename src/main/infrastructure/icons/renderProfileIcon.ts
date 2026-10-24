import { IconGeometry, parseHexColor, sparklePolygon, type Point } from '@shared/icons/profileIcon'
import { encodePng } from './imageEncoders'

const SAMPLES = 4 // supersampling 4x4 para bordas suaves

/** Pontos x onde a linha horizontal y cruza as arestas do polígono, em ordem crescente. */
function scanlineCrossings(polygon: readonly Point[], y: number): number[] {
  const xs: number[] = []
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!
    const [xj, yj] = polygon[j]!
    if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi)
  }
  return xs.sort((a, b) => a - b)
}

/** Meia-largura do quadrado arredondado na altura y (0 se fora). */
function roundedSquareSpan(y: number, size: number, radius: number): [number, number] | null {
  if (y < 0 || y > size) return null
  const dy = y < radius ? radius - y : y > size - radius ? y - (size - radius) : 0
  if (dy > radius) return null
  const inset = radius - Math.sqrt(radius * radius - dy * dy)
  return [inset, size - inset]
}

/**
 * Rasteriza o ícone do perfil (faísca branca sobre a cor) em PNG `size`x`size`.
 * Varre por linhas: as interseções são calculadas uma vez por sub-linha, então até 1024 px
 * leva poucos milissegundos.
 */
export function renderProfileIconPng(color: string, size: number): Buffer {
  const [r, g, b] = parseHexColor(color)
  const { viewBox, cornerRadius } = IconGeometry
  const scale = viewBox / size
  const polygon = sparklePolygon()
  const background = new Uint16Array(size * size)
  const sparkle = new Uint16Array(size * size)

  for (let py = 0; py < size; py++) {
    for (let sy = 0; sy < SAMPLES; sy++) {
      const y = (py + (sy + 0.5) / SAMPLES) * scale
      const span = roundedSquareSpan(y, viewBox, cornerRadius)
      if (!span) continue
      const crossings = scanlineCrossings(polygon, y)
      let crossed = 0
      for (let px = 0; px < size; px++) {
        const index = py * size + px
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) * scale
          if (x < span[0] || x > span[1]) continue
          while (crossed < crossings.length && crossings[crossed]! <= x) crossed++
          background[index]!++
          if (crossed % 2 === 1) sparkle[index]!++
        }
      }
    }
  }

  const total = SAMPLES * SAMPLES
  const rgba = new Uint8Array(size * size * 4)
  for (let index = 0; index < size * size; index++) {
    const covered = background[index]!
    if (!covered) continue
    // Mistura branco (faísca) e a cor do perfil na proporção de amostras cobertas.
    const white = sparkle[index]! / covered
    const i = index * 4
    rgba[i] = Math.round(r + (255 - r) * white)
    rgba[i + 1] = Math.round(g + (255 - g) * white)
    rgba[i + 2] = Math.round(b + (255 - b) * white)
    rgba[i + 3] = Math.round((covered / total) * 255)
  }
  return encodePng(size, rgba)
}
