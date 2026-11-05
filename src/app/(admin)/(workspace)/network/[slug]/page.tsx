import Link from 'next/link'
import { CARD_HOVER } from '@/components/console/kit'
import { cn } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'

import { CreateActivityButton } from '@/components/console/CreateActivityButton'
import { CohortCoverForm } from '@/components/console/CohortCoverForm'
import { CohortProfileEditor } from '@/components/console/CohortProfileEditor'
import { CohortTeamForm } from '@/components/console/CohortTeamForm'
import { EmptyState } from '@/components/console/EmptyState'
import { InviteCohortForm } from '@/components/console/InviteCohortForm'
import { PasswordResetButton } from '@/components/console/PasswordResetButton'
import { isProjectTeam, requireUser } from '@/lib/auth'
import { getClient } from '@/lib/payload'
import { findForUser } from '@/lib/console-data'
import { formatDate, formatPlace, yuan } from '@/lib/format'
import { computeAnnualBudget } from '@/lib/annual-budget'
import { publicCircleUrl } from '@/lib/site-url'
import { COHORT_CATEGORY_LABEL } from '@/lib/labels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/console/PageHeader'
import { PageBackLink } from '@/components/console/PageBackLink'
import { PageHelp } from '@/components/console/PageHelp'
import { StatusBadge, type StatusTone } from '@/components/console/StatusBadge'

export const metadata = { title: '互助团' }

const STATUS_LABEL: Record<string, string> = {
  active: '运行中',
  closed: '已解散',
}

/**
 * 一个互助团的详情页：团的信息、团长、活动，加上项目组的管理动作。
 */
