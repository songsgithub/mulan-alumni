import { getActivityRules } from '@/lib/activity-rules'
import { notFound } from 'next/navigation'

import { PageHelp } from '@/components/console/PageHelp'
import { PageBackLink } from '@/components/console/PageBackLink'
import { type OutlineItem } from '@/components/console/ActivityOutline'
import { ActivityPrintDialog } from '@/components/console/ActivityPrintDialog'
import { ActivityProgress } from '@/components/console/ActivityProgress'
import { LeadActivityView } from '@/components/console/LeadActivityView'
import { ProjectTeamActivity } from '@/components/console/ProjectTeamActivity'
import { buildActivityPdfData } from '@/lib/activity-pdf-data'
import { isCohortLead, isProjectTeam, requireUser } from '@/lib/auth'
import { ownCohortWhere } from '@/lib/console-data'
import { FORM_LABEL } from '@/lib/labels'
import { getClient } from '@/lib/payload'

export const metadata = { title: '活动详情' }

/**
 * 活动详情 = 一次活动的完整记录，页面跟着状态推进。
 *
 * 四个环节（与需求一致）：
 * ① 活动申请  团长填写 → 提交 → 待审核；驳回后回到编辑态
 * ② 活动审批  项目组审核（默认通过，不通过必填意见，二次确认）；记录逐条追加
 * ③ 活动反馈  审批通过后团长填写；提交即自动生成报销单
 * ④ 报销审核  项目组一次审核反馈 + 报销：通过即采纳并自动发布到公开站；驳回即退回反馈修改
 *
 * 团长端与项目组端展示同一张《活动申请表》《活动反馈表》，字段与顺序一致。
 */
