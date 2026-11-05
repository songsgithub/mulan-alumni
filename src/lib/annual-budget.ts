import { COHORT_CATEGORY_LABEL } from '@/lib/labels'
import { getClient } from '@/lib/payload'

/**
 * 年度预算的统计口径（**唯一一处**，页面与动作都走这里）。
 *
 * ## 两个"预算"不是一回事
 *
 * | | 是什么 | 在哪 |
 * | --- | --- | --- |
 * | **活动预算** | 这一场打算花多少 | 活动方案里填，受**单场经费上限**约束 |
 * | **年度预算** | 这个团**一整年**能用多少 | 这里（`cohort-budgets` + `annual-budget-settings`） |
 *
 * ## 规划预算从哪来
 *
 * 1. 该年度的**默认额度**（`annual-budget-settings`：项目组一次统一设定）；
 * 2. 某个团**单独设过**的额度（`cohort-budgets`：覆盖默认值）。
 *
 * 没有单独设过的团，用默认额度。
 *
 * ## 实际执行怎么算
 *
 * = 该团该年度**已核定**的报销金额之和。
 *
 * - 只算 `approved` / `paid` 的报销单：**没闭环的不算**
 *   （草稿、待审核、被驳回的一律不计）；
 * - 金额取**核定金额**（`approvedAmount`），不是申请金额——
 *   核减过的按核减后的算；
 * - 归到哪一年，看**活动日期**（活动方案的计划日期）；没有方案时退回报销单创建时间。
 */
interface AnnualBudgetRow {
  cohortId: number | string
  cohortName: string
  /** 项目类别（加油木兰 / AI豆计划 / 民宿管家）——筛选用 */
  category: string
  /** 项目类别的中文名 */
  categoryLabel: string
  /** 所在城市（筛选用） */
  city: string
  year: number
  /** 年度规划预算（元） */
  planned: number
  /** 实际执行（元）：已核定的报销之和 */
  spent: number
  /** 余额（元）：规划 - 执行 */
  balance: number
  /** 执行率（0–1+）；没设预算时为 null */
  ratio: number | null
  /** 该年度**已开展**的活动场次 */
  activities: number
  /** 该年度的参与人次（已开展活动的实际参与人数之和） */
  participants: number
  /** 人均花费（元）：实际执行 ÷ 参与人次；没有人时为 null */
  perCapita: number | null
  /** 这个团是不是单独设过额度 */
  hasOverride: boolean
  /** 单团备注 */
  note?: string | null
}

interface AnnualBudgetSummary {
  year: number
  /** 这一年度的默认额度（元） */
  defaultAmount: number
  rows: AnnualBudgetRow[]
  totals: {
    planned: number
    spent: number
    balance: number
    ratio: number | null
    /** 单独设过额度的团数 */
    overrideCount: number
    /** 超支的团数 */
    overCount: number
  }
}

/** 归年：优先活动方案的计划日期，没有方案退回创建时间 */
const yearOf = (raw: unknown): number | null => {
  if (!raw) return null
  const d = new Date(String(raw))
  if (Number.isNaN(d.getTime())) return null
  return d.getFullYear()
}

/** 实际执行金额：核定金额优先（核减过的按核减后算），否则退回申请金额 */
const amountOf = (reimbursement: any): number => {
  const approved = Number(reimbursement?.approvedAmount ?? 0)
  if (approved > 0) return approved
  return Number(reimbursement?.total ?? 0) || 0
}

/**
 * 算某一年度的预算与执行情况。
 *
 * @param year 年度
 * @param cohortIds 只算这些团（团长只看自己那个团时用）
 */
