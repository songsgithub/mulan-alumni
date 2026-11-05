/**
 * 活动申请的**版本追溯**。
 *
 * 一份活动申请可能「提交 → 驳回 → 修改 → 再提交」好几轮。原来只留了审批记录，
 * 看不出"上一版写的是什么、这一版改了哪儿、这条审批意见是针对哪一版的"。
 *
 * 做法（数据结构见 collections/ActivityPlans.ts 的 versions / reviews.version）：
 * - **每次提交申请**，把那一刻的申请内容整份快照下来，记成第 N 版（versions[]）；
 * - **每次审批**，在审批记录上记下它审的是第几版（reviews[].version）；
 * - 页面上按版本展示：第 N 版的提交时间与提交人、它的审批结论、与第 N−1 版相比改了什么。
 *
 * 快照只在提交时写、之后不改（集合层只读 + 服务端动作是唯一写入口），所以版本内容就是当时交上去的样子。
 * 本文件是纯函数，客户端与服务端都能用。
 */

interface BudgetRow {
  category: string
  item: string
  description: string
  amount: number
  note: string
}

interface PlanSnapshot {
  theme: string
  kind: string
  form: string
  plannedAt: string
  location: string
  participants: number
  budgetItems: BudgetRow[]
  budgetTotal: number
}

interface PlanVersion {
  no: number
  submittedAt: string
  submitterName: string
  /** null = 版本追溯上线前提交的、内容没有留档的那一版 */
  snapshot: PlanSnapshot | null
}

interface PlanReviewRecord {
  reviewerName: string
  action: string
  comment: string
  at: string
  /** 审的是第几版；旧数据没有版本号时按时间归到当时最新的那一版 */
  version: number
}

interface PlanChange {
  field: string
  before: string
  after: string
}

const text = (v: unknown) => String(v ?? '').trim()
const money = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100

/** 从活动申请文档取出要留档的那部分内容 */
export function snapshotOf(plan: any): PlanSnapshot {
  const budgetItems: BudgetRow[] = (Array.isArray(plan?.budgetItems) ? plan.budgetItems : []).map((row: any) => ({
    category: text(row?.category),
    item: text(row?.item),
    description: text(row?.description),
    amount: money(row?.amount),
    note: text(row?.note),
  }))
  return {
    theme: text(plan?.theme || plan?.title),
    kind: text(plan?.kind),
    form: text(plan?.form),
    plannedAt: plan?.plannedAt ? String(plan.plannedAt).slice(0, 10) : '',
    location: text(plan?.location),
    participants: Number(plan?.participants) || 0,
    budgetItems,
    budgetTotal: money(
      plan?.budgetTotal ?? budgetItems.reduce((sum, row) => sum + row.amount, 0),
    ),
  }
}

/**
 * 读出版本列表（第 1 版在前）。
 * 版本追溯上线前已经提交过的申请没有快照：用当前内容补一个第 1 版
 * （提交之后内容是锁定的，当前内容就是最后一次提交的内容）。
 */
export function planVersions(plan: any): PlanVersion[] {
  const stored: PlanVersion[] = (Array.isArray(plan?.versions) ? plan.versions : [])
    .map((v: any, index: number) => ({
      no: Number(v?.no) || index + 1,
      submittedAt: String(v?.submittedAt ?? ''),
      submitterName: text(v?.submitterName),
      snapshot:
        v?.snapshot && typeof v.snapshot === 'object' ? { ...snapshotOf({}), ...v.snapshot } : null,
    }))
    .sort((a: PlanVersion, b: PlanVersion) => a.no - b.no)
  if (stored.length) return stored
  if (!plan?.submittedAt || plan?.status === 'draft') return []
  return [
    {
      no: 1,
      submittedAt: String(plan.submittedAt),
      submitterName: text(plan.applicantName),
      // 被驳回后内容可能已经改过，当前内容不一定是当时交的那一版：标成"未留档"
      snapshot: plan.status === 'rejected' ? null : snapshotOf(plan),
    },
  ]
}

