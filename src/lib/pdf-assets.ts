import fs from 'node:fs'
import path from 'node:path'

/** 服务端把上传文件读成 data URI（生成 PDF 时不受前端访问控制影响） */
export function fileToDataUri(
  dir: 'media' | 'finance-evidence',
  filename?: string | null,
): string | null {
  if (!filename) return null
  try {
    const full = path.join(process.cwd(), dir, filename)
    if (!fs.existsSync(full)) return null
    const buffer = fs.readFileSync(full)
    // MIME 看文件头，不信扩展名（演示图片是 PNG 但名字是 .jpg）
    const hex = buffer.subarray(0, 12).toString('hex')
    const mime = hex.startsWith('89504e47')
      ? 'image/png'
      : hex.startsWith('ffd8ff')
        ? 'image/jpeg'
        : hex.startsWith('47494638')
          ? 'image/gif'
          : hex.startsWith('52494646') && buffer.subarray(8, 12).toString() === 'WEBP'
            ? 'image/webp'
            : null
    if (!mime) return null
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}
