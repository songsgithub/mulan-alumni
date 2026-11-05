/** 公众站统一的日期 / 数字格式（见 docs/设计规范.md §5） */

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** 2026-11-12 → 2026年11月12日 */
export const formatDate = (value?: string | Date | null): string => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return dateFormatter.format(date)
}

/** 2026-11-12T09:30:00Z → 2026年11月12日 09:30 */
export const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return dateTimeFormatter.format(date)
}

/** 金额（元）→ ¥1,234.5。纯函数，客户端组件与服务端都能用 */
export const yuan = (value: number) =>
  `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

/**
 * 执行率（0–1+）→ 「63.21%」。
 *
 * ⚠️ 2026-11-03 第五十轮：执行率一律显示**两位小数**（原来是 `Math.round` 取整），
 *    「63%」看不出是超了一点还是差很多，两位小数才看得出真实水位。
 *    进度条仍按百分比宽度画，不受小数位影响。
 */
export const formatRate = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : `${(value * 100).toFixed(2)}%`

/** 字节数 → 2.4 MB */export const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/* ------------------------------------------------------------------ 表格日期口径 */

/** 2026-11-12 → 2026年11月12日（表格用，零填充） */
export const formatDateCN = (value?: string | Date | null): string => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}年${pad2(date.getMonth() + 1)}月${pad2(date.getDate())}日`
}

/** ISO → 2026年11月12日 09:30:00（表格用，零填充，本地时区） */
export const formatDateTimeCN = (value?: string | Date | null): string => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${formatDateCN(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(
    date.getSeconds(),
  )}`
}

/**
 * 2026年10月26日 14:00-16:00 → { actualAt, actualStart, actualEnd }。
 * 《活动反馈表》的开展时间是一个整串，提交时在这里拆解；
 * 不合法返回 null，让服务端直接报「请按格式填写」。
 */
export const parseActualTime = (
  text: string,
): { actualAt: string; actualStart: string; actualEnd: string } | null => {
  const m = text
    .trim()
    .match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const [, y, mo, d, h1, m1, h2, m2] = m
  const start = new Date(Number(y), Number(mo) - 1, Number(d), Number(h1), Number(m1))
  if (Number.isNaN(start.getTime())) return null
  // 结束必须晚于开始（同日比分钟，跨日按当天中午也算错？活动是当天的事，直接比总分钟数）
  const startMin = Number(h1) * 60 + Number(m1)
  const endMin = Number(h2) * 60 + Number(m2)
  if (endMin <= startMin) return null
  return {
    actualAt: start.toISOString(),
    actualStart: `${pad2(Number(h1))}:${m1}`,
    actualEnd: `${pad2(Number(h2))}:${m2}`,
  }
}

/** 2026年10月26日 → 当天 00:00 的 ISO（计划活动时间，零点本地时区） */
export const parseCNDate = (text: string): string | null => {
  const m = text.trim().match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/)
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(date.getTime()) || Number(m[1]) !== date.getFullYear()) return null
  return date.toISOString()
}

/** 《活动反馈表》展示开展时间：2026年10月26日 14:00-16:00 */
export const formatActualTime = (
  actualAt?: string | Date | null,
  actualStart?: string | null,
  actualEnd?: string | null,
): string => {
  const day = formatDateCN(actualAt)
  if (!day) return ''
  if (actualStart && actualEnd) return `${day} ${actualStart}-${actualEnd}`
  return day
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * 地点 → 「省 · 市 · 区（县）」。
 *
 * 直辖市（北京市 / 上海市 / 天津市 / 重庆市）省和市是同一个名字，
 * 拼起来会变成「北京市 · 北京市 · 朝阳区」——**省和市相同就只留一个**。
 */
export const formatPlace = (
  province?: string | null,
  city?: string | null,
  district?: string | null,
): string => {
  const p = province?.trim() ?? ''
  const c = city?.trim() ?? ''
  const d = district?.trim() ?? ''
  const out: string[] = []
  if (p) out.push(p)
  if (c && c !== p) out.push(c)
  if (d) out.push(d)
  return out.join(' · ')
}

/**
 * 邮箱打码：只露出首尾（a****z@example.com）。
 * 用在会被转发出去的链接页面上：链接流出去，邮箱不跟着流出去。
 */
export const maskEmail = (email: string): string => {
  const at = email.indexOf('@')
  if (at <= 1) return email
  const name = email.slice(0, at)
  const domain = email.slice(at)
  const head = name.slice(0, 1)
  const tail = name.slice(-1)
  return name.length <= 2
    ? `${head}***${domain}`
    : `${head}${'*'.repeat(Math.max(2, name.length - 2))}${tail}${domain}`
}