/** 审核记录里最后一次「通过 / 不通过」的审核人姓名（已完成的审核，用它，不用当前设置） */
function lastReviewerName(reviews: any[] | undefined): string {
  const records = (reviews ?? []).filter((r) => r?.action === 'approved' || r?.action === 'rejected')
  const last = records[records.length - 1]
  if (!last) return ''
  return String(last.reviewerName || last.reviewer?.name || '')
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await requireUser()
  const payload = await getClient()
  const projectTeam = isProjectTeam(user)
  const lead = isCohortLead(user)
  // 活动设置（当前值）：只用于草稿以外的新建判断与审核负责人
  const rules = await getActivityRules(payload)

  const read = async (collection: string, where: any) => {
    try {
      const res = await payload.find({
        collection: collection as any,
        where,
        limit: 10,
        depth: 2,
        user: user as any,
        overrideAccess: false,
      })
      return res.docs ?? []
    } catch {
      return []
    }
  }

  // 团长只看自己那个团的活动（本地 API 不会自动按集合 access 拦，显式过滤）
  const ownWhere = await ownCohortWhere(user)

  let plan: any = null
  try {
    const found = await payload.find({
      collection: 'activity-plans',
      where: { and: [{ slug: { equals: slug } }, ownWhere] },
      limit: 1,
      user: user as any,
      overrideAccess: false,
      depth: 2,
    })
    plan = (found.docs ?? [])[0] ?? null
  } catch {
    plan = null
  }
  if (!plan) notFound()
  // 团长还没提交的草稿，项目组无权查看
  if (projectTeam && plan.status === 'draft') notFound()

  const reports = await read('activity-reports', { plan: { equals: plan.id } })
  const report = reports[0] ?? null
  const reimbursements = await read('reimbursements', { plan: { equals: plan.id } })
  const reimbursement = reimbursements[0] ?? null
  const publications = await read('publications', { relatedPlan: { equals: plan.id } })
  const publication = publications[0] ?? null

  /* ------------------------------------------------------------ 权限与状态 */

  const planStatus: string = plan.status
  const planSubmitted = ['submitted', 'approved', 'rejected', 'implemented', 'closed'].includes(planStatus)
  const planApproved = ['approved', 'implemented', 'closed'].includes(planStatus)
  const reportAccepted = report?.status === 'accepted'

  /* ------------------------------------------------------ 审核人与规则 */

  // 审核人：待审核的，按**当前设置**取（负责人换了，待审核的自动切到新负责人）；
  // 已经完成审核的，只认当时那次审核留下的记录，之后换人不改它。
  const planPending = plan.status === 'submitted'
  const reimbursementPending = reimbursement?.status === 'submitted'
  const reimbursementReviewerName = reimbursementPending
    ? String(reimbursement?.reviewerName ?? '')
    : lastReviewerName(reimbursement?.reviews)
  const planReviewerName = planPending ? rules.planReviewerName : lastReviewerName(plan.reviews)
  const canReviewPlan = projectTeam && planPending && rules.planReviewerId === Number(user.id)
  // ⚠️ 2026-11-03 第五十一轮：报销审核权限按**报销单自己的快照**判，
  //    不看当前设置——生成时没人，这一单就永远不流转（之后设了负责人也不回审）。
  const reimbursementReviewerId = reimbursement?.reviewerId?.id ?? reimbursement?.reviewerId ?? null
  const canReviewReimbursement =
    projectTeam && reimbursementPending && Number(reimbursementReviewerId) === Number(user.id)
  // 活动反馈审核（= 采纳）：由**活动审核负责人**做，这个位置不会被置空
  const reportPending = report?.status === 'submitted'
  const canReviewReport =
    projectTeam && reportPending && rules.planReviewerId === Number(user.id)

  // 上下限：活动**建立时**记下的那一版（快照），之后改设置不影响它
  const planRules = {
    budgetMax: Number(plan.ruleBudgetMax ?? rules.budgetMax),
    participantsMin: Number(plan.ruleParticipantsMin ?? rules.participantsMin),
    // 费用类目树走**当前**设置（不是快照）：清单是"现在允许填什么"的规则，
    // 但历史记录里存的是名称快照，所以改了不影响老数据。
    expenseCategories: rules.expenseCategories,
  }
  // 活动申请：草稿 / 驳回后可由团长编辑（驳回即回到编辑草稿态）
  const canEditPlan = !projectTeam && (planStatus === 'draft' || planStatus === 'rejected')
  // 活动反馈：审批通过后团长填写。
  // ⚠️ 2026-11-03 第五十一轮：反馈提交后等**项目组审核**（采纳 = 审核通过）。
  //    采纳后即发布到公开站，是定案，不能再改；
  //    只有「被退回需补充」才让团长改完重提。
  const canCreateReport = !projectTeam && lead && planStatus === 'approved' && !report
  const canEditReport =
    !projectTeam && lead && Boolean(report) && report.status === 'revision_required'

  /* ------------------------------------------------------------ 环节状态文案 */

  const PLAN_STATE: Record<string, { text: string; tone: 'active' | 'stop' | 'done' | 'pending' }> = {
    draft: { text: '草稿', tone: 'active' },
    submitted: { text: '待审核', tone: 'active' },
    approved: { text: '已通过', tone: 'done' },
    rejected: { text: '已驳回', tone: 'stop' },
    implemented: { text: '已实施', tone: 'done' },
    closed: { text: '已结项', tone: 'done' },
  }
  const planState = PLAN_STATE[planStatus] ?? { text: planStatus, tone: 'pending' as const }

  const approvalState = !planSubmitted
    ? { text: '未提交', tone: 'pending' as const }
    : planApproved
      ? { text: '已通过', tone: 'done' as const }
      : planStatus === 'rejected'
        ? { text: '已驳回', tone: 'stop' as const }
        : { text: '待审核', tone: 'active' as const }

  const reportState = !report
    ? planApproved
      ? { text: '未填写', tone: 'pending' as const }
      : { text: '未开始', tone: 'pending' as const }
    : reportAccepted
      ? { text: '已采纳', tone: 'done' as const }
      : report.status === 'revision_required'
        ? { text: '需修改', tone: 'stop' as const }
        : { text: '待审核', tone: 'active' as const }

  const reimbursementState = !reimbursement
    ? { text: reportAccepted ? '待推送' : '未开始', tone: 'pending' as const }
    : reimbursement.status === 'approved' || reimbursement.status === 'paid'
      ? { text: '已通过', tone: 'done' as const }
      : reimbursement.status === 'rejected'
        ? { text: '已驳回', tone: 'stop' as const }
        : // 生成时没指定审核人 → 这一单不流转（不推送、不进待办）
          reimbursementReviewerId
          ? { text: '待审核', tone: 'active' as const }
          : { text: '待审核（未指定审核人）', tone: 'pending' as const }

  // 界面上一律中文；**地址栏锚点用英文**（#application / #review / #feedback / #reimbursement）
  const outline: OutlineItem[] = [
    { id: 'application', index: '①', title: '活动申请', status: planState.text, tone: planState.tone },
    { id: 'review', index: '②', title: '活动审核', status: approvalState.text, tone: approvalState.tone },
    { id: 'feedback', index: '③', title: '活动反馈', status: reportState.text, tone: reportState.tone },
    {
      id: 'reimbursement',
      index: '④',
      title: '报销审核',
      status: reimbursementState.text,
      tone: reimbursementState.tone,
    },
  ]

  /* ------------------------------------------------------------ 活动申请表数据 */

  const applicationData = {
    cohortName: plan.cohort?.name ?? '',
    theme: plan.theme ?? '',
    kind: plan.kind ?? '',
    formLabel: FORM_LABEL[plan.form] ?? '',
    plannedAt: plan.plannedAt ?? '',
    location: plan.location ?? '',
    participants: plan.participants ?? 0,
    applicantName: plan.applicantName ?? '',
    submittedAt: plan.submittedAt ?? '',
    budgetItems: plan.budgetItems ?? [],
  }

  const reimbursementRecords = (reimbursement?.reviews ?? []).map((r: any) => ({
    reviewerName: r.reviewerName || r.reviewer?.name || '',
    action: r.action,
    comment: r.comment,
    at: r.at,
  }))

  // 项目组：左边是与 PDF 同源的连续文档，中间处理，右侧进度
  if (projectTeam) {
    const pdfData = await buildActivityPdfData(plan, report, reimbursement)
    return (
      <div>
        <ActivityBar slug={plan.slug} title={plan.title} />
        <div className="mt-6 lg:hidden">
          <ActivityProgress items={outline} />
        </div>
        <ProjectTeamActivity
          plan={plan}
          report={report}
          reimbursement={reimbursement}
          publication={publication}
          data={pdfData}
          outline={outline}
          canReviewPlan={canReviewPlan}
          canReviewReport={canReviewReport}
          canReviewReimbursement={canReviewReimbursement}
          planReviewerName={planReviewerName}
          reimbursementReviewerName={reimbursementReviewerName}
        />
      </div>
    )
  }

  const leadPdfData = await buildActivityPdfData(plan, report, reimbursement)

  return (
    <div>
      <ActivityBar slug={plan.slug} title={plan.title} />
      <div className="mt-6 lg:hidden">
        <ActivityProgress items={outline} />
      </div>
      <LeadActivityView
        plan={plan}
        report={report}
        reimbursement={reimbursement}
        pdfData={leadPdfData}
        applicationData={applicationData}
        reimbursementRecords={reimbursementRecords}
        outline={outline}
        canEditPlan={canEditPlan}
        canSubmitPlan={lead}
        canCreateReport={canCreateReport}
        canEditReport={canEditReport}
        planApproved={planApproved}
        reportAccepted={reportAccepted}
        publication={publication}
        rules={planRules}
        applicantName={user.name ?? ''}
      />
    </div>
  )
}


