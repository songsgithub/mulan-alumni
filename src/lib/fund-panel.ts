import { COHORT_CATEGORIES, COHORT_CATEGORY_LABEL } from '@/lib/labels'

/**
 * 「活动资金」的口径计算（**活动层面**的预算 vs 报销）。
 *
 * ⚠️ 与「年度预算」（团级额度）是**两个口径**，别混：
 * - 这里算的是**每场活动自己申请的预算**加起来，与已核定的报销对比；
 * - 年度预算是项目组给**整个团一整年**的额度（见 `src/lib/annual-budget.ts`）。
 *
 * 两个口径放在一起看才有意义：活动预算总和 vs 年度额度 = 这个团会不会超年度盘子。
 */

interface FundBucket {
  name: string
  /** 活动场次 */
  plans: number
  /** 申请预算合计 */
  budget: number
  /** 已核定的报销合计 */
  approved: number
  /** 已完成报销的活动：预算合计 */
  settledBudget: number
  /** 已完成报销的活动：实际报销合计 */
  settledApproved: number
}

export interface FundPanelData {
  total: FundBucket
  /** 执行率 = 已完成报销活动的实际 ÷ 它们的预算 */
  executionRate: number | null
  /** 结余 = 已完成报销活动的（预算 − 实际）；正数是省下的 */
  savings: number
  /** 已完成报销活动的实际参与人次之和 */
  settledPeople: number
  /** 人均成本 = 已完成报销的实际 ÷ 人次 */
  perPerson: number | null
  /** 待审核的报销（还没核定，不计入执行） */
  pendingQueue: { slug: string; title: string; cohort: string; amount: number; at: string }[]
  pendingAmount: number
  /** 按费用类别：预算 vs 实际 */
  expenseRows: { name: string; budget: number; spend: number }[]
  /** 超出**活动预算**的活动 */
  overBudget: { slug: string; title: string; cohort: string; budget: number; approved: number }[]
  /** 按月 */
  monthRows: { key: string; label: string; title: string; budget: number; approved: number }[]
  /** 按项目类别 */
  categoryRows: { label: string; bucket: FundBucket }[]
  /** 预算最多的十个团 */
  cohortRows: FundBucket[]
}

/** 报销只有「通过」与「不通过」：金额只算通过的 */
const isApprovedReimbursement = (reimbursement: any) =>
  Boolean(reimbursement) && ['approved', 'paid'].includes(reimbursement.status)

const emptyBucket = (name: string): FundBucket => ({
  name,
  plans: 0,
  budget: 0,
  approved: 0,
  settledBudget: 0,
  settledApproved: 0,
})

/** 互助团展示名：带上所在地（团名重名的很多，按名称会并在一起） */
const cohortDisplayName = (cohort: any) => {
  if (!cohort?.id) return '未归属互助团'
  const place = cohort.location?.district || cohort.location?.city || ''
  return [cohort.name, place].filter(Boolean).join(' · ')
}

/** 按月最多画多少个月 */
const MONTH_CHART_LIMIT = 12

