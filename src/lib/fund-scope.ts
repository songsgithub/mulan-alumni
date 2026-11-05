import { getClient } from '@/lib/payload'

/**
 * 「活动资金」视图的数据范围（**活动层面**：每场活动申请的预算 vs 已核定的报销）。
 *
 * 与「年度预算」（团级额度）是两个口径，见 `src/lib/fund-panel.ts` 的说明。
 * 筛选条件跟经费页的地址一致：年度 / 项目类别 / 团名关键字 / 团长只看自己团。
 */
interface FundScope {
  plans: any[]
  reimburseByPlan: Map<any, any>
  reportByPlan: Map<any, any>
}

export async function loadFundScope({
  year,
  category,
  q,
  cohortIds,
}: {
  year: number
  /** 项目类别；`all` = 全部 */
  category: string
  /** 团名 / 活动名 / 地点 关键字 */
  q: string
  /** 团长只看自己担任团长的那个团 */
  cohortIds?: (number | string)[]
}): Promise<FundScope> {
  const payload = await getClient()

  const plansRes = await payload.find({
    collection: 'activity-plans',
    where: cohortIds?.length ? { cohort: { in: cohortIds } } : {},
    limit: 1000,
    depth: 1,
    overrideAccess: true,
  })

  const keyword = q.trim().toLowerCase()
  const plans = (plansRes.docs ?? []).filter((plan: any) => {
    // 归年：按活动**计划日期**
    const planned = plan.plannedAt ? new Date(String(plan.plannedAt)) : null
    if (planned && !Number.isNaN(planned.getTime()) && planned.getFullYear() !== year) {
      return false
    }
    if (category && category !== 'all') {
      if (String(plan.cohort?.category ?? '') !== category) return false
    }
    if (keyword) {
      const haystack = [
        plan.title,
        plan.theme,
        plan.location,
        plan.cohort?.name,
        plan.cohort?.location?.district,
        plan.cohort?.location?.city,
      ]
        .filter(Boolean)
        .some((text: any) => String(text).toLowerCase().includes(keyword))
      if (!haystack) return false
    }
    return true
  })

  const planIds = plans.map((p: any) => p.id)
  if (!planIds.length) {
    return { plans, reimburseByPlan: new Map(), reportByPlan: new Map() }
  }

  const [reimbursementsRes, reportsRes] = await Promise.all([
    payload.find({
      collection: 'reimbursements',
      where: { plan: { in: planIds } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'activity-reports',
      where: { plan: { in: planIds } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const reimburseByPlan = new Map<any, any>()
  for (const r of reimbursementsRes.docs ?? []) {
    const id = (r.plan as any)?.id ?? r.plan
    if (id) reimburseByPlan.set(id, r)
  }
  const reportByPlan = new Map<any, any>()
  for (const r of reportsRes.docs ?? []) {
    const id = (r.plan as any)?.id ?? r.plan
    if (id) reportByPlan.set(id, r)
  }

  return { plans, reimburseByPlan, reportByPlan }
}
