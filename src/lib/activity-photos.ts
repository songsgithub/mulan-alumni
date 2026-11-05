import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * 活动图片：命名、取原图、打包前的整理。
 *
 * 文件名格式：`20261125_杭州AI互助团_AI工具共享活动（1）.jpg`
 * - 日期 = 活动开展日期（反馈里的实际开展时间，没有就用计划日期），按北京时间；
 * - 互助团名称、活动名称去掉会导致文件系统出错的字符；
 * - （1）（2）…按这个活动里照片的顺序编号。
 */

/** 单次下载的原图总量上限（内存里打包，超过就请分批下载） */
const MAX_ARCHIVE_BYTES = 600 * 1024 * 1024

export class ArchiveTooLargeError extends Error {}

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 2026-11-25 → 20261125；没有日期时用 00000000 占位 */
export function activityDateKey(value: string | Date | null | undefined): string {
  if (!value) return '00000000'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '00000000'
  return DAY_FORMAT.format(date).replaceAll('-', '')
}

/** 20261125 → 2026/11/25（页面上显示用） */
export function formatDateKey(key: string): string {
  if (!/^\d{8}$/.test(key) || key === '00000000') return '日期待定'
  return `${key.slice(0, 4)}/${key.slice(4, 6)}/${key.slice(6, 8)}`
}

/** 文件名里不能出现的字符换成「·」，连续空白收成一个空格 */
export function safeNamePart(value: string): string {
  return (
    value
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '·')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.+$/, '') || '未命名'
  )
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|avif)$/i

/** 只认图片：照片字段偶尔会混进文本附件，不能打进图片包 */
function isImageMedia(media: any): boolean {
  if (!media || typeof media !== 'object') return false
  const mime = String(media.mimeType ?? '')
  if (mime) return mime.startsWith('image/')
  return IMAGE_EXT.test(String(media.filename ?? ''))
}

/** 活动里有效的照片：已关联到媒体文件的图片 */
export function activityPhotos(report: any): any[] {
  return (report?.photos ?? []).filter(
    (photo: any) => isImageMedia(photo) && (photo.url || photo.filename),
  )
}

function photoExtension(media: any): string {
  const fromName = path.extname(String(media?.filename ?? '')).slice(1).toLowerCase()
  if (fromName) return fromName
  const byMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
  }
  return byMime[String(media?.mimeType ?? '')] ?? 'jpg'
}

/** 取原图：S3 上的文件走它的公开地址；本地开发的文件直接读 media/ 目录 */
async function readPhotoBytes(media: any): Promise<Uint8Array> {
  const url = String(media?.url ?? '')
  if (/^https?:\/\//.test(url)) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`图片读取失败（${res.status}）`)
    return new Uint8Array(await res.arrayBuffer())
  }
  const filename = String(media?.filename ?? '')
  if (!filename) throw new Error('图片缺少文件名')
  return new Uint8Array(await readFile(path.join(process.cwd(), 'media', path.basename(filename))))
}

interface ActivityTarget {
  plan: any
  report: any
}

/** 把一批活动展开成「文件名 + 原图字节」的列表，按活动、照片顺序编号 */
export async function buildPhotoEntries(targets: ActivityTarget[]) {
  const used = new Set<string>()
  const totalBytes = targets.reduce(
    (sum, t) => sum + activityPhotos(t.report).reduce((s: number, p: any) => s + (Number(p.filesize) || 0), 0),
    0,
  )
  if (totalBytes > MAX_ARCHIVE_BYTES) throw new ArchiveTooLargeError('图片总量超过单次下载上限，请按活动分别下载')

  const entries: { name: string; data: Uint8Array }[] = []
  for (const { plan, report } of targets) {
    const date = activityDateKey(report?.actualAt || plan.plannedAt)
    const cohort = safeNamePart(plan.cohort?.name ?? '未归属互助团')
    const title = safeNamePart(plan.title || plan.theme || '未命名活动')

    // 同一天、同团、同名的两场活动：第二场加「-2」，避免文件互相覆盖
    let base = `${date}_${cohort}_${title}`
    for (let n = 2; used.has(base); n += 1) base = `${date}_${cohort}_${title}-${n}`

    const photos = activityPhotos(report)
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index]
      const name = `${base}（${index + 1}）.${photoExtension(photo)}`
      used.add(base)
      entries.push({ name, data: await readPhotoBytes(photo) })
    }
  }
  return entries
}
