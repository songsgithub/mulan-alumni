/**
 * 资源页的筛选口径（工作台 /resources，内部真实路径 /assets）。
 *
 * 条件写进 URL（`?type=doc&page=2`），服务端取数——
 * 地址可以直接分享，刷新后还在。
 *
 * 类型只有两种（文档 / 视频），与 `resources.type` 字段一一对应。
 */

export type ResourceTypeFilter = 'all' | 'doc' | 'video'

const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v)?.trim() || ''

/** 地址栏 → 类型（认得的取值） */
export function readResourceType(v?: string | string[]): ResourceTypeFilter {
  const raw = one(v)
  return raw === 'doc' || raw === 'video' ? raw : 'all'
}

/** 类型 + 页码 → 地址（第 2 页起才带 page，保持地址干净） */
export function resourceHref(type: ResourceTypeFilter, page = 1): string {
  const query = new URLSearchParams()
  if (type !== 'all') query.set('type', type)
  if (page > 1) query.set('page', String(page))
  const qs = query.toString()
  return `/resources${qs ? `?${qs}` : ''}`
}
