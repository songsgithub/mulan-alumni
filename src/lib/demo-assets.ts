import zlib from 'zlib'

/**
 * 演示资产生成器：种子数据需要真实的图片与附件，
 * 才能验证「活动照片必传」「报销凭证必传」「学习资料可匿名下载」。
 */

/** CRC32（PNG 分块校验用） */
const crcTable = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

const pngChunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

/** 生成一张纯色 PNG（用于演示活动照片 / 凭证照片） */
export const solidPng = (
  width: number,
  height: number,
  rgb: [number, number, number],
): Buffer => {
  const rows: Buffer[] = []
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3)
    for (let x = 0; x < width; x += 1) {
      row[1 + x * 3] = rgb[0]
      row[2 + x * 3] = rgb[1]
      row[3 + x * 3] = rgb[2]
    }
    rows.push(row)
  }
  return encodePng(width, height, Buffer.concat(rows))
}

/**
 * 生成一张"照片感"的抽象图（占位用）：
 * 天空渐变 + 柔光球 + 地面 + 胶片颗粒 + 暗角。
 * 比纯几何图案更接近纪实照片的观感，适合成果瀑布流。
 * 全部保持中性灰调，符合公众站的纯黑白灰纪律。
 */
export const photoPng = (
  width: number,
  height: number,
  seed = 0,
  tone: 'light' | 'mid' | 'dark' = 'mid',
): Buffer => {
  const rand = (n: number) => {
    // 线性同余，保证同一 seed 结果稳定
    const x = Math.sin((n + seed * 9973) * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }

  const horizon = height * (0.48 + rand(1) * 0.14)
  const sunX = width * (0.22 + rand(2) * 0.56)
  const sunY = horizon * (0.34 + rand(3) * 0.34)
  const sunR = Math.min(width, height) * (0.1 + rand(4) * 0.09)

  const skyTop = tone === 'dark' ? 46 : tone === 'light' ? 232 : 186
  const skyBottom = tone === 'dark' ? 118 : tone === 'light' ? 250 : 224
  const groundTop = tone === 'dark' ? 30 : tone === 'light' ? 150 : 92
  const groundBottom = tone === 'dark' ? 12 : tone === 'light' ? 96 : 46

  const rows: Buffer[] = []
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3)
    const isGround = y >= horizon
    for (let x = 0; x < width; x += 1) {
      let value: number

      if (isGround) {
        const t = (y - horizon) / Math.max(1, height - horizon)
        value = groundTop + (groundBottom - groundTop) * t
      } else {
        const t = y / Math.max(1, horizon)
        value = skyTop + (skyBottom - skyTop) * t
      }

      // 柔光球
      const dx = x - sunX
      const dy = y - sunY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const glow = Math.max(0, 1 - dist / (sunR * 3.4))
      value += glow * glow * (tone === 'dark' ? 150 : 70)

      // 暗角
      const vx = (x / width - 0.5) * 2
      const vy = (y / height - 0.5) * 2
      const vignette = 1 - Math.min(1, (vx * vx + vy * vy) * 0.34)
      value *= 0.72 + vignette * 0.28

      // 胶片颗粒
      value += (rand(Math.floor(y / 2) * width + Math.floor(x / 2) * 7) - 0.5) * 4

      const v = Math.max(0, Math.min(255, Math.round(value)))
      row[1 + x * 3] = v
      row[2 + x * 3] = v
      row[3 + x * 3] = v
    }
    rows.push(row)
  }
  return encodePng(width, height, Buffer.concat(rows))
}

const encodePng = (width: number, height: number, raw: Buffer): Buffer => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type = truecolor
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/** 生成一份纯文本学习资料附件 */
export const textAttachment = (title: string, lines: string[]): Buffer =>
  Buffer.from(
    [
      title,
      '='.repeat(Math.max(title.length * 2, 24)),
      '',
      ...lines,
      '',
      '—— 数字木兰校友会 · 互助团运营系统（演示附件）',
      '',
    ].join('\n'),
    'utf8',
  )

export const pdfAttachment = (title: string, lines: string[]): Buffer => {
  const esc = (text: string) => text.replace(/([\\()])/g, '\\$1')
  const content: string[] = []
  content.push(`BT /F1 22 Tf 56 780 Td (${esc(title)}) Tj ET`)
  content.push('0.12 0.12 0.12 rg 56 756 480 2 re f')
  lines.forEach((line, index) => {
    content.push(`BT /F1 12 Tf 56 ${700 - index * 24} Td (${esc(line)}) Tj ET`)
  })
  // 色卡：主色 / 墨色 / 纸色
  const swatches = ['0.71 0.29 0.25', '0.13 0.13 0.13', '0.94 0.93 0.91']
  swatches.forEach((color, index) => {
    content.push(`${color} rg ${56 + index * 110} 120 90 64 re f`)
  })
  content.push('BT /F1 10 Tf 56 90 Td (Demo asset for local review only.) Tj ET')
  const stream = content.join('\n')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
  ]

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(out, 'latin1'))
    out += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((offset) => {
    out += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