/** 审批记录（只取"通过 / 不通过"两种结论），并对上版本号 */
function planReviews(plan: any, versions: PlanVersion[] = planVersions(plan)): PlanReviewRecord[] {
  const list = (Array.isArray(plan?.reviews) ? plan.reviews : []).filter(
    (r: any) => r?.action === 'approved' || r?.action === 'rejected',
  )
  return list.map((r: any) => {
    let version = Number(r?.version) || 0
    if (!version) {
      // 旧记录没有版本号：归到审批时间之前最后提交的那一版
      const at = new Date(String(r?.at ?? '')).getTime()
      const before = versions.filter((v) => !at || new Date(v.submittedAt).getTime() <= at)
      version = (before[before.length - 1] ?? versions[versions.length - 1])?.no ?? 1
    }
    return {
      reviewerName: text(r?.reviewerName || r?.reviewer?.name),
      action: String(r?.action),
      comment: text(r?.comment),
      at: String(r?.at ?? ''),
      version,
    }
  })
}

const FORM: Record<string, string> = { offline: '线下', online: '线上', hybrid: '线上线下结合' }
const yuanText = (v: number) => `¥${money(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
const dateText = (v: string) => (v ? v.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, '$1年$2月$3日') : '—')
const rowText = (r: BudgetRow) => `${r.item || r.category}（${r.description || '—'}）${yuanText(r.amount)}`

/** 两版之间改了什么（按《活动申请表》的字段顺序） */
export function diffSnapshots(prev: PlanSnapshot, next: PlanSnapshot): PlanChange[] {
  const changes: PlanChange[] = []
  const field = (label: string, a: string, b: string) => {
    if (a !== b) changes.push({ field: label, before: a || '—', after: b || '—' })
  }
  field('活动主题', prev.theme, next.theme)
  field('活动类别', prev.kind, next.kind)
  field('活动形式', FORM[prev.form] ?? prev.form, FORM[next.form] ?? next.form)
  field('计划活动时间', dateText(prev.plannedAt), dateText(next.plannedAt))
  field('计划活动地点', prev.location, next.location)
  field('预计参与人数', prev.participants ? `${prev.participants} 人` : '', next.participants ? `${next.participants} 人` : '')

  // 预算明细：按「明细项 + 事项说明」配对，分出新增 / 删除 / 金额或备注变化
  const key = (r: BudgetRow) => `${r.category}|${r.item}|${r.description}`
  const before = new Map(prev.budgetItems.map((r) => [key(r), r]))
  const after = new Map(next.budgetItems.map((r) => [key(r), r]))
  for (const [k, r] of after) {
    const old = before.get(k)
    if (!old) changes.push({ field: '预算明细 · 新增', before: '—', after: rowText(r) })
    else if (old.amount !== r.amount || old.note !== r.note) {
      changes.push({
        field: `预算明细 · ${r.item || r.category}`,
        before: `${yuanText(old.amount)}${old.note ? `（${old.note}）` : ''}`,
        after: `${yuanText(r.amount)}${r.note ? `（${r.note}）` : ''}`,
      })
    }
  }
  for (const [k, r] of before) {
    if (!after.has(k)) changes.push({ field: '预算明细 · 删除', before: rowText(r), after: '—' })
  }
  if (prev.budgetTotal !== next.budgetTotal) {
    changes.push({ field: '预算合计', before: yuanText(prev.budgetTotal), after: yuanText(next.budgetTotal) })
  }
  return changes
}

/** 每一版连同它的审批结论与"相对上一版的改动"，最新的在前（页面展示用） */
export interface PlanVersionView extends PlanVersion {
  reviews: PlanReviewRecord[]
  changes: PlanChange[] | null
}

export function planHistory(plan: any): PlanVersionView[] {
  const versions = planVersions(plan)
  const reviews = planReviews(plan, versions)
  return versions
    .map((v, i) => ({
      ...v,
      reviews: reviews.filter((r) => r.version === v.no),
      changes:
        i === 0 || !versions[i - 1].snapshot || !v.snapshot
          ? null
          : diffSnapshots(versions[i - 1].snapshot!, v.snapshot!),
    }))
    .reverse()
}