export function computeFundPanel({
  plans,
  reimburseByPlan,
  reportByPlan,
}: {
  plans: any[]
  reimburseByPlan: Map<any, any>
  reportByPlan: Map<any, any>
}): FundPanelData {
  const total = emptyBucket('合计')
  const byMonth = new Map<string, { budget: number; approved: number }>()
  const byCategory = new Map<string, FundBucket>()
  const byCohort = new Map<string, FundBucket>()

  const budgetByCategory = new Map<string, number>()
  const spendByCategory = new Map<string, number>()
  const pendingQueue: FundPanelData['pendingQueue'] = []
  const overBudget: FundPanelData['overBudget'] = []
  let pendingAmount = 0
  let settledPeople = 0

  for (const plan of plans) {
    const budget = Number(plan.budgetTotal) || 0
    const reimbursement = reimburseByPlan.get(plan.id)
    const settled = isApprovedReimbursement(reimbursement)
    const approved = settled ? Number(reimbursement.approvedAmount) || 0 : 0

    const add = (bucket: FundBucket) => {
      bucket.plans += 1
      bucket.budget += budget
      bucket.approved += approved
      if (settled) {
        bucket.settledBudget += budget
        bucket.settledApproved += approved
      }
    }

    add(total)

    const category = String(plan.cohort?.category ?? '')
    if (category) {
      if (!byCategory.has(category)) byCategory.set(category, emptyBucket(category))
      add(byCategory.get(category)!)
    }

    const cohortKey = String(plan.cohort?.id ?? 'none')
    if (!byCohort.has(cohortKey)) byCohort.set(cohortKey, emptyBucket(cohortDisplayName(plan.cohort)))
    add(byCohort.get(cohortKey)!)

    if (plan.plannedAt) {
      const month = String(plan.plannedAt).slice(0, 7)
      const entry = byMonth.get(month) ?? { budget: 0, approved: 0 }
      entry.budget += budget
      entry.approved += approved
      byMonth.set(month, entry)
    }

    // 费用类别：预算取活动方案里的《经费支出明细表》，实际取报销单里的
    for (const item of (plan.budgetItems ?? []) as any[]) {
      const key = String(item.category || '其他')
      budgetByCategory.set(key, (budgetByCategory.get(key) ?? 0) + (Number(item.amount) || 0))
    }
    if (!reimbursement) continue
    const title = plan.title || plan.theme || '未命名活动'
    if (reimbursement.status === 'submitted') {
      const amount = Number(reimbursement.total) || 0
      pendingAmount += amount
      pendingQueue.push({
        slug: plan.slug,
        title,
        cohort: cohortDisplayName(plan.cohort),
        amount,
        at: String(reimbursement.updatedAt ?? reimbursement.createdAt ?? ''),
      })
    }
    if (settled) {
      settledPeople += Number(reportByPlan.get(plan.id)?.actualParticipants) || 0
      for (const item of (reimbursement.items ?? []) as any[]) {
        const key = String(item.category || '其他')
        spendByCategory.set(key, (spendByCategory.get(key) ?? 0) + (Number(item.amount) || 0))
      }
      const approvedAmount = Number(reimbursement.approvedAmount) || 0
      if (approvedAmount > budget) {
        overBudget.push({
          slug: plan.slug,
          title,
          cohort: cohortDisplayName(plan.cohort),
          budget,
          approved: approvedAmount,
        })
      }
    }
  }

  pendingQueue.sort((a, b) => a.at.localeCompare(b.at))
  overBudget.sort((a, b) => b.approved - b.budget - (a.approved - a.budget))

  const monthKeys = Array.from(byMonth.keys()).sort().slice(-MONTH_CHART_LIMIT)
  const multiYear = new Set(monthKeys.map((k) => k.slice(0, 4))).size > 1
  const monthRows = monthKeys.map((key) => {
    const [y, m] = key.split('-')
    const entry = byMonth.get(key)!
    return {
      key,
      label: multiYear ? `${y.slice(2)}/${Number(m)}` : `${Number(m)}月`,
      title: `${y} 年 ${Number(m)} 月`,
      budget: entry.budget,
      approved: entry.approved,
    }
  })

  const categoryKeys = Array.from(new Set([...budgetByCategory.keys(), ...spendByCategory.keys()]))
  const expenseRows = categoryKeys
    .map((name) => ({
      name,
      budget: budgetByCategory.get(name) ?? 0,
      spend: spendByCategory.get(name) ?? 0,
    }))
    .sort((a, b) => b.budget + b.spend - (a.budget + a.spend))

  const categoryRows = COHORT_CATEGORIES.map((category) => ({
    label: COHORT_CATEGORY_LABEL[category.value] ?? category.label,
    bucket: byCategory.get(category.value) ?? emptyBucket(category.label),
  }))

  const cohortRows = Array.from(byCohort.values())
    .sort((a, b) => b.budget - a.budget)
    .slice(0, 10)

  return {
    total,
    executionRate:
      total.settledBudget > 0 ? total.settledApproved / total.settledBudget : null,
    savings: total.settledBudget - total.settledApproved,
    settledPeople,
    perPerson: settledPeople > 0 ? total.settledApproved / settledPeople : null,
    pendingQueue,
    pendingAmount,
    expenseRows,
    overBudget,
    monthRows,
    categoryRows,
    cohortRows,
  }
}