export default async function CircleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const projectTeam = isProjectTeam(user)

  const found = await findForUser<any>(user, 'cohorts', { slug: { equals: slug } })
  const cohort = found[0]
  if (!cohort) notFound()

  const terms: any[] = cohort.leaderTerms ?? []

  // 团长关系受 users.read 限制：看别团时只会拿到 id。
  // 这里单独按 id 取「姓名」用于展示；手机 / 邮箱只给本人与项目组。
  const leaderId = typeof cohort.leader === 'object' && cohort.leader ? cohort.leader.id : cohort.leader
  // 是不是"我自己当团长的这个团"——是的话，活动的位子上给「发起活动」
  const ownCircle = Boolean(leaderId && String(leaderId) === String(user.id))
  const canSeeLeaderContact = projectTeam || ownCircle

  const payload = await getClient()
  const leaderDoc: any = leaderId
    ? await payload.findByID({
        collection: 'users',
        id: leaderId,
        depth: 0,
        overrideAccess: true,
        select: { name: true, phone: true, email: true, joinedAt: true },
      })
    : null
  const leader: any = leaderDoc
    ? {
        id: leaderDoc.id,
        name: leaderDoc.name ?? null,
        phone: canSeeLeaderContact ? (leaderDoc.phone ?? null) : null,
        email: canSeeLeaderContact ? (leaderDoc.email ?? null) : null,
        joinedAt: leaderDoc.joinedAt ?? null,
      }
    : null
  const categoryName = COHORT_CATEGORY_LABEL[cohort.category] ?? cohort.category
  // 所在地：省 / 市 / 区（县）三级
  const place = formatPlace(cohort.location?.province, cohort.location?.city, cohort.location?.district)

  // 本年度预算（规划 / 已执行 / 剩余）——团长在"自己的团"里就能看到
  const budgetYear = new Date().getFullYear()
  const budgetSummary = await computeAnnualBudget(budgetYear, [cohort.id])
  const budget = budgetSummary.rows[0] ?? null

  // 主页大图（公开站同款）：没传就留空，组件里显示渐变占位
  const coverDoc: any = typeof cohort.cover === 'object' && cohort.cover ? cohort.cover : null
  const coverUrl: string | null = coverDoc?.url ?? null

  // 这个团的活动（团长看自己团的；项目组看全部）
  const plans = await findForUser<any>(user, 'activity-plans', { cohort: { equals: cohort.id } })

  // 最新活动排在最上面：按活动本身的日期倒序，同一天按创建时间倒序
  plans.sort((a: any, b: any) => {
    const da = a.plannedAt ? new Date(a.plannedAt).getTime() : 0
    const db = b.plannedAt ? new Date(b.plannedAt).getTime() : 0
    if (da !== db) return db - da
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const planIds = plans.map((p: any) => p.id)
  const reports = planIds.length
    ? await findForUser<any>(user, 'activity-reports', { plan: { in: planIds } })
    : []
  const reimbursements = planIds.length
    ? await findForUser<any>(user, 'reimbursements', { plan: { in: planIds } })
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

  return (
    <div>
      <PageHeader
        title={cohort.name}
        help={
          <PageHelp title="互助团详情">
            <p>这里是一个互助团的全部信息：团的状态、所在地域、团长与骨干成员，以及它办过的每一场活动。</p>
            <p>项目组在这里可以改状态、发团长转移链接、生成密码重置链接。</p>
          </PageHelp>
        }
        meta={
          <>
            <Badge variant="outline">{categoryName}</Badge>
            {cohort.status === 'closed' ? <Badge variant="muted">已解散</Badge> : null}
          </>
        }
        actions={
          <>
            {/* 公开站只展示「公开 + 运行中」的团（与 lib/public-data 同一口径）；否则那边是 404，不给死链 */}
            {cohort.isPublic && cohort.status === 'active' ? (
              <Button
                variant="outline"
                render={<a href={publicCircleUrl(cohort.slug)} target="_blank" rel="noreferrer" />}
              >
                公开主页
                <ArrowUpRight aria-hidden className="size-4 shrink-0 opacity-60" />
              </Button>
            ) : null}
            {/* 主页图 / 地域 / 骨干成员 / 运行状态统一在这里改（第三十五轮 + 第四十一轮） */}
            <CohortProfileEditor
              cohortId={String(cohort.id)}
              name={cohort.name}
              coverUrl={coverUrl}
              location={{
                province: cohort.location?.province ?? '',
                provinceCode: cohort.location?.provinceCode ?? '',
                city: cohort.location?.city ?? '',
                cityCode: cohort.location?.cityCode ?? '',
                district: cohort.location?.district ?? '',
                districtCode: cohort.location?.districtCode ?? '',
              }}
              team={cohort.team ?? {}}
              canEdit={ownCircle || projectTeam}
              status={cohort.status}
              canChangeStatus={projectTeam}
            />
          </>
        }
      />

      {/* 返回在**页面左边**：往回走的方向，和右上角那排「往里走」的操作分开。
          位置放正文区左上（页头留给标题与操作，跟公开站详情页一个做法），
          页头的标题仍从左边缘起排，翻页面时标题不会横着跳一截。 */}
      <div className="mt-5">
        <PageBackLink href="/circles">返回互助团</PageBackLink>
      </div>

      {/* 左：互助团信息　｜　右：活动列表（最新在上） */}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          {/* 团信息：顶部是公开站同款 banner 大图（主页图 / 地域 / 骨干成员统一在页头的「编辑资料」里改） */}
          <Card className="gap-0 overflow-hidden p-0">
            <CohortCoverForm
              cohortId={String(cohort.id)}
              name={cohort.name}
              src={coverUrl}
              canEdit={false}
            />
            <div className="p-4 sm:p-6">
              <h2 className="section-title">团信息</h2>
              <dl className="mt-4 space-y-3">
                {/* 状态放第一行：一眼看到这个团在不在运转，后面的事都看它。
                    只显示文字——改状态在页头的「编辑资料」里（项目组才改得了）。 */}
                <div className="flex items-center justify-between gap-4 border-b border-rule pb-2">
                  <dt className="shrink-0 text-small text-faint">状态</dt>
                  <dd className="text-body text-fg">
                    {STATUS_LABEL[cohort.status] ?? cohort.status}
                  </dd>
                </div>
                <Field label="所在地域" value={place} />
                {/* 年度预算：规划 / 已执行 / 剩余，一行看完（详细数字在「经费」页） */}
                {budget ? (
                  <div className="flex items-baseline justify-between gap-6 border-b border-rule pb-2">
                    <dt className="shrink-0 text-small text-faint">{budgetYear} 年预算</dt>
                    <dd className="min-w-0 flex-1 text-right text-body text-fg">
                      {budget.planned > 0 ? (
                        <>
                          规划 {yuan(budget.planned)}
                          <span className="mx-1.5 text-faint">·</span>
                          已执行 {yuan(budget.spent)}
                          <span className="mx-1.5 text-faint">·</span>
                          <span
                            className={`${
                              budget.planned > 0 && budget.spent > budget.planned
                                ? 'font-semibold text-danger'
                                : 'text-muted'
                            }`}
                          >
                            剩余 {yuan(budget.balance)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">尚未设定</span>
                      )}
                    </dd>
                  </div>
                ) : null}
                <Field label="创建时间" value={formatDate(cohort.createdAt)} />
                {cohort.status === 'closed' ? (
                  <Field label="解散时间" value={formatDate(cohort.dissolvedAt)} />
                ) : null}
                {/* 【关于】也是一行：跟上面几行一样的节奏，不另起一段 */}
                {cohort.description || cohort.theme ? (
                  <div className="flex items-baseline justify-between gap-6 border-b border-rule pb-2">
                    <dt className="shrink-0 text-small text-faint">关于</dt>
                    <dd className="min-w-0 flex-1 text-body leading-8 text-muted">
                      {cohort.description}
                      {cohort.description && cohort.theme ? ' ' : ''}
                      {cohort.theme}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </Card>

          {/* 团长 */}
          <Card className="p-4 sm:p-6">
            <h2 className="section-title">团长</h2>
            <dl className="mt-4 space-y-3">
              {/* 项目组：团长转移放第一行，点一下就把转移链接复制走 */}
              {projectTeam ? (
                <div className="flex items-center justify-between gap-4 border-b border-rule pb-2">
                  <dt className="shrink-0 text-small text-faint">团长转移</dt>
                  <dd className="min-w-0">
                    <InviteCohortForm purpose="transfer-lead" cohortId={cohort.id} plain />
                  </dd>
                </div>
              ) : null}
              <Field label="姓名" value={leader?.name} />
              <Field label="手机号" value={leader?.phone ?? '—'} />
              <Field label="邮箱" value={leader?.email ?? '—'} />
              <Field label="注册时间" value={formatDate(leader?.joinedAt)} />
              {terms.length ? (
                <div className="flex items-baseline justify-between gap-6 border-b border-rule pb-2">
                  <dt className="shrink-0 text-small text-faint">团长任期</dt>
                  <dd className="min-w-0 flex-1 text-body text-muted">
                    {terms.map((term: any, index: number) => {
                      const person = typeof term.user === 'object' && term.user ? term.user : null
                      return (
                        <span key={index} className="block">
                          {person?.name ?? '—'} · {formatDate(term.from)} —{' '}
                          {term.to ? formatDate(term.to) : '至今'}
                        </span>
                      )
                    })}
                  </dd>
                </div>
              ) : null}
              {/* 项目组：忘记密码时给一条重置链接（团长自己设新密码） */}
              {projectTeam && leader ? (
                <div className="flex items-center justify-between gap-4 border-b border-rule pb-2">
                  <dt className="shrink-0 text-small text-faint">重置密码</dt>
                  <dd className="min-w-0">
                    <PasswordResetButton userId={leader.id} userName={leader.name} />
                  </dd>
                </div>
              ) : null}
            </dl>
            {!leader ? <p className="mt-4 text-body text-muted">还没有团长。</p> : null}
          </Card>

          {/* 骨干成员：只填名字（公开站团主页「骨干成员」用的就是这四个）。
              编辑入口统一在页头的「编辑资料」里，这里只读展示。 */}
          <Card className="p-4 sm:p-6">
            <CohortTeamForm values={cohort.team ?? {}} />
          </Card>
        </div>

        {/* 活动 */}
        <Card className="self-start p-4 sm:p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">活动（{plans.length}）</h2>
            {/* 数量已经在标题里，右边不再重复一遍；团长看的是「发起活动」 */}
            {ownCircle ? <CreateActivityButton /> : null}
          </div>

          {plans.length ? (
            <ul className="mt-4 space-y-3">
              {plans.map((plan: any) => {
                const report = reportByPlan.get(plan.id)
                const reimbursement = reimburseByPlan.get(plan.id)
                return (
                  <li key={plan.id}>
                    <Link href={`/activities/${plan.slug}`}>
                      <Card className={cn('block p-4 sm:p-6 hover:border-accent/40', CARD_HOVER)}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-body font-semibold">{plan.title}</p>
                            <p className="mt-1.5 text-label text-faint">
                              {plan.plannedAt ? formatDate(plan.plannedAt) : '待定'} · 预算{' '}
                              {yuan(plan.budgetTotal)}
                              {report?.actualSpending ? ` · 实际支出 ${yuan(report.actualSpending)}` : ''}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {/* 四段进度：申请 → 审核 → 反馈 → 报销。
                                颜色说明走到哪一环（绿 = 已完成，紫 = 正在这一环，
                                灰 = 还没到，红 = 被驳回要改），位置说明是哪一环。 */}
                            <StagePill label="申请" tone={plan.status === 'draft' ? 'pending' : 'done'} />
                            <StagePill label="审核" tone={auditTone(plan.status)} />
                            <StagePill
                              label="反馈"
                              tone={report ? 'done' : plan.status === 'approved' || plan.status === 'implemented' ? 'active' : 'pending'}
                            />
                            <StagePill
                              label="报销"
                              tone={
                                reimbursement
                                  ? 'done'
                                  : report && report.status === 'accepted'
                                    ? 'active'
                                    : 'pending'
                              }
                            />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              compact
              title="这个互助团还没有活动"
              hint="团长发起第一场活动后，这里会按时间倒序排出来。"
            />
          )}
        </Card>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
      <dt className="shrink-0 text-small text-faint">{label}</dt>
      <dd className="text-body text-right text-fg">{value || '—'}</dd>
    </div>
  )
}

function StagePill({ label, tone }: { label: string; tone: StatusTone }) {
  return <StatusBadge status={label} tone={tone} />
}

/**
 * 「审核」这一环的状态色：
 * - 已通过（已通过 / 已实施 / 已结项）→ 绿（done）
 * - 待审核 → 紫（active）：正卡在这一环，等项目组处理
 * - 已驳回 / 需修改 → 红（stop）：要补东西重来
 * - 草稿 → 灰（pending）：还没提交
 */
function auditTone(status: string): StatusTone {
  if (['approved', 'implemented', 'closed'].includes(status)) return 'done'
  if (status === 'submitted') return 'active'
  if (status === 'rejected' || status === 'revision_required') return 'stop'
  return 'pending'
}
