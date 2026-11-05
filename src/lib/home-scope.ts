import type { Where } from 'payload'

import { isProjectTeam, type CurrentUser } from '@/lib/auth'
import { findForUser, ownCohortWhere } from '@/lib/console-data'
import { getClient } from '@/lib/payload'
import { matchesRegion } from '@/lib/region-filter'

/**
 * 工作台首页的数据范围：页面（活动 / 图片 / 资金）与图片下载接口共用这一份，
 * 保证两边看到的是同一批活动。
 *
 * ⚠️ Payload 的本地 API 不拦集合读权限，所以团长只看自己担任团长的团，
 * 项目组看不到草稿，都在这里显式处理。
 */

interface HomeFilters {
  year: string
  monthFrom: string
  monthTo: string
  categories: string[]
  provinceCode: string
  cityCode: string
  districtCode: string
  cohort: string
}

type Params = Record<string, string | string[] | undefined>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))

export function readHomeFilters(sp: Params, thisYear: number): HomeFilters {
  return {
    year: one(sp.year) || String(thisYear),
    monthFrom: one(sp.monthFrom),
    monthTo: one(sp.monthTo),
    categories: one(sp.project)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    provinceCode: one(sp.province),
    cityCode: one(sp.city),
    districtCode: one(sp.district),
    cohort: one(sp.circle),
  }
}

/** 统计的时间段 → 起止时间；null = 不限（全部年份） */
function periodRange(year: string, monthFrom: string, monthTo: string) {
  if (!year || year === 'all') return null
  const y = Number(year)
  if (!Number.isFinite(y)) return null

  const from = Number(monthFrom) || 1
  const to = Number(monthTo) || 12
  const startMonth = Math.min(Math.max(from, 1), 12)
  const endMonth = Math.min(Math.max(to, startMonth), 12)
  return {
    start: new Date(y, startMonth - 1, 1),
    end: new Date(y, endMonth, 0, 23, 59, 59),
  }
}

export async function loadHomeScope(user: CurrentUser, f: HomeFilters) {
  const projectTeam = isProjectTeam(user)
  const payload = await getClient()

  const allCohorts = (
    (await payload.find({
      collection: 'cohorts',
      where: projectTeam ? {} : { leader: { equals: user.id } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
      user: user as any,
    })) as { docs: any[] }
  ).docs
  const cohorts = allCohorts.filter((c: any) => {
    if (f.categories.length && !f.categories.includes(c.category)) return false
    if (!matchesRegion(c.location, { provinceCode: f.provinceCode, cityCode: f.cityCode, districtCode: f.districtCode }))
      return false
    if (f.cohort && String(c.id) !== f.cohort) return false
    return true
  })
  const cohortIds = cohorts.map((c: any) => c.id)

  const range = periodRange(f.year, f.monthFrom, f.monthTo)
  const planConds: Where[] = [{ cohort: { in: cohortIds } }]
  if (projectTeam) planConds.push({ status: { not_equals: 'draft' } })
  if (range) {
    // 草稿还没有计划时间（空值），不能被年份 / 月份范围筛掉，否则团长建了却看不见；
    // 草稿照常显示，其余活动仍按计划时间筛选
    planConds.push({
      or: [
        { status: { equals: 'draft' } },
        {
          plannedAt: {
            greater_than_equal: range.start.toISOString(),
            less_than_equal: range.end.toISOString(),
          },
        },
      ],
    })
  }
  const foundPlans = await findForUser<any>(user, 'activity-plans', { and: planConds }, {
    limit: 500,
    depth: 1,
  })
  // 活动日期新的在上；日期相同或缺失时按创建时间倒序
  const plans = foundPlans.slice().sort((a: any, b: any) => {
    const plannedA = a.plannedAt ? new Date(a.plannedAt).getTime() : 0
    const plannedB = b.plannedAt ? new Date(b.plannedAt).getTime() : 0
    if (plannedA !== plannedB) return plannedB - plannedA
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  })

  const planIds = plans.map((p: any) => p.id)
  const reports = planIds.length
    ? await findForUser<any>(user, 'activity-reports', { plan: { in: planIds } }, { limit: 500, depth: 1 })
    : []
  const reimbursements = planIds.length
    ? await findForUser<any>(user, 'reimbursements', { plan: { in: planIds } }, { limit: 500, depth: 1 })
    : []

  const reportByPlan = new Map<number, any>()
  for (const r of reports) {
    const id = r.plan?.id ?? r.plan
    if (id && !reportByPlan.has(id)) reportByPlan.set(id, r)
  }
  const reimburseByPlan = new Map<number, any>()
  for (const r of reimbursements) {
    const id = r.plan?.id ?? r.plan
    if (id && !reimburseByPlan.has(id)) reimburseByPlan.set(id, r)
  }

  return { allCohorts, cohorts, plans, reports, reimbursements, reportByPlan, reimburseByPlan }
}

