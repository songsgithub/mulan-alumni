import { ArrowUpRight } from 'lucide-react'

import { publicActivityUrl } from '@/lib/site-url'

import { ActivityHtml, docCssScoped, type PdfData } from '@/components/pdf/ActivityHtml'
import { ActivityOutline, type OutlineItem } from '@/components/console/ActivityOutline'
import { DocZoom } from '@/components/console/DocZoom'
import { PlanReviewForm } from '@/components/console/PlanReviewForm'
import { ReportReviewForm } from '@/components/console/ReportReviewForm'
import { ReimbursementReviewForm } from '@/components/console/ReimbursementReviewForm'
import { Card } from '@/components/ui/card'

/**
 * 项目组视角：
 * - 左侧直接用与导出 PDF **同一套组件/样式**的 HTML 文档（连续滚动，不分页）；
 * - 中间是「处理」面板，吸顶常驻：四件事——**活动审核**、**活动反馈审核**、**报销审核**；
 * - 右侧是活动进度。
 *
 * 2026-11-03 第五十一轮：流程改成四段
 * （活动申请 → 活动审核 → 活动反馈（采纳）→ 报销审核），
 * 「反馈审核」是独立的一环：采纳即发布到公开站，并推到报销环节。
 */
export function ProjectTeamActivity({
  plan,
  report,
  reimbursement,
  publication,
  data,
  outline,
  canReviewPlan,
  canReviewReport,
  canReviewReimbursement,
  planReviewerName,
  reimbursementReviewerName,
}: {
  plan: any
  report: any
  canReviewPlan: boolean
  canReviewReport: boolean
  canReviewReimbursement: boolean
  planReviewerName: string
  reimbursementReviewerName: string
  reimbursement: any
  publication: any
  data: PdfData
  outline: OutlineItem[]
}) {
  const planSubmitted = plan.status === 'submitted'
  const reportPending = report?.status === 'submitted'
  const reimbursementSubmitted = reimbursement?.status === 'submitted'
  const hasAnyAction = planSubmitted || reportPending || reimbursementSubmitted
  // 当前待审的这一版（最新的在前）
  const current = data.plan.history?.[0]

  return (
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:h-[calc(100dvh-var(--workspace-header-h)-var(--workspace-bar-h)-6rem)] lg:min-h-0 lg:grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] xl:grid-cols-[minmax(0,1fr)_300px_208px]">
      {/* 左：与 PDF 同源的连续文档 */}
      <div className="order-2 min-w-0 lg:order-1 lg:flex lg:min-h-0 lg:flex-col">
        <article className="activity-doc rounded-[1.5rem] border border-rule bg-white px-6 py-10 shadow-card sm:px-12 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <style dangerouslySetInnerHTML={{ __html: docCssScoped() }} />
          <DocZoom>
            <ActivityHtml data={data} collapsible />
          </DocZoom>
        </article>
      </div>

      {/* 中：处理（吸顶） */}
      <aside className="order-1 lg:order-2 lg:sticky lg:top-[var(--workspace-stack-top)] lg:max-h-[calc(100dvh-var(--workspace-stack-top)-1.5rem)] lg:self-start lg:overflow-y-auto">
        <div className="mb-4 hidden lg:block xl:hidden">
          <ActivityOutline items={outline} />
        </div>
        <Card className="p-5">
          <h2 className="section-title">处理</h2>

          {!hasAnyAction && !publication ? (
            <p className="mt-3 text-body text-muted">
              {report ? '当前没有待处理事项。' : '活动反馈提交后，这里会出现报销审核。'}
            </p>
          ) : null}

          {planSubmitted ? (
            <div className="mt-5">
              <h3 className="mb-3 text-body font-semibold text-fg">活动审核</h3>
              {current && current.no > 1 ? (
                <div className="mb-4 rounded-control bg-accent-soft px-4 py-3 text-small text-fg">
                  <p className="font-semibold">这是第 {current.no} 版申请（驳回后重新提交）</p>
                  <p className="mt-1 text-muted">
                    {current.changes === null
                      ? '上一版未留档，无法逐项对比。'
                      : current.changes.length
                        ? `与第 ${current.no - 1} 版相比改了 ${current.changes.length} 处：${current.changes
                            .slice(0, 3)
                            .map((c) => c.field)
                            .join('、')}${current.changes.length > 3 ? ' 等' : ''}`
                        : `与第 ${current.no - 1} 版相比内容没有变化。`}
                  </p>
                  <a href="#review" className="mt-1 inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
                    看逐项对比 →
                  </a>
                </div>
              ) : null}
              {canReviewPlan ? (
                <PlanReviewForm planId={String(plan.id)} />
              ) : (
                <p className="text-body text-muted">
                  由{planReviewerName ? ` ${planReviewerName} ` : '指定的负责人'}审核，你可以查看与打印。
                </p>
              )}
            </div>
          ) : null}

          {reportPending ? (
            <div className="mt-6 border-t border-rule pt-5">
              <h3 className="text-body font-semibold text-fg">活动反馈审核</h3>
              <p className="mt-1 mb-3 text-small text-muted">
                采纳后活动会发布到公开站，并推到报销环节
              </p>
              {canReviewReport ? (
                <ReportReviewForm reportId={String(report.id)} />
              ) : (
                <p className="text-body text-muted">
                  由{planReviewerName ? ` ${planReviewerName} ` : '指定的负责人'}审核，你可以查看与打印。
                </p>
              )}
            </div>
          ) : null}

          {reimbursementSubmitted ? (
            <div className="mt-6 border-t border-rule pt-5">
              <h3 className="text-body font-semibold text-fg">报销审核</h3>
              <p className="mt-1 mb-3 text-small text-muted">核定《经费支出明细表》里的金额</p>
              {canReviewReimbursement ? (
                <ReimbursementReviewForm
                  reimbursementId={String(reimbursement.id)}
                  total={Number(reimbursement.total ?? 0)}
                />
              ) : (
                <p className="text-body text-muted">
                  {reimbursementReviewerName
                    ? `由 ${reimbursementReviewerName} 审核，你可以查看与打印。`
                    : '这张报销单生成时没有指定审核人，不再流转。'}
                </p>
              )}
            </div>
          ) : null}

          {publication ? (
            <div className="mt-6 border-t border-rule pt-5">
              <p className="text-body font-semibold text-success">已发布到公开站</p>
              <a
                href={publicActivityUrl(publication.slug)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-body font-semibold text-accent hover:underline"
              >
                在公开站看
                <ArrowUpRight aria-hidden className="size-4 shrink-0" />
              </a>
            </div>
          ) : null}
        </Card>
      </aside>

      {/* 右：活动进度（宽屏才显示） */}
      <aside className="hidden xl:order-3 xl:sticky xl:top-[var(--workspace-stack-top)] xl:block xl:self-start">
        <ActivityOutline items={outline} />
      </aside>
    </div>
  )
}
