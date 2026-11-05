import { ArrowUpRight } from 'lucide-react'

import { ActivityOutline, type OutlineItem } from '@/components/console/ActivityOutline'
import { DocZoom } from '@/components/console/DocZoom'
import { ApplicationTable, FeedbackTable, RecordTable } from '@/components/console/ActivityTables'
import { PlanEditor, type ActivityRulesView } from '@/components/console/PlanEditor'
import { ReportForm } from '@/components/console/ReportForm'
import { ActivityIssuePanel, ActivityIssueProvider } from '@/components/console/ActivityIssue'
import { reimbursementHistory } from '@/lib/reimbursement-versions'
import { publicActivityUrl } from '@/lib/site-url'
import {
  docCssScoped,
  PlanHistory,
  ReimbursementHistory,
  reviewStatusOf,
  type PdfData,
} from '@/components/pdf/ActivityHtml'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { yuan } from '@/lib/format'
import { PLAN_STATUS_LABEL, REIMBURSEMENT_STATUS_LABEL, REPORT_STATUS_LABEL } from '@/lib/workflow'

/**
 * 团长视角：**文档就是页面**。
 *
 * 编辑态：字段直接在文档里填 / 选（Word 的感觉）；
 * 查看态：同一份文档只读（与导出的 PDF 同一套版式）。
 * 保存 / 提交 / 发起报销 / 提名这些动作在中间的「处理」面板，不占文档位置。
 */