/**
 * 活动页顶栏：返回 + 标题 + 打印（本页弹窗预览）。
 * 桌面吸顶，窄屏不吸顶（顶栏本身已经两行了）。
 *
 * 返回链接跟互助团详情页共用 `PageBackLink`（2026-11-02 第四十一轮）：
 * 两页一个组件、一套说法（← 返回XX），不再一个写「← 活动」一个写「← 互助团」。
 */
function ActivityBar({ slug, title }: { slug: string; title: string }) {
  return (
    <div className="relative -mx-5 flex h-[var(--workspace-bar-h)] items-center border-b border-rule bg-background px-5 md:sticky md:top-[var(--workspace-header-h)] md:z-30 md:-mx-8 md:px-8 xl:-mx-12 xl:px-12">
      <div className="flex w-full items-center gap-4">
        <PageBackLink href="/" className="-my-2 shrink-0">
          返回活动
        </PageBackLink>
        <h1 className="min-w-0 flex-1 truncate font-display text-title leading-tight">{title}</h1>
        <PageHelp title="活动详情">
          <p>一场活动从头到尾都在这一页：方案 → 提交与审批 → 实施与反馈 → 报销与核定（核定通过即自动发布到公开站）。</p>
          <p>页面右侧的进度条是这条流程走到哪一步；点右边的按钮可以直接推进。</p>
          <p>能做什么，取决于你的身份：团长提交与补充，项目组审批与核定。</p>
        </PageHelp>
        <ActivityPrintDialog slug={slug} title={title} />
      </div>
    </div>
  )
}