export async function computeAnnualBudget(
  year: number,
  cohortIds?: (number | string)[],
): Promise<AnnualBudgetSummary> {
  const payload = await getClient()

  // 1) 互助团清单
  const cohortWhere: any = cohortIds?.length ? { id: { in: cohortIds } } : {}
  const cohortsRes = await payload.find({
    collection: 'cohorts',
    where: cohortWhere,
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const cohorts: any[] = cohortsRes.docs ?? []

  // 2) 该年度的默认额度（项目组统一设定的那一个数）
  const settingsRes = await payload.find({
    collection: 'annual-budget-settings',
    where: { year: { equals: year } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const defaultAmount = Number(settingsRes.docs?.[0]?.defaultAmount ?? 0)

  // 3) 单团覆盖的额度
  const overridesRes = await payload.find({
    collection: 'cohort-budgets',
    where: { year: { equals: year } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const overrideByCohort = new Map<string, any>()
  for (const row of overridesRes.docs ?? []) {
    const id = String((row.cohort as any)?.id ?? row.cohort)
    if (id) overrideByCohort.set(id, row)
  }

  // 4) 实际执行：只算**已核定**的报销（没闭环的不计入）
  const ids = cohorts.map((c) => c.id)
  const spentByCohort = new Map<string, number>()
  if (ids.length) {
    const reimbursementsRes = await payload.find({
      collection: 'reimbursements',
      where: {
        and: [
          { cohort: { in: ids } },
          // 草稿 / 待审核 / 被驳回 —— 一律不计入
          { status: { in: ['approved', 'paid'] } },
        ],
      },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    const reimbursements: any[] = reimbursementsRes.docs ?? []

    // 归年要看活动日期，所以把相关方案取出来
    const planIds = reimbursements
      .map((r) => (r.plan as any)?.id ?? r.plan)
      .filter(Boolean)
      .map((id) => Number(id))
    let planById = new Map<string, any>()
    if (planIds.length) {
      const plansRes = await payload.find({
        collection: 'activity-plans',
        where: { id: { in: planIds } },
        limit: 2000,
        depth: 0,
        overrideAccess: true,
      })
      planById = new Map((plansRes.docs ?? []).map((p: any) => [String(p.id), p]))
    }

    for (const r of reimbursements) {
      const plan = r.plan ? planById.get(String((r.plan as any)?.id ?? r.plan)) : null
      const belongs = yearOf(plan?.plannedAt) ?? yearOf(r.createdAt)
      if (belongs !== year) continue
      const cohortId = String((r.cohort as any)?.id ?? r.cohort)
      if (!cohortId) continue
      spentByCohort.set(cohortId, (spentByCohort.get(cohortId) ?? 0) + amountOf(r))
    }
  }

  // 4b) 活动场次与参与人次（只算**已开展**的：有反馈 = 已开展）
  const activityByCohort = new Map<string, { count: number; people: number }>()
  if (ids.length) {
    const reportsRes = await payload.find({
      collection: 'activity-reports',
      where: { cohort: { in: ids } },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    // 一个活动（方案）只算一次：同一份方案有多条反馈时取最新的一条
    const seenPlans = new Set<string>()
    for (const report of reportsRes.docs ?? []) {
      const cohortId = String((report.cohort as any)?.id ?? report.cohort)
      if (!cohortId) continue
      const planKey = String((report.plan as any)?.id ?? report.plan ?? '')
      if (planKey) {
        if (seenPlans.has(`${cohortId}:${planKey}`)) continue
        seenPlans.add(`${cohortId}:${planKey}`)
      }
      // 归年看**实际开展时间**；没填就退回方案的日期由上层决定，这里用创建时间
      const belongs = yearOf(report.actualAt) ?? yearOf(report.createdAt)
      if (belongs !== year) continue
      const current = activityByCohort.get(cohortId) ?? { count: 0, people: 0 }
      current.count += 1
      current.people += Number(report.actualParticipants ?? 0) || 0
      activityByCohort.set(cohortId, current)
    }
  }

  // 5) 拼成一行一团的表
  const rows: AnnualBudgetRow[] = cohorts.map((cohort) => {
    const key = String(cohort.id)
    const override = overrideByCohort.get(key)
    const planned = override ? Number(override.amount ?? 0) : defaultAmount
    const spent = spentByCohort.get(key) ?? 0
    const activity = activityByCohort.get(key) ?? { count: 0, people: 0 }
    return {
      cohortId: cohort.id,
      cohortName: String(cohort.name ?? ''),
      category: String(cohort.category ?? ''),
      categoryLabel: COHORT_CATEGORY_LABEL[String(cohort.category ?? '')] ?? '未分类',
      city: String(cohort.location?.city ?? ''),
      year,
      planned,
      spent,
      balance: planned - spent,
      ratio: planned > 0 ? spent / planned : null,
      activities: activity.count,
      participants: activity.people,
      perCapita: activity.people > 0 ? spent / activity.people : null,
      hasOverride: Boolean(override),
      note: override?.note ?? null,
    }
  })

  // 6) 汇总
  const plannedTotal = rows.reduce((sum, r) => sum + r.planned, 0)
  const spentTotal = rows.reduce((sum, r) => sum + r.spent, 0)
  return {
    year,
    defaultAmount,
    rows,
    totals: {
      planned: plannedTotal,
      spent: spentTotal,
      balance: plannedTotal - spentTotal,
      ratio: plannedTotal > 0 ? spentTotal / plannedTotal : null,
      overrideCount: rows.filter((r) => r.hasOverride).length,
      overCount: rows.filter((r) => r.planned > 0 && r.spent > r.planned).length,
    },
  }
}