export function LeadActivityView({
  plan,
  report,
  reimbursement,
  pdfData,
  applicationData,
  reimbursementRecords,
  outline,
  canEditPlan,
  canSubmitPlan,
  canCreateReport,
  canEditReport,
  planApproved,
  reportAccepted,
  publication,
  rules,
  applicantName,
}: {
  plan: any
  report: any
  reimbursement: any
  pdfData: PdfData | null
  applicationData: any
  reimbursementRecords: any[]
  outline: OutlineItem[]
  canEditPlan: boolean
  canSubmitPlan: boolean
  canCreateReport: boolean
  canEditReport: boolean
  planApproved: boolean
  reportAccepted: boolean
  publication: any
  rules: ActivityRulesView
  applicantName?: string
}) {
  const hasAnyAction = canEditPlan || canCreateReport || canEditReport || Boolean(publication)
  void reportAccepted

  return (
    <ActivityIssueProvider>
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:h-[calc(100dvh-var(--workspace-header-h)-var(--workspace-bar-h)-6rem)] lg:min-h-0 lg:grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] xl:grid-cols-[minmax(0,1fr)_300px_208px]">
      {/* 左：文档（编辑态与查看态是同一份） */}
      <article className="activity-doc order-2 min-w-0 rounded-[1.5rem] border border-rule bg-white px-6 py-10 shadow-card sm:px-12 lg:order-1 lg:min-h-0 lg:overflow-y-auto">
        <style dangerouslySetInnerHTML={{ __html: docCssScoped() }} />
        <DocZoom>

        {/* 文档抬头（2026-11-02 第三十八轮重排）：三行，各管一件事——
            ① 活动主题（这份文件讲的是哪场活动）
            ② 活动立项与结项记录（这份文件的固定名称）
            ③ 活动编号（唯一编号，纸质材料归档靠它对得上系统里的记录） */}
        <header className="text-center">
          <h1>{plan.title}</h1>
          <p className="doc-kind">活动立项与结项记录</p>
          {pdfData?.activityNo ? <p className="doc-no">活动编号：{pdfData.activityNo}</p> : null}
        </header>

        <DocSection id="application" no="一" title="活动申请">
          {canEditPlan ? (
            <PlanEditor
              plan={plan}
              editable
              canSubmit={canSubmitPlan}
              rules={rules}
              cohortName={plan.cohort?.name}
              applicantName={applicantName}
            />
          ) : (
            <ApplicationTable plan={applicationData} />
          )}
        </DocSection>

        <DocSection id="review" no="二" title="活动审核">
          {pdfData?.plan.history?.length ? (
            <>
              <h3 className="caption">（一）版本与审核记录</h3>
              <PlanHistory history={pdfData.plan.history} collapsible />
            </>
          ) : (
            <p className="py-6 text-center text-muted">提交活动申请后，这里记录每一版申请与审核结论。</p>
          )}
        </DocSection>

        <DocSection id="feedback" no="三" title="活动反馈">
          {canCreateReport || canEditReport ? (
            <ReportForm
              report={canEditReport ? report : undefined}
              budgetItems={(plan.budgetItems ?? []) as any}
              categories={rules.expenseCategories}
              plans={[
                {
                  id: plan.id,
                  title: plan.title,
                  slug: plan.slug,
                  cohortId: plan.cohort?.id ?? plan.cohort,
                },
              ]}
              defaultPlanId={String(plan.id)}
            />
          ) : report ? (
            <FeedbackTable report={report} />
          ) : (
            <p className="py-6 text-center text-muted">
              {planApproved ? '活动办完后在这里填写反馈。' : '活动审核通过后即可填写。'}
            </p>
          )}
        </DocSection>

        <DocSection
          id="reimbursement"
          no="四"
          title="报销审核"
         
        >
          {reimbursement ? (
            <>
              <div className="flex flex-wrap gap-x-10 gap-y-2 border-b border-rule pb-3 text-body">
                <span className="text-muted">
                  申请金额
                  <span className="ml-2 font-semibold text-fg">{yuan(reimbursement.total)}</span>
                </span>
                <span className="text-muted">
                  核定金额
                  <span className="ml-2 font-semibold text-fg">
                    {yuan(reimbursement.approvedAmount)}
                  </span>
                </span>
              </div>
              <div className="mt-4">
                {reimbursementHistory(reimbursement).length ? (
                  <>
                    <h3 className="caption">（一）版本与审核记录</h3>
                    <ReimbursementHistory history={reimbursementHistory(reimbursement)} collapsible />
                  </>
                ) : (
                  <RecordTable
                    caption="（一）审核记录"
                    records={reimbursementRecords}
                    empty="还没有审核记录。"
                  />
                )}
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-muted">
              {report
                ? '反馈已提交，报销已自动进入审核。'
                : '提交活动反馈后，报销会自动提交，不需要单独发起。'}
            </p>
          )}
        </DocSection>

        {/* 表尾落款（第三十八轮）：互助团名称 + 打印时间（只显示时间本身，不带「打印时间：」前缀） */}
        <div className="signature">
          <p>{pdfData?.plan?.cohortName || '数字木兰校友会互助团'}</p>
          <p>{pdfData?.generatedAt ?? ''}</p>
        </div>

        {pdfData?.receipts?.length ? (
          <section className="appendix">
            <h2 className="appendix-title">附件：票据（{pdfData.receipts.length} 张）</h2>
            <div className="receipts">
              {pdfData.receipts.map((receipt, index) => (
                <figure key={index}>
                  {receipt.kind === 'image' && receipt.src ? (
                    <img src={receipt.src} alt={`票据 ${index + 1}`} />
                  ) : (
                    <div className="receipt-pdf">
                      <strong>PDF 票据</strong>
                      <span>{receipt.name}</span>
                    </div>
                  )}
                  <figcaption>
                    票据 {index + 1} · {receipt.item}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}
        </DocZoom>
      </article>

      {/* 中：处理 */}
      <aside className="order-1 lg:order-2 lg:sticky lg:top-[var(--workspace-stack-top)] lg:max-h-[calc(100dvh-var(--workspace-stack-top)-1.5rem)] lg:self-start lg:overflow-y-auto">
        <div className="mb-4 hidden lg:block xl:hidden">
          <ActivityOutline items={outline} />
        </div>
        <Card className="p-5">
          <h2 className="section-title">处理</h2>

          {!hasAnyAction ? (
            <p className="mt-3 text-body text-muted">当前没有待处理事项。</p>
          ) : null}

          {canEditPlan ? (
            <div className="mt-4 space-y-3">
              <p className="text-small text-muted">当前步骤：活动申请</p>
              <Button
                type="submit"
                form="activity-plan-form"
                name="intent"
                value="save"
                variant="outline"
                className="w-full justify-center"
              >
                保存草稿
              </Button>
              {canSubmitPlan ? (
                <Button
                  type="submit"
                  form="activity-plan-form"
                  name="intent"
                  value="submit"
                  className="w-full justify-center"
                >
                  提交活动申请
                </Button>
              ) : null}
            </div>
          ) : null}

          {canEditReport && report?.revisionNote ? (
            <div className="mt-4 rounded-control bg-danger-soft p-4">
              <p className="text-small font-semibold text-danger">报销未通过，请按意见修改反馈</p>
              <p className="mt-1 text-body whitespace-pre-wrap text-fg">{report.revisionNote}</p>
            </div>
          ) : null}

          {canCreateReport || canEditReport ? (
            <div className="mt-4">
              <p className="mb-3 text-small text-muted">
                当前步骤：活动反馈（提交后自动生成报销单）
              </p>
              <Button type="submit" form="activity-report-form" className="w-full justify-center">
                {canEditReport ? '重新提交反馈' : '提交活动反馈'}
              </Button>
            </div>
          ) : null}

          {publication ? (
            <div className="mt-4 rounded-control bg-success-soft p-4">
              <p className="font-semibold text-success">报销已通过，活动已发布到公开站</p>
              <a
                href={publicActivityUrl(publication.slug)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent hover:underline"
              >
                在公开站看
                <ArrowUpRight aria-hidden className="size-4 shrink-0" />
              </a>
            </div>
          ) : null}

          {/* 提交结果与失败原因都放这儿（不再塞在左边的申请表下面） */}
          <ActivityIssuePanel scope="plan" />
          <ActivityIssuePanel scope="report" />
        </Card>
      </aside>

      {/* 右：活动进度 */}
      <aside className="hidden xl:order-3 xl:sticky xl:top-[var(--workspace-stack-top)] xl:block xl:self-start">
        <ActivityOutline items={outline} />
      </aside>
    </div>
    </ActivityIssueProvider>
  )
}

/**
 * 文档的一个章节。
 *
 * 2026-11-01 第三十六轮：**标题只留标题**——
 * 原来标题后面跟着一个状态徽标（如「已实施」），两套信息挤在一行，
 * 而且章节标题下还画着一条横线，页面显得碎。
 * 状态改在右侧「活动进度」那条线上看（那里本来就是完整的状态链）。
 */
function DocSection({
  id,
  no,
  title,
  children,
}: {
  id: string
  no: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-36">
      <div className="section-head">
        <h2>
          {no}、{title}
        </h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

const PLAN_STATUS: Record<string, string> = PLAN_STATUS_LABEL
const REPORT_STATUS: Record<string, string> = REPORT_STATUS_LABEL
const REIMBURSE_STATUS: Record<string, string> = REIMBURSEMENT_STATUS_LABEL
