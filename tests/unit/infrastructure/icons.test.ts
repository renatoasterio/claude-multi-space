import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { parseHexColor, sparklePolygon, sparkleSvgPath } from '@shared/icons/profileIcon'
import { encodeIcns, encodeIco, encodePng } from '@main/infrastructure/icons/imageEncoders'
import { renderProfileIconPng } from '@main/infrastructure/icons/renderProfileIcon'

/** Decodifica o PNG gerado (RGBA, filtro 0) para inspecionar pixels. */
function decodePng(png: Buffer) {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const size = png.readUInt32BE(16)
  let offset = 8
  const idat: Buffer[] = []
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const raw = inflateSync(Buffer.concat(idat))
  const pixel = (x: number, y: number) => {
    const i = y * (size * 4 + 1) + 1 + x * 4
    return [...raw.subarray(i, i + 4)]
  }
  return { size, pixel }
}

describe('ícone do perfil', () => {
  it('geometria: 16 vértices e path SVG fechado', () => {
    expect(sparklePolygon()).toHaveLength(16)
    expect(sparkleSvgPath()).toMatch(/^M.* Z$/)
    expect(parseHexColor('#d97757')).toEqual([217, 119, 87])
    expect(() => parseHexColor('red')).toThrow()
  })

  it('cantos transparentes, fundo na cor do perfil e faísca branca no centro', () => {
    const { size, pixel } = decodePng(renderProfileIconPng('#6a9bcc', 64))
    expect(size).toBe(64)
    expect(pixel(0, 0)[3]).toBe(0)
    expect(pixel(6, 32)).toEqual([106, 155, 204, 255])
    expect(pixel(32, 32)).toEqual([255, 255, 255, 255])
  })
})

describe('encoders', () => {
  const png = encodePng(1, new Uint8Array([1, 2, 3, 4]))

  it('ICNS: cabeçalho, tamanho total e tipo por resolução', () => {
    const icns = encodeIcns(
      new Map([
        [16, png],
        [32, png],
      ]),
    )
    expect(icns.toString('ascii', 0, 4)).toBe('icns')
    expect(icns.readUInt32BE(4)).toBe(icns.length)
    expect(icns.toString('ascii', 8, 12)).toBe('icp4')
    expect(() => encodeIcns(new Map([[20, png]]))).toThrow()
  })

  it('ICO: diretório aponta para cada PNG e 256 vira 0', () => {
    const ico = encodeIco(
      new Map([
        [16, png],
        [256, png],
      ]),
    )
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(2)
    expect(ico[6]).toBe(16)
    expect(ico[22]).toBe(0)
    const firstOffset = ico.readUInt32LE(6 + 12)
    expect(ico.subarray(firstOffset, firstOffset + png.length)).toEqual(png)
  })
})
