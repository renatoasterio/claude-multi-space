// Gera resources/trayTemplate.png (ícone monocromático da barra de menus) sem dependências.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

function crc32(buf) {
  let c,
    crc = 0xffffffff
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, alphaAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4
      raw[i + 3] = alphaAt(x + 0.5, y + 0.5, size)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Três círculos sobrepostos (vários perfis).
const circles = [
  [0.32, 0.4, 0.22],
  [0.68, 0.4, 0.22],
  [0.5, 0.7, 0.22],
]
const alpha = (x, y, s) => {
  for (const [cx, cy, r] of circles) {
    const d = Math.hypot(x / s - cx, y / s - cy)
    if (d <= r && d >= r - 0.085) return 255
  }
  return 0
}

mkdirSync('resources', { recursive: true })
writeFileSync('resources/trayTemplate.png', png(36, alpha))
console.log('resources/trayTemplate.png gerado')
