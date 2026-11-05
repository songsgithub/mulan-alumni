import { COHORT_CATEGORY_LABEL } from '@/lib/labels'

/**
 * 经费页的筛选条件（全部写进 URL）。
 *
 * `?year=2026&project=a-idol&state=over&q=杭州`
 *
 * 写进 URL 的理由与通知页 / 资源页一致：
 * 刷新、分享、后退，筛选条件都还在；点"清空筛选"就是回到干净的一条地址。
 */

/** 预算状态筛选 */
type BudgetState = 'all' | 'balance' | 'over' | 'unset' | 'custom'

export interface BudgetFilterValue {
  /** 年度（从 2026 年起） */
  year: number
  /** 项目类别；`all` = 全部 */
  category: string
  /** 预算状态；见 BudgetState */
  state: BudgetState
  /** 团名 / 城市 关键字 */
  q: string
  /** 按哪一列排序；见 BudgetSortField */
  sort: BudgetSortField
  /** 排序方向 */
  dir: 'asc' | 'desc'
}

/** 可排序列 */
export type BudgetSortField =
  | 'name'
  | 'planned'
  | 'spent'
  | 'balance'
  | 'ratio'
  | 'activities'
  | 'participants'
  | 'perCapita'

const BUDGET_SORTABLE_FIELDS: BudgetSortField[] = [
  'name',
  'planned',
  'spent',
  'balance',
  'ratio',
  'activities',
  'participants',
  'perCapita',
]

/** 年度预算从哪一年开始算（之前没有年度预算这件事） */
const BUDGET_FIRST_YEAR = 2026

/** 下拉里给几年：起始年往后 5 年 */
export const BUDGET_YEARS = Array.from(
  { length: 5 },
  (_, i) => BUDGET_FIRST_YEAR + i,
)

export const BUDGET_CATEGORY_OPTIONS = [
  { value: 'all', label: '全部项目' },
  ...Object.entries(COHORT_CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
]

export const BUDGET_STATE_OPTIONS: { value: BudgetState; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'balance', label: '还有余额' },
  { value: 'over', label: '已经超支' },
  { value: 'unset', label: '尚未设额度' },
  { value: 'custom', label: '单独设过额度' },
]

/** 从地址里读筛选条件（不认识的取值一律回落到合法值） */
export function readBudgetFilters(sp: Record<string, string | string[] | undefined>): BudgetFilterValue {
  const one = (key: string) => {
    const raw = sp[key]
    const value = Array.isArray(raw) ? raw[0] : raw
    return String(value ?? '').trim()
  }

  const yearRaw = Number.parseInt(one('year'), 10)
  const year =
    Number.isInteger(yearRaw) && yearRaw >= BUDGET_FIRST_YEAR && yearRaw <= 2100
      ? yearRaw
      : BUDGET_FIRST_YEAR

  const categoryRaw = one('project')
  const category = CATEGORY_VALUES.has(categoryRaw) ? categoryRaw : 'all'

  const stateRaw = one('state') as BudgetState
  const state: BudgetState = BUDGET_STATE_OPTIONS.some((o) => o.value === stateRaw)
    ? stateRaw
    : 'all'

  const sortRaw = one('sort') as BudgetSortField
  const sort: BudgetSortField = BUDGET_SORTABLE_FIELDS.includes(sortRaw) ? sortRaw : 'name'
  const dir: 'asc' | 'desc' = one('dir') === 'desc' ? 'desc' : 'asc'

  return { year, category, state, q: one('q'), sort, dir }
}

const CATEGORY_VALUES = new Set(
  BUDGET_CATEGORY_OPTIONS.map((option) => option.value),
)

/** 生成带筛选条件的地址（默认值不写进地址，地址保持干净） */
export function budgetHref(value: Partial<BudgetFilterValue>): string {
  const merged = { ...readBudgetFilters({}), ...value }
  const params = new URLSearchParams()
  if (merged.year !== BUDGET_FIRST_YEAR) params.set('year', String(merged.year))
  if (merged.category && merged.category !== 'all') params.set('project', merged.category)
  if (merged.state && merged.state !== 'all') params.set('state', merged.state)
  if (merged.q) params.set('q', merged.q)
  // 排序不是"筛选"，但同样写进地址：刷新与分享都保持同一个顺序
  if (merged.sort && merged.sort !== 'name') params.set('sort', merged.sort)
  if (merged.dir === 'desc') params.set('dir', 'desc')
  const query = params.toString()
  return query ? `/budget?${query}` : '/budget'
}

/**
 * 按指定列排序（**服务端排序**：条件在地址里，结果随地址走）。
 *
 * 数字列按数值排（不是字符串，否则 "¥1,000" 会排在 "¥200" 前面）；
 * 值相同的按团名排，顺序稳定。
 */
export function sortBudgetRows<
  T extends {
    cohortName: string
    planned: number
    spent: number
    balance: number
    ratio: number | null
    activities: number
    participants: number
    perCapita: number | null
  },
>(rows: T[], sort: BudgetSortField, dir: 'asc' | 'desc'): T[] {
  const factor = dir === 'desc' ? -1 : 1
  // 空值（没设预算 / 没人可算人均）**永远排最后**，升降序都一样——
  // 它们不是"最大"，不该占最前面的位置。
  const pick = (row: T): { value: number | string; empty: boolean } => {
    switch (sort) {
      case 'planned':
        return { value: row.planned, empty: false }
      case 'spent':
        return { value: row.spent, empty: false }
      case 'balance':
        return { value: row.balance, empty: false }
      case 'ratio':
        return { value: row.ratio ?? 0, empty: row.ratio === null }
      case 'activities':
        return { value: row.activities, empty: false }
      case 'participants':
        return { value: row.participants, empty: false }
      case 'perCapita':
        return { value: row.perCapita ?? 0, empty: row.perCapita === null }
      default:
        return { value: row.cohortName, empty: false }
    }
  }
  return [...rows].sort((a, b) => {
    const va = pick(a)
    const vb = pick(b)
    if (va.empty !== vb.empty) return va.empty ? 1 : -1
    if (va.value === vb.value) return a.cohortName.localeCompare(b.cohortName, 'zh-CN')
    return (va.value > vb.value ? 1 : -1) * factor
  })
}

/** 有没有在筛选（不含年度——年度是这张页的主轴，不算"筛选"） */
export function hasBudgetFilter(value: BudgetFilterValue): boolean {
  return value.category !== 'all' || value.state !== 'all' || Boolean(value.q)
}

/**
 * 按筛选条件过滤预算行（服务端过滤：条件在地址里，结果随地址走）。
 */
export function filterBudgetRows<
  T extends {
    cohortName: string
    city: string
    category: string
    planned: number
    spent: number
    hasOverride: boolean
  },
>(rows: T[], value: BudgetFilterValue): T[] {
  const q = value.q.trim().toLowerCase()
  return rows.filter((row) => {
    if (value.category !== 'all' && row.category !== value.category) return false

    if (value.state === 'balance') {
      if (!(row.planned > 0 && row.spent <= row.planned)) return false
    } else if (value.state === 'over') {
      if (!(row.planned > 0 && row.spent > row.planned)) return false
    } else if (value.state === 'unset') {
      if (row.planned > 0) return false
    } else if (value.state === 'custom') {
      if (!row.hasOverride) return false
    }

    if (q) {
      const haystack = `${row.cohortName} ${row.city}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}
