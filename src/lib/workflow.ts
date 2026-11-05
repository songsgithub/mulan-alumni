/**
 * SOP 流程状态机（与 Payload 解耦，便于未来迁移后端）。
 * 依据《数字木兰校友会互助团SOP-AI豆计划（2026年10月）》的活动链路。
 */

type PlanStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'revision_required'
  | 'implemented'
  | 'closed'

type ReportStatus = 'submitted' | 'accepted' | 'revision_required'

type ReimbursementStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'paid'

/*
 * 状态流转由 src/app/(admin)/(workspace)/actions.ts 的服务端动作逐条校验
 * （每个动作都要同时校验角色、归属与当前状态，一张静态表表达不了归属维度）。
 *
 * 状态文案：**全站唯一来源**（工作台、活动详情、PDF、互助团页都从这里取）。
 * 措辞与审核按钮一致：审核「通过 / 不通过」→ 状态「已通过 / 已驳回」。
 */
export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  draft: '草稿',
  submitted: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  revision_required: '需修改',
  implemented: '已实施',
  closed: '已结项',
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  submitted: '已提交',
  accepted: '已采纳',
  revision_required: '需修改',
}

export const REIMBURSEMENT_STATUS_LABEL: Record<ReimbursementStatus, string> = {
  draft: '草稿',
  submitted: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  // 到账由财务在后台登记，工作台不区分「已通过」与「已到账」
  paid: '已通过',
}

/** 状态的颜色语气（StatusBadge 用）：完成=绿、待处理=紫、驳回=红、未开始=灰 */
export type StatusTone = 'done' | 'active' | 'stop' | 'pending'

/**
 * 活动反馈提交时限（SOP 三、2）：「活动结束后 5 天内，提交《活动反馈表》《活动签到表》」。
 * 返回逾期天数，未逾期为 0。
 */
const REPORT_DEADLINE_DAYS = 5

export const reportOverdueDays = (actualAt: string | Date, submittedAt: string | Date): number => {
  const activityEnd = new Date(actualAt).getTime()
  const submitted = new Date(submittedAt).getTime()
  if (!Number.isFinite(activityEnd) || !Number.isFinite(submitted)) return 0
  const diffDays = Math.floor((submitted - activityEnd) / (24 * 60 * 60 * 1000))
  return diffDays > REPORT_DEADLINE_DAYS ? diffDays : 0
}
