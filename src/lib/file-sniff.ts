import { readFileSync } from 'node:fs'
import { open } from 'node:fs/promises'

import { APIError } from 'payload'

/**
 * 按**文件内容**认文件类型（不信浏览器报上来的 `file.type` 与文件名）。
 *
 * 浏览器给的类型与扩展名都是客户端能随便填的：把一个 `x.html` 报成 `image/jpeg`
 * 传上来，它就会从工作台同一个域名被打开——那就是存储型 XSS。
 * 所以上传集合在落盘前读文件头（magic bytes），认出真实类型，
 * 类型不在白名单里直接拒，扩展名也改成与真实类型一致。
 */

interface Sniffed {
  mime: string
  ext: string
}

const startsWith = (buf: Uint8Array, bytes: number[], offset = 0) =>
  bytes.every((b, i) => buf[offset + i] === b)

const ascii = (buf: Uint8Array, start: number, end: number) =>
  Array.from(buf.subarray(start, end))
    .map((c) => String.fromCharCode(c))
    .join('')

/** Office 2007+（docx / xlsx / pptx）都是 zip，靠声明的类型区分；声明不是 Office 就当 zip */
const OOXML: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}
/** 老版 Office（doc / xls / ppt）都是 OLE 复合文档 */
const OLE: Record<string, string> = {
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
}

/** 读文件头认类型；认不出返回 null */
export function sniff(head: Uint8Array, declared = ''): Sniffed | null {
  if (head.length < 4) return null
  if (startsWith(head, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' }
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' }
  if (ascii(head, 0, 6) === 'GIF87a' || ascii(head, 0, 6) === 'GIF89a') return { mime: 'image/gif', ext: 'gif' }
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  if (ascii(head, 0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' }
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: 'video/webm', ext: 'webm' }
  // ISO 媒体（mp4 / mov / heic）：第 4–8 字节是 'ftyp'，之后是品牌
  if (ascii(head, 4, 8) === 'ftyp') {
    const brand = ascii(head, 8, 12)
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'].includes(brand)) return { mime: 'image/heic', ext: 'heic' }
    if (['mif1', 'msf1'].includes(brand)) return { mime: 'image/heif', ext: 'heif' }
    if (brand === 'qt  ') return { mime: 'video/quicktime', ext: 'mov' }
    return { mime: 'video/mp4', ext: 'mp4' }
  }
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    if (OOXML[declared]) return { mime: declared, ext: OOXML[declared] }
    return { mime: 'application/zip', ext: 'zip' }
  }
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (OLE[declared]) return { mime: declared, ext: OLE[declared] }
    return null
  }
  // 纯文本：没有 NUL 字节，且**不像 HTML / SVG / XML**（这些一律不收）
  if (declared === 'text/plain' || declared === 'text/csv') {
    if (head.includes(0)) return null
    const text = new TextDecoder('utf-8', { fatal: false }).decode(head).trimStart().toLowerCase()
    if (/^(<!doctype|<html|<svg|<\?xml|<script|<head|<body|<iframe)/.test(text)) return null
    return declared === 'text/csv' ? { mime: 'text/csv', ext: 'csv' } : { mime: 'text/plain', ext: 'txt' }
  }
  return null
}

/** 把文件名的扩展名换成真实类型的扩展名（保留原名主体） */
function renameExt(name: string, ext: string): string {
  const base = (name || 'file').replace(/\.[^./\\]*$/, '') || 'file'
  return `${base}.${ext}`
}

/** 读取上传文件的前 64 字节：内存里的 buffer，或 Payload 落到临时目录的文件 */
async function readHead(file: { data?: Buffer; tempFilePath?: string }): Promise<Uint8Array> {
  if (file.data && file.data.length) return new Uint8Array(file.data.subarray(0, 64))
  if (file.tempFilePath) {
    try {
      const handle = await open(file.tempFilePath, 'r')
      try {
        const buf = Buffer.alloc(64)
        const { bytesRead } = await handle.read(buf, 0, 64, 0)
        return new Uint8Array(buf.subarray(0, bytesRead))
      } finally {
        await handle.close()
      }
    } catch {
      try {
        return new Uint8Array(readFileSync(file.tempFilePath).subarray(0, 64))
      } catch {
        return new Uint8Array()
      }
    }
  }
  return new Uint8Array()
}

/**
 * 上传集合的 beforeOperation 钩子：按内容认类型，不在白名单里就拒；
 * 认出来了就把 mimetype 与扩展名都改成真实的（防"报成图片的 HTML"）。
 */
export const sniffUpload =
  (allowed: readonly string[], label = '文件', canWrite: (user: unknown) => boolean = () => true) =>
  async ({ req, operation }: { req: any; operation: string }) => {
    if (operation !== 'create' && operation !== 'update') return
    const file = req?.file
    if (!file) return
    // 经 REST 来、但本来就没有写权限的请求：交给集合访问控制回 403，不在这里提前报类型错误
    if (req?.payloadAPI === 'REST' && !canWrite(req?.user)) return
    const head = await readHead(file)
    const found = sniff(head, String(file.mimetype ?? ''))
    if (!found || !allowed.includes(found.mime)) {
      throw new APIError(`${label}类型不受支持（按文件内容识别）：${String(file.name ?? '')}`, 400, null, true)
    }
    file.mimetype = found.mime
    file.name = renameExt(String(file.name ?? ''), found.ext)
  }
