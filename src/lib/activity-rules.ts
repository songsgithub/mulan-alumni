import type { Payload } from 'payload'

import { expenseCategoriesFrom, type BudgetCategoryDef } from '@/lib/budget'

/**
 * 活动规则（来自「活动设置」全局配置）。服务端动作与页面共用这一份口径。
 */
interface ActivityRules {
  /** 预算合计上限（元）：《经费预算明细表》合计必须小于等于它 */
  budgetMax: number
  /** 预计参与人数下限（人）：预计人数必须大于等于它；实际人数不限 */
  participantsMin: number
  planReviewerId: number | null
  planReviewerName: string
  reimbursementReviewerId: number | null
  reimbursementReviewerName: string
  /**
   * 费用类目树（一级类别 + 二级明细项），来自设置；
   * 设置为空时回落到内置清单。填写活动方案与反馈时用。
   */
  expenseCategories: BudgetCategoryDef[]
}

const idOf = (value: unknown): number | null => {
  const raw = value && typeof value === 'object' ? (value as { id?: unknown }).id : value
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const nameOf = (value: unknown): string =>
  value && typeof value === 'object' ? String((value as { name?: unknown }).name ?? '') : ''

export async function getActivityRules(payload: Payload): Promise<ActivityRules> {
  const g: any = await payload.findGlobal({
    slug: 'activity-settings' as any,
    depth: 1,
    overrideAccess: true,
  })
  return {
    budgetMax: typeof g?.budgetMax === 'number' ? g.budgetMax : 500,
    participantsMin: typeof g?.participantsMin === 'number' ? g.participantsMin : 1,
    planReviewerId: idOf(g?.planReviewer),
    planReviewerName: nameOf(g?.planReviewer),
    reimbursementReviewerId: idOf(g?.reimbursementReviewer),
    reimbursementReviewerName: nameOf(g?.reimbursementReviewer),
    expenseCategories: expenseCategoriesFrom(g?.expenseCategories),
  }
}
