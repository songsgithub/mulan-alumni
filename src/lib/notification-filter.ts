import type { Where } from 'payload'

/**
 * 通知页的筛选口径（工作台 /notifications）。
 *
 * 条件写进 URL（`?read=unread&q=报销&page=2`），服务端取数——
 * 地址可以直接分享，刷新后筛选还在。
 *
 * 只有两个维度：**已读状态**与**标题关键字**。
 * 不按"类型"筛：通知标题本身就把内容说清楚了（"提交了…的报销，请核定"），
 * 要再分类型就得给集合加字段——不值得。
 */

/** 已读状态：全部 / 未读 / 已读 */
type NotificationReadFilter = 'all' | 'unread' | 'read'

export interface NotificationFilterValue {
  read: NotificationReadFilter
  /** 标题关键字 */
  q: string
}

const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v)?.trim() || ''

/** 地址栏 → 筛选条件（认得的取值，长度截断） */
export function readNotificationFilters(
  sp: Record<string, string | string[] | undefined>,
): NotificationFilterValue {
  const raw = one(sp.read)
  const read: NotificationReadFilter = raw === 'unread' || raw === 'read' ? raw : 'all'
  return { read, q: one(sp.q).slice(0, 50) }
}

/** 筛选条件 → 地址（页码只在第 2 页起才出现，保持地址干净） */
export function notificationHref(value: NotificationFilterValue, page = 1): string {
  const query = new URLSearchParams()
  if (value.read !== 'all') query.set('read', value.read)
  if (value.q) query.set('q', value.q)
  if (page > 1) query.set('page', String(page))
  const qs = query.toString()
  return `/notifications${qs ? `?${qs}` : ''}`
}

/** 筛选条件 → 查询条件（收件人固定是本人；标题按包含匹配） */
export function notificationWhere(userId: number | string, value: NotificationFilterValue): Where {
  const conditions: Where[] = [{ recipient: { equals: userId } }]
  if (value.read === 'unread') conditions.push({ read: { equals: false } })
  if (value.read === 'read') conditions.push({ read: { equals: true } })
  if (value.q) conditions.push({ title: { like: value.q } })
  return { and: conditions }
}
