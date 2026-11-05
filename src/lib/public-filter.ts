import type { ActivityFilterValue } from '@/components/site/ActivityFilters'

import type { Outcome } from './public-data'

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined

/** 地址栏 → 活动筛选条件（只收认得的值，长度截断） */
export function readActivityFilters(sp: Params): ActivityFilterValue {
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
  return {
    project: one(sp.project)?.slice(0, 40),
    kind: one(sp.kind)?.slice(0, 20),
    region: one(sp.region)?.slice(0, 40),
    from: date(one(sp.from)),
    to: date(one(sp.to)),
    q: one(sp.q)?.slice(0, 50),
  }
}

/** 按条件过滤活动（公开活动量不大，取回后在服务端过滤） */
export function filterOutcomes(list: Outcome[], f: ActivityFilterValue): Outcome[] {
  const q = f.q?.toLowerCase()
  return list.filter((o) => {
    if (f.project && o.category !== f.project) return false
    if (f.kind && o.kind !== f.kind) return false
    if (f.region && ![o.circle?.city, o.location].some((t) => t?.includes(f.region!))) return false
    const day = o.date?.slice(0, 10)
    if (f.from && (!day || day < f.from)) return false
    if (f.to && (!day || day > f.to)) return false
    if (q && ![o.title, o.excerpt, o.circle?.name, o.location].some((t) => t?.toLowerCase().includes(q))) return false
    return true
  })
}

/** 区域选项：互助团所在城市（去重、按拼音排序） */
export function regionOptions(list: Outcome[]): string[] {
  return Array.from(new Set(list.map((o) => o.circle?.city).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b, 'zh'),
  )
}
