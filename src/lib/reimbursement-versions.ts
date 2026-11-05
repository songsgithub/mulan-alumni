/**
 * 报销单的**版本追溯**（和活动申请一个思路，见 lib/plan-versions.ts）。
 *
 * 一张报销单可能「提交 → 驳回 → 团长改反馈 → 重新提交」好几轮。
 * 原来每次重新提交都**新建**一张报销单，旧的那张孤零零留在库里，
 * 谁也说不清"上一版报了多少钱、这一版改了什么、这条审核意见针对的是哪一版"。
 *
 * 做法：
 * - 每次提交报销，把那一刻的《经费支出明细表》整份快照下来，记成第 N 版（versions[]）；
 * - 每次审核，在审核记录上记下它审的是第几版（reviews[].version）；
 * - 驳回后重新提交**沿用同一张报销单**（沿用原来的审核记录），只追加新的一版。
 *
 * 快照只在提交时写、之后不改（集合层只读 + 服务端动作是唯一写入口）。
 * 本文件是纯函数，客户端与服务端都能用。
 */

interface ReimbursementRow {
  category: string
  item: string
  description: string
  amount: number
  note: string
}

interface ReimbursementSnapshot {
  items: ReimbursementRow[]
  total: number
  actualSpending: number
  summary: string
}

interface ReimbursementVersion {
  no: number
  submittedAt: string
  submitterName: string
  /** null = 版本追溯上线前提交的、内容没有留档的那一版 */
  snapshot: ReimbursementSnapshot | null
}

interface ReimbursementReviewRecord {
  reviewerName: string
  action: string
  comment: string
  at: string
  /** 审的是第几版；旧数据没有版本号时按时间归到当时最新的那一版 */
  version: number
}

interface ReimbursementChange {
  field: string
  before: string
  after: string
}

const text = (v: unknown) => String(v ?? '').trim()
const money = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100

/** 从报销单文档取出要留档的那部分内容 */
export function reimbursementSnapshotOf(reimbursement: any, report?: any): ReimbursementSnapshot {
  const items: ReimbursementRow[] = (Array.isArray(reimbursement?.items) ? reimbursement.items : []).map(
    (row: any) => ({
      category: text(row?.category),
      item: text(row?.item),
      description: text(row?.description),
      amount: money(row?.amount),
      note: text(row?.note),
    }),
  )
  return {
    items,
    total: money(reimbursement?.total ?? items.reduce((sum, row) => sum + row.amount, 0)),
    actualSpending: money(report?.actualSpending ?? reimbursement?.actualSpending),
    summary: text(report?.summary),
  }
}

/**
 * 读出版本列表（第 1 版在前）。
 * 版本追溯上线前已经提交过的报销单没有快照：用当前内容补一个第 1 版。
 */
function reimbursementVersions(reimbursement: any): ReimbursementVersion[] {
  const stored: ReimbursementVersion[] = (Array.isArray(reimbursement?.versions)
    ? reimbursement.versions
    : []
  )
    .map((v: any, index: number) => ({
      no: Number(v?.no) || index + 1,
      submittedAt: String(v?.submittedAt ?? ''),
      submitterName: text(v?.submitterName),
      snapshot:
        v?.snapshot && typeof v.snapshot === 'object'
          ? { ...reimbursementSnapshotOf({}), ...v.snapshot }
          : null,
    }))
    .sort((a: ReimbursementVersion, b: ReimbursementVersion) => a.no - b.no)
  if (stored.length) return stored
  if (!reimbursement?.submittedAt) return []
  return [
    {
      no: 1,
      submittedAt: String(reimbursement.submittedAt),
      submitterName: text(reimbursement.applicantName),
      snapshot: reimbursementSnapshotOf(reimbursement),
    },
  ]
}

/** 审核记录（只取"通过 / 不通过"两种结论），并对上版本号 */
function reimbursementReviews(
  reimbursement: any,
  versions: ReimbursementVersion[] = reimbursementVersions(reimbursement),
): ReimbursementReviewRecord[] {
  const list = (Array.isArray(reimbursement?.reviews) ? reimbursement.reviews : []).filter(
    (r: any) => r?.action === 'approved' || r?.action === 'rejected',
  )
  return list.map((r: any) => {
    let version = Number(r?.version) || 0
    if (!version) {
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

const yuanText = (v: number) => `¥${money(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
const rowText = (r: ReimbursementRow) => `${r.item || r.category}（${r.description || '—'}）${yuanText(r.amount)}`

/** 两版之间改了什么 */
function diffReimbursementSnapshots(
  prev: ReimbursementSnapshot,
  next: ReimbursementSnapshot,
): ReimbursementChange[] {
  const changes: ReimbursementChange[] = []
  const field = (label: string, a: string, b: string) => {
    if (a !== b) changes.push({ field: label, before: a || '—', after: b || '—' })
  }
  field('实际支出', yuanText(prev.actualSpending), yuanText(next.actualSpending))
  field('活动总结', prev.summary, next.summary)

  const key = (r: ReimbursementRow) => `${r.category}|${r.item}|${r.description}`
  const before = new Map(prev.items.map((r) => [key(r), r]))
  const after = new Map(next.items.map((r) => [key(r), r]))
  for (const [k, r] of after) {
    const old = before.get(k)
    if (!old) changes.push({ field: '费用明细 · 新增', before: '—', after: rowText(r) })
    else if (old.amount !== r.amount || old.note !== r.note) {
      changes.push({
        field: `费用明细 · ${r.item || r.category}`,
        before: `${yuanText(old.amount)}${old.note ? `（${old.note}）` : ''}`,
        after: `${yuanText(r.amount)}${r.note ? `（${r.note}）` : ''}`,
      })
    }
  }
  for (const [k, r] of before) {
    if (!after.has(k)) changes.push({ field: '费用明细 · 删除', before: rowText(r), after: '—' })
  }
  if (prev.total !== next.total) {
    changes.push({ field: '申请金额', before: yuanText(prev.total), after: yuanText(next.total) })
  }
  return changes
}

/** 每一版连同它的审核结论与"相对上一版的改动"，最新的在前 */
export interface ReimbursementVersionView extends ReimbursementVersion {
  reviews: ReimbursementReviewRecord[]
  changes: ReimbursementChange[] | null
}

export function reimbursementHistory(reimbursement: any): ReimbursementVersionView[] {
  const versions = reimbursementVersions(reimbursement)
  const reviews = reimbursementReviews(reimbursement, versions)
  return versions
    .map((v, i) => ({
      ...v,
      reviews: reviews.filter((r) => r.version === v.no),
      changes:
        i === 0 || !versions[i - 1].snapshot || !v.snapshot
          ? null
          : diffReimbursementSnapshots(versions[i - 1].snapshot!, v.snapshot!),
    }))
    .reverse()
}
