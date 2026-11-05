import React from 'react'

import { expenseDetailText } from '@/lib/budget'
import { formatDateCN, formatDateTimeCN, formatActualTime, yuan } from '@/lib/format'
import { PLAN_STATUS_LABEL, REIMBURSEMENT_STATUS_LABEL } from '@/lib/workflow'
import type { PlanVersionView } from '@/lib/plan-versions'
import type { ReimbursementVersionView } from '@/lib/reimbursement-versions'

/**
 * 活动材料（HTML 版，由 Chromium 打印成 PDF）。
 *
 * 取向：**公文式**——宋体正文、加大字号、四节（一、二、三、四）分节，
 * 表单与明细表都用全框线，结尾落款；纯白底，不用任何色块。
 */

export interface PdfData {
  /** 活动编号（第三十六轮）：地址里的那段随机串，唯一且对外可查 */
  activityNo?: string
  plan: {
    title: string
    kind?: string
    slug: string
    status?: string
    cohortName: string
    theme: string
    formLabel: string
    plannedAt?: string
    location?: string
    participants?: number
    applicantName?: string
    submittedAt?: string
    budgetTotal?: number
    budgetItems?: any[]
    /** 版本与审核记录（最新的版本在前），见 lib/plan-versions.ts */
    history?: PlanVersionView[]
    /** 存档版：最后一次活动审核通过（第三十六轮） */
    finalReview?: { at: string; reviewerName: string; comment: string }
  }
  report?: {
    theme?: string
    /** 反馈提交时间（第三十六轮） */
    submittedAt?: string
    location?: string
    actualAt?: string
    actualStart?: string
    actualEnd?: string
    summary?: string
    highlights?: string
    photos?: { src: string; alt: string }[]
    expenseItems?: any[]
    expenseTotal?: number
    attendees?: any[]
    status?: string
  }
  reimbursement?: {
    status?: string
    total?: number
    approvedAmount?: number
    reviews?: { reviewerName?: string; action?: string; comment?: string; at?: string }[]
    /** 版本与审核记录（像活动申请那样） */
    history?: ReimbursementVersionView[]
    /** 存档版：最后一次报销核定通过（第三十六轮） */
    finalApproval?: { at: string; reviewerName: string; comment: string }
  }
  receipts?: { kind: 'image' | 'pdf'; src?: string; name: string; item: string; note?: string }[]
  generatedAt: string
}

const PLAN_STATUS: Record<string, string> = PLAN_STATUS_LABEL
const REIMBURSE_STATUS: Record<string, string> = REIMBURSEMENT_STATUS_LABEL

const CN_NUM = ['一', '二', '三', '四', '五', '六']

/**
 * 输出一个值，空的用 fallback。
 *
 * ⚠️ **日期要单独处理**（2026-11-01 第三十六轮踩到）：
 * Payload 取出来的 date 字段有时是 **Date 对象**（depth > 0 的深层关系里），
 * 直接 `String(value)` 会得到 `2026-10-31T16:15:42.038Z` 这种原始 ISO 串——
 * 打印出来像一串乱码，纸质材料上根本没法看。
 * 所以这里先判断是不是日期，是就按中文格式渲染。
 */
const isDateLike = (value: unknown): value is Date | string => {
  if (value instanceof Date) return true
  if (typeof value !== 'string') return false
  // ISO 时间串（含日期与时间）才算；普通文本不算
  return /^\d{4}-\d{2}-\d{2}T/.test(value.trim())
}

const fmt = (value: unknown, fallback = '—') => {
  if (isDateLike(value)) {
    const text = formatDateTimeCN(value as string | Date)
    return text || fallback
  }
  const text = String(value ?? '').trim()
  return text || fallback
}

/**
 * 活动材料正文。
 *
 * ⚠️ `collapsible`（2026-11-03 第五十一轮）：**页面**传 true → 历史版本与驳回记录收起来，
 *    只显示最新结论；**导出的 PDF 不传**（保持全部铺开，打印版式一个字都不改）。
 */
export function ActivityHtml({
  data,
  collapsible = false,
}: {
  data: PdfData
  collapsible?: boolean
}) {
  const { plan, report, reimbursement, receipts = [] } = data
  const history = plan.history ?? []
  const reimburseRecords = reimbursement?.reviews ?? []
  const budgetItems = plan.budgetItems ?? []
  const expenseItems = report?.expenseItems ?? []
  const attendees = report?.attendees ?? []
  const photos = report?.photos ?? []

  // 四节按存在情况编号（公文式：一、二、三、四）
  const sections: { key: string; title: string; status?: string; body: React.ReactNode }[] = []

  sections.push({
    key: 'application',
    title: '活动申请',
    status: plan.status ? PLAN_STATUS[plan.status] : undefined,
    body: (
      <>
        <table className="fields">
          <tbody>
            <tr>
              <th>互助团名称</th>
              <td className="nowrap">{fmt(plan.cohortName)}</td>
              <th>活动形式</th>
              <td>{fmt(plan.formLabel)}</td>
            </tr>
            <tr>
              <th>活动主题</th>
              <td colSpan={3}>{fmt(plan.theme)}</td>
            </tr>
            <tr>
              <th>活动类别</th>
              <td colSpan={3}>{fmt(plan.kind)}</td>
            </tr>
            <tr>
              <th>计划活动时间</th>
              <td>{fmt(plan.plannedAt ? formatDateCN(plan.plannedAt) : '')}</td>
              <th>计划活动地点</th>
              <td>{fmt(plan.location)}</td>
            </tr>
            <tr>
              <th>预计参与人数</th>
              <td>{fmt(plan.participants ? `${plan.participants} 人` : '')}</td>
              <th>申报人</th>
              <td className="nowrap">{fmt(plan.applicantName)}</td>
            </tr>
            <tr>
              <th>申报时间</th>
              <td colSpan={3}>
                {fmt(plan.submittedAt ? formatDateTimeCN(plan.submittedAt) : '')}
              </td>
            </tr>
          </tbody>
        </table>

        {budgetItems.length ? (
          <Sub title="（一）经费预算明细表">
            <BudgetTable items={budgetItems} />
          </Sub>
        ) : null}
      </>
    ),
  })

  if (history.length || plan.finalReview) {
    sections.push({
      key: 'review',
      title: '活动审核',
      status: reviewStatusOf(plan.status),
      body: plan.finalReview ? (
        // 存档版：只留最后一次审核通过（不管中间驳回重提的过程）
        <Sub title="（一）最终审核结论">
          <table className="fields">
            <tbody>
              <tr>
                <th>审核结论</th>
                <td>审核通过</td>
                <th>审核人</th>
                <td className="nowrap">{fmt(plan.finalReview.reviewerName)}</td>
              </tr>
              <tr>
                <th>审核时间</th>
                <td colSpan={3}>
                  {fmt(plan.finalReview.at ? formatDateTimeCN(plan.finalReview.at) : '')}
                </td>
              </tr>
              {plan.finalReview.comment ? (
                <tr>
                  <th>审核意见</th>
                  <td colSpan={3} className="justify preserve">
                    {fmt(plan.finalReview.comment)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Sub>
      ) : (
        <Sub title="（一）版本与审核记录">
          <PlanHistory history={history} collapsible={collapsible} />
        </Sub>
      ),
    })
  }

  if (report) {
    sections.push({
      key: 'feedback',
      title: '活动反馈',
      status: '已提交',
      body: (
        <>
          <table className="fields">
            <tbody>
              <tr>
                <th>活动主题</th>
                <td colSpan={3}>{fmt(report.theme)}</td>
              </tr>
              <tr>
                <th>活动开展时间</th>
                <td>{fmt(formatActualTime(report.actualAt, report.actualStart, report.actualEnd))}</td>
                <th>活动开展地点</th>
                <td>{fmt(report.location)}</td>
              </tr>
              <tr>
                <th>实际参与人数</th>
                <td colSpan={3}>{attendees.filter((row: any) => row.signed).length} 人（与签到人数一致）</td>
              </tr>
              <tr>
                <th>活动总结</th>
                <td colSpan={3} className="justify">
                  {fmt(report.summary)}
                </td>
              </tr>
              <tr>
                <th>活动感受</th>
                <td colSpan={3} className="justify preserve">
                  {fmt(report.highlights)}
                </td>
              </tr>
              {/* 反馈时间（2026-11-01 第三十六轮）：以提交活动反馈的时间为准 */}
              <tr>
                <th>反馈时间</th>
                <td colSpan={3}>{fmt(report.submittedAt)}</td>
              </tr>
            </tbody>
          </table>

          {photos.length ? (
            // ⚠️ 分页控制（第三十八轮之二起，之五改）：
            //    照片按「版心高固定分 2 份」排版，**一页放两张**，
            //    所以照片区**不再强制另起一页**——
            //    强制另起会留下一页大半空白（上一版第 4 页用了 114.8mm 就断页，
            //    后面全空），而照片本来就是正文的一部分，顺着上一节排更自然。
            //
            //    仍然必须保证的是：**标题要和第一张图待在同一页**。
            //
            //    之前的写法有两个坑：
            //      ① 标题（h3.caption）与 .photos 是兄弟元素，
            //         标题的 break-after:avoid 只绑得住第一张 figure，
            //         分页时标题留在页尾、图整体跳到下一页 → 标题独占一页、下面全空；
            //      ② .sub 上加 break-before:page 只能保证「从新页开始」，
            //         不能保证「标题不与图分离」。
            //
            //    解法：把标题**放进** .photos 容器里，
            //    再由打印脚本用 JS 把标题与第一张 figure 包进同一个
            //    .photos-head 容器（break-inside:avoid）——
            //    即标题与第一张图构成一个不可分割单元。
            //    （照片区整体不能加 break-inside:avoid：照片比一页高，
            //      那样浏览器无法拆分，会把前面的正文挤走。）
            <div className="sub photos-block">
              <div className="photos">
                <h3 className="caption photos-title">（一）活动照片（{photos.length} 张）</h3>
                {photos.map((photo, index) => (
                  <figure key={index}>
                    <img src={photo.src} alt={photo.alt || `活动照片 ${index + 1}`} />
                    <figcaption>
                      {photo.alt ? `照片 ${index + 1} · ${photo.alt}` : `照片 ${index + 1}`}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          {expenseItems.length ? (
            <Sub title="（二）经费支出明细表">
              <ExpenseTable items={expenseItems} budgetItems={budgetItems} />
            </Sub>
          ) : null}

          {attendees.length ? (
            <Sub title="（三）活动签到表" keep={attendees.length <= 8}>
              <AttendeeTable attendees={attendees} />
            </Sub>
          ) : null}

        </>
      ),
    })
  }

  if (reimbursement) {
    sections.push({
      key: 'reimbursement',
      title: '报销审核',
      status: reimbursement.status ? REIMBURSE_STATUS[reimbursement.status] : undefined,
      body: (
        <>
          <table className="fields">
            <tbody>
              <tr>
                <th>申请金额</th>
                <td>{yuan(Number(reimbursement.total ?? 0))}</td>
                <th>核定金额</th>
                <td>{yuan(Number(reimbursement.approvedAmount ?? 0))}</td>
              </tr>
            </tbody>
          </table>

          {reimbursement.finalApproval ? (
            // 存档版：只留最后一次核定通过
            <Sub title="（一）最终核定结论">
              <table className="fields">
                <tbody>
                  <tr>
                    <th>核定结论</th>
                    <td>核定通过</td>
                    <th>核定人</th>
                    <td className="nowrap">{fmt(reimbursement.finalApproval.reviewerName)}</td>
                  </tr>
                  <tr>
                    <th>核定时间</th>
                    <td colSpan={3}>
                      {fmt(
                        reimbursement.finalApproval.at
                          ? formatDateTimeCN(reimbursement.finalApproval.at)
                          : '',
                      )}
                    </td>
                  </tr>
                  {reimbursement.finalApproval.comment ? (
                    <tr>
                      <th>核定意见</th>
                      <td colSpan={3} className="justify preserve">
                        {fmt(reimbursement.finalApproval.comment)}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </Sub>
          ) : reimbursement?.history?.length ? (
            <Sub title="（一）版本与审核记录">
              <ReimbursementHistory history={reimbursement.history} collapsible={collapsible} />
            </Sub>
          ) : reimburseRecords.length ? (
            <Sub title="（一）审核记录">
              <RecordTable records={reimburseRecords} />
            </Sub>
          ) : null}
        </>
      ),
    })
  }

  return (
    <div className="doc">
      {/* 文档抬头（2026-11-02 第三十八轮重排）：三行，各管一件事——
          ① 活动主题（这份文件讲的是哪场活动）
          ② 活动立项与结项记录（这份文件的固定名称）
          ③ 活动编号（唯一编号，纸质材料归档靠它对得上系统里的记录） */}
      <header className="doc-head">
        <h1>{fmt(plan.title)}</h1>
        <p className="doc-kind">活动立项与结项记录</p>
        {data.activityNo ? <p className="doc-no">活动编号：{data.activityNo}</p> : null}
      </header>

      {sections.map((section, index) => (
        // id 与右侧「活动进度」的锚点一致（见 ActivityOutline）；scroll-mt 让跳转后标题不被吸顶栏挡住
        <section id={section.key} className="section scroll-mt-36" key={section.key}>
          {/* 章节标题只留标题（第三十六轮）：状态不再跟在标题后面，
              状态在「活动进度」那条线上看；标题下也不再画横线。 */}
          <div className="section-head">
            <h2>
              {CN_NUM[index]}、{section.title}
            </h2>
          </div>
          {section.body}
        </section>
      ))}

      {/* 表尾落款（第三十八轮）：互助团名称 + 打印时间（只显示时间本身，不带「打印时间：」前缀） */}
      <div className="signature">
        <p>{fmt(plan.cohortName) || '数字木兰校友会互助团'}</p>
        <p>{fmt(data.generatedAt)}</p>
      </div>

      {receipts.length ? (
        <section className="appendix">
          <h2 className="appendix-title">附件：票据（{receipts.length} 张）</h2>
          <div className="receipts">
            {receipts.map((receipt, index) => (
              <figure key={index}>
                {receipt.kind === 'image' && receipt.src ? (
                  <img src={receipt.src} alt={`票据 ${index + 1}`} />
                ) : (
                  <div className="receipt-pdf">
                    <strong>PDF 票据</strong>
                    <span>{fmt(receipt.name)}</span>
                  </div>
                )}
                <figcaption>
                  票据 {index + 1} · {fmt(receipt.item)}
                  {receipt.note ? ` · ${fmt(receipt.note)}` : ''}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Sub({
  title,
  children,
  keep,
  pageBreak,
}: {
  title: string
  children: React.ReactNode
  keep?: boolean
  /** 另起一页（票据这类整页大图） */
  pageBreak?: boolean
}) {
  const className = ['sub', keep ? 'keep' : '', pageBreak ? 'page-break' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={className}>
      <h3 className="caption">{title}</h3>
      {children}
    </div>
  )
}

function BudgetTable({ items }: { items: any[] }) {
  const total = items.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const share = (amount?: number) =>
    total > 0 ? `${(((Number(amount) || 0) / total) * 100).toFixed(1)}%` : '—'
  return (
    <table className="data">
      <thead>
        <tr>
          <th>序号</th>
          <th>费用类别</th>
          <th>预算明细</th>
          <th>金额</th>
          <th>占比</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row, index) => (
          <tr key={index}>
            {/* data-label：窄屏页面把表格摊成卡片时，字段名顶在值上方（2026-11-03 第五十一轮） */}
            <td className="center" data-label="序号">
              {index + 1}
            </td>
            <td className="nowrap" data-label="费用类别">
              {fmt(row.category)}
            </td>
            <td className="left" data-label="预算明细">
              {expenseDetailText(row) || '—'}
            </td>
            <td className="num" data-label="金额">
              {yuan(row.amount)}
            </td>
            <td className="num" data-label="占比">
              {share(row.amount)}
            </td>
          </tr>
        ))}
        <tr className="total">
          <td colSpan={3} className="center">
            合计
          </td>
          <td className="num" data-label="金额合计">
            {yuan(total)}
          </td>
          <td className="num" data-label="占比合计">
            100%
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function ExpenseTable({ items, budgetItems = [] }: { items: any[]; budgetItems?: any[] }) {
  const total = items.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  // 按明细文字去预算明细里找同一笔的预算金额（参考值）
  const budgetOf = (item: string) => {
    const hit = budgetItems.find((b: any) => b?.item && expenseDetailText(b) === item)
    return hit ? Number(hit.amount) || 0 : 0
  }
  return (
    <table className="data">
      <thead>
        <tr>
          <th>序号</th>
          <th>费用类别</th>
          <th>实际支出明细</th>
          <th>金额</th>
          <th>预算金额</th>
          <th>凭证</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row, index) => {
          const detail = expenseDetailText(row)
          return (
            <tr key={index}>
              {/* data-label：窄屏页面把表格摊成卡片时，字段名顶在值上方（2026-11-03 第五十一轮） */}
              <td className="center" data-label="序号">
                {index + 1}
              </td>
              <td className="nowrap" data-label="费用类别">
                {fmt(row.category)}
              </td>
              <td className="left" data-label="实际支出明细">
                {detail || '—'}
              </td>
              <td className="num" data-label="金额">
                {yuan(row.amount)}
              </td>
              <td className="num" data-label="预算金额">
                {budgetOf(detail) ? yuan(budgetOf(detail)) : '—'}
              </td>
              <td className="center" data-label="凭证">
                {row.receipt ? '已附' : '未附'}
              </td>
            </tr>
          )
        })}
        <tr className="total">
          <td colSpan={3} className="center">
            合计
          </td>
          <td className="num" data-label="金额合计">
            {yuan(total)}
          </td>
          <td colSpan={2} />
        </tr>
      </tbody>
    </table>
  )
}

function AttendeeTable({ attendees }: { attendees: any[] }) {
  return (
    <table className="data">
      <colgroup>
        <col style={{ width: '22%' }} />
        <col style={{ width: '34%' }} />
        <col style={{ width: '28%' }} />
        <col style={{ width: '16%' }} />
      </colgroup>
      <thead>
        <tr>
          <th>姓名</th>
          <th>工作单位</th>
          <th>工作职位</th>
          <th>签到</th>
        </tr>
      </thead>
      <tbody>
        {attendees.map((row, index) => (
          <tr key={index}>
            <td className="center">{fmt(row.name)}</td>
            <td>{fmt(row.organization)}</td>
            <td>{fmt(row.position)}</td>
            <td className="center">{row.signed ? '已签到' : '未签到'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RecordTable({
  records,
}: {
  records: { reviewerName?: string; action?: string; comment?: string; at?: string }[]
}) {
  return (
    <table className="data">
      {/*
        不写 colgroup：table-layout:auto 下，百分比列宽只是「建议值」，
        Chromium 仍会尽量遵守，于是「审核人」列固定在 16%（≈25mm），
        「数字木兰项目组」七个字放不下就断成三行。
        去掉后由浏览器按内容分配，名字列自然够宽。
      */}
      <thead>
        <tr>
          <th>审核人</th>
          <th>审核结果</th>
          <th>审核意见</th>
          <th>审核时间</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record, index) => (
          <tr key={index}>
            {/* data-label：窄屏页面把表格摊成卡片时，字段名顶在值上方（2026-11-03 第五十一轮） */}
            <td className="center" data-label="审核人">
              {fmt(record.reviewerName)}
            </td>
            <td className="center" data-label="审核结果">
              {record.action === 'approved' ? '审核通过' : '审核不通过'}
            </td>
            <td className="left" data-label="审核意见">
              {fmt(record.comment)}
            </td>
            <td className="center nowrap" data-label="审核时间">
              {record.at ? formatDateTimeCN(record.at) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** 「活动审核」一节的状态：跟着申请的当前状态走（不是看第一条记录） */
export const reviewStatusOf = (status?: string): string | undefined => {
  if (status === 'submitted') return '待审核'
  if (status === 'rejected') return '已驳回'
  if (status && ['approved', 'implemented', 'closed'].includes(status)) return '已通过'
  return undefined
}

/**
 * 版本与审核记录：每一版一个小节（最新的在前）——
 * 第 N 版的提交时间与提交人、针对这一版的审核结论，以及与上一版相比改了什么。
 * 页面（团长 / 项目组）与导出的 PDF 共用这一份。
 *
 * ⚠️ 2026-11-03 第五十一轮：`collapsible` = **只给页面用**。
 *    页面上默认只显示**最新一版**的结论，**有驳回记录的历史版本收起来**，
 *    要看细节得主动点开；导出的 PDF 行为不变（`collapsible` 不传 = 全部铺开）。
 */
export function PlanHistory({
  history,
  collapsible = false,
}: {
  history: PlanVersionView[]
  /** 页面：收起历史版本，只显示最新结论；PDF：全部铺开 */
  collapsible?: boolean
}) {
  if (collapsible && history.length > 1) {
    const latest = history[0]
    const older = history.slice(1)
    const hasRejected = older.some((v) =>
      (v.reviews ?? []).some((r) => r.action === 'rejected'),
    )
    return (
      <div className="versions">
        <VersionBlock version={latest} isLatest />
        {older.length ? (
          <details className="version-collapse">
            <summary>
              {hasRejected ? '历史版本与驳回记录（已收起）' : '历史版本（已收起）'}
              <span className="version-collapse-count">共 {older.length} 版</span>
            </summary>
            {older.map((version) => (
              <VersionBlock key={version.no} version={version} />
            ))}
          </details>
        ) : null}
      </div>
    )
  }
  return (
    <div className="versions">
      {history.map((version, index) => (
        <VersionBlock key={version.no} version={version} isLatest={index === 0} />
      ))}
    </div>
  )
}

/** 一版申请：抬头（提交时间 / 提交人 / 结论）+ 这一版的审核记录 + 与上一版的逐项对比 */
function VersionBlock({
  version,
  isLatest = false,
}: {
  version: PlanVersionView
  isLatest?: boolean
}) {
  const latest = version.reviews[version.reviews.length - 1]
  const result = latest
    ? latest.action === 'approved'
      ? '审核通过'
      : '审核不通过'
    : isLatest
      ? '待审核'
      : '未审核'
  return (
    <div className="version">
      <p className="version-head">
        <strong>第 {version.no} 版</strong>
        <span>提交：{version.submittedAt ? formatDateTimeCN(version.submittedAt) : '—'}</span>
        <span>提交人：{fmt(version.submitterName)}</span>
        <span>结论：{result}</span>
      </p>
      {version.reviews.length ? <RecordTable records={version.reviews} /> : null}
      {version.no > 1 ? (
        version.changes === null ? (
          <p className="version-note">上一版内容在版本追溯上线前提交，未留档，无法逐项对比。</p>
        ) : version.changes.length === 0 ? (
          <p className="version-note">与第 {version.no - 1} 版相比，申请内容没有变化。</p>
        ) : (
          <table className="data version-diff">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '39%' }} />
              <col style={{ width: '39%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>与第 {version.no - 1} 版相比</th>
                <th>第 {version.no - 1} 版</th>
                <th>第 {version.no} 版</th>
              </tr>
            </thead>
            <tbody>
              {version.changes.map((change, index) => (
                <tr key={index}>
                  <td className="left">{change.field}</td>
                  <td className="left">{change.before}</td>
                  <td className="left">{change.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </div>
  )
}

/**
 * 报销单的「版本与审核记录」：每一版一个小节（最新的在前）——
 * 第 N 版的提交时间与提交人、针对这一版的审核结论，以及与上一版相比改了什么。
 * 和活动申请的「版本与审核记录」一个路子。
 *
 * ⚠️ 2026-11-03 第五十一轮：`collapsible` 语义同 `PlanHistory`
 *    （页面收起历史版本；PDF 不受影响）。
 */
export function ReimbursementHistory({
  history,
  collapsible = false,
}: {
  history: ReimbursementVersionView[]
  collapsible?: boolean
}) {
  if (collapsible && history.length > 1) {
    const latest = history[0]
    const older = history.slice(1)
    const hasRejected = older.some((v) =>
      (v.reviews ?? []).some((r) => r.action === 'rejected'),
    )
    return (
      <div className="versions">
        <ReimbursementVersionBlock version={latest} isLatest />
        {older.length ? (
          <details className="version-collapse">
            <summary>
              {hasRejected ? '历史版本与驳回记录（已收起）' : '历史版本（已收起）'}
              <span className="version-collapse-count">共 {older.length} 版</span>
            </summary>
            {older.map((version) => (
              <ReimbursementVersionBlock key={version.no} version={version} />
            ))}
          </details>
        ) : null}
      </div>
    )
  }
  return (
    <div className="versions">
      {history.map((version, index) => (
        <ReimbursementVersionBlock key={version.no} version={version} isLatest={index === 0} />
      ))}
    </div>
  )
}

/** 一版报销：抬头 + 这一版的审核记录 + 与上一版的逐项对比 */
function ReimbursementVersionBlock({
  version,
  isLatest = false,
}: {
  version: ReimbursementVersionView
  isLatest?: boolean
}) {
  const latest = version.reviews[version.reviews.length - 1]
  const result = latest
    ? latest.action === 'approved'
      ? '审核通过'
      : '审核不通过'
    : isLatest
      ? '待审核'
      : '未审核'
  return (
    <div className="version">
      <p className="version-head">
        <strong>第 {version.no} 版</strong>
        <span>提交：{version.submittedAt ? formatDateTimeCN(version.submittedAt) : '—'}</span>
        <span>提交人：{fmt(version.submitterName)}</span>
        <span>结论：{result}</span>
      </p>
      {version.reviews.length ? <RecordTable records={version.reviews} /> : null}
      {version.no > 1 ? (
        version.changes === null ? (
          <p className="version-note">上一版内容在版本追溯上线前提交，未留档，无法逐项对比。</p>
        ) : version.changes.length === 0 ? (
          <p className="version-note">与第 {version.no - 1} 版相比，报销内容没有变化。</p>
        ) : (
          <table className="data version-diff">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '39%' }} />
              <col style={{ width: '39%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>与第 {version.no - 1} 版相比</th>
                <th>第 {version.no - 1} 版</th>
                <th>第 {version.no} 版</th>
              </tr>
            </thead>
            <tbody>
              {version.changes.map((change, index) => (
                <tr key={index}>
                  <td className="left">{change.field}</td>
                  <td className="left">{change.before}</td>
                  <td className="left">{change.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </div>
  )
}

/**
 * 公文式样式（2026-11-02 第三十八轮按 GB/T 9704-2012《党政机关公文格式》重排）。
 *
 * 版心：A4 210×297mm，上白边 15mm、下白边 15mm、左右白边各 17mm
 *      → 版心 176mm × 267mm（页边距在打印路由的 page.pdf({margin}) 里给）
 *      ⚠️ 左右没按公文的 28/26mm：这份材料是「活动立项与结项记录**表**」，
 *         表格是主体而非纯文稿。四列（标签 + 内容 ×2）按内容算至少要 170.6mm，
 *         硬套 156mm 会让日期被断成两行，反而更不像正式材料。
 *      ⚠️ 上下白边从公文的 37/35mm **收紧到 15/15mm**（2026-11-02 第三十八轮之五，
 *         用户要求「页面上下边距也要调小」）——版心高因此从 225mm 放宽到 267mm，
 *         页面能装的行数由 22 行变成约 26 行（行距本身没动，仍是 28.9pt）。
 * 字号：正文三号 16pt，文件标题二号 22pt，表格四号 14pt
 * 行距：固定值 28.9pt（公文口径 225mm 版心 ÷ 22 行；本版心高 267mm，一页约 26 行）
 *
 * 字体：**全站统一用 Noto Serif SC**（网站现用的正文字体，public/fonts/ 里已有）。
 * 不另引入公文的仿宋/黑体/楷体：
 *   - 好处：页面版与 PDF 版**字形完全一致**，不必维护两套字；Noto 是屏幕优化字体，
 *     小字更清楚（受众 27–55 岁）；仓库不增体积。
 *   - 层级靠**编号 + 字号 + 真字重**区分：文件标题 22pt Bold / 一级标题 16pt Bold /
 *     二级标题 16pt 常规（带「（一）」编号）/ 正文 16pt 常规。
 *   - ⚠️ Noto Serif SC 有**真实的 Bold 字重**（regular + bold 两个文件），
 *     所以 font-weight:700 不会触发合成粗体——合成粗体在 PDF 里会落成 Type3 位图路径。
 */
export const docCss = (baseUrl: string) => `
  /* ---------- 字体（与网站正文同款：Noto Serif SC） ---------- */
  @font-face {
    font-family: "NotoSerifSC";
    src: url("${baseUrl}/fonts/noto-serif-sc-regular.ttf") format("truetype");
    font-weight: 400;
    font-display: block;
  }
  @font-face {
    font-family: "NotoSerifSC";
    src: url("${baseUrl}/fonts/noto-serif-sc-bold.ttf") format("truetype");
    font-weight: 700;
    font-display: block;
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    /* 正文：三号 16pt */
    font-family: "NotoSerifSC", "Songti SC", serif;
    color: #000000;
    background: #ffffff;
    font-size: 16pt;
    /* 行距固定值：225mm 版心排 22 行，每行 28.9pt */
    line-height: 28.9pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    line-break: strict;
  }

  .doc { background: #ffffff; }

  /* ---------- 标题 ---------- */
  .doc-head { text-align: center; }
  /* 文件标题：二号 22pt，加粗 */
  h1 {
    margin: 0;
    font-family: "NotoSerifSC", "Songti SC", serif;
    font-size: 22pt;
    line-height: 36pt;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  /* 文档名称：抬头第二行，固定文案「活动立项与结项记录」 */
  .doc-kind {
    margin: 12pt 0 0;
    font-family: "NotoSerifSC", "Songti SC", serif;
    font-size: 16pt;
    line-height: 28.9pt;
    font-weight: 400;
    letter-spacing: 0.3em;
    text-indent: 0.3em;
  }
  /* 活动编号：抬头第三行，右对齐；纸质材料归档靠它对得上系统里的记录 */
  .doc-no {
    margin: 6pt 0 0;
    font-family: "NotoSerifSC", "Songti SC", serif;
    font-size: 12pt;
    line-height: 24pt;
    color: #333333;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  /* ---------- 章节 ---------- */
  .section { margin-top: 18pt; }
  /* 章节标题（第三十六轮）：不再画标题下方的横线，只留标题本身 */
  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 14pt;
    margin-bottom: 10pt;
    break-after: avoid;
  }
  /* 一级标题（一、二、三）：三号 16pt 加粗（靠真字重拉开与正文的层级） */
  .section-head h2 {
    margin: 0;
    font-family: "NotoSerifSC", "Songti SC", serif;
    font-size: 16pt;
    line-height: 28.9pt;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .status { font-size: 16pt; color: #000000; }

  /* ---------- 表单（全框线） ---------- */
  /**
   * table-layout 用 auto（2026-11-02 第三十八轮）：
   * 之前写死 table-layout: fixed + 百分比列宽，于是「计划活动时间」这类
   * 六字标签在 156mm 版心下被挤到 26.5mm，而 nowrap 又不让它换行——
   * 结果是**标签自己断成两行**，日期也跟着断。
   * 改成 auto 后，浏览器按内容实际需要分配列宽：标签列拿到够放六个字的宽度，
   * 富余的宽度归给内容列（日期、地点这类长文本）。
   * ⚠️ 156mm 是**曾经**的版心宽；现在左右白边收到 17mm，版心 176mm，
   *    标签列与日期列才有足够宽度不换行。
   */
  table.fields { width: 100%; border-collapse: collapse; table-layout: auto; }
  table.fields th, table.fields td {
    border: 0.6pt solid #000000;
    /* 横向内边距压到 6pt：4 列（标签 + 内容 ×2）时 9pt 会吃掉约 25mm，
       把内容列压到放不下专名的宽度（「万山AI豆计划互助团」被拆成两行）。 */
    padding: 4pt 6pt;
    font-size: 14pt;
    line-height: 22pt;
    vertical-align: middle;
  }
  table.fields th {
    /* 标签列：不定死宽度，交给 table-layout:auto 按内容分配 */
    background: #ffffff;
    color: #000000;
    /* 表头：加粗 */
    font-family: "NotoSerifSC", "Songti SC", serif;
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
  }
  table.fields td {
    text-align: left;
    line-height: 22pt;
    /* 中文地址按语义边界断行：line-break:strict 会在「号」「路」这类
       词边界断开，不会把「微工厂」拆成「微工」+「厂」。 */
    line-break: strict;
    word-break: normal;
    overflow-wrap: break-word;
  }
  /* 专名（团名、人名、审核人）不折行——「万山AI豆计划互」+「助团」很难看。
     长地址与长文本不在此列，仍按需换行。 */
  table.fields td.nowrap { white-space: nowrap; }

  /* ---------- 子节 ---------- */
  .sub { margin-top: 0; }
  .sub.keep { break-inside: avoid; }
  .sub.page-break { break-before: page; }
  /* 二级标题（（一）（二））：三号 16pt 常规，靠「（一）」编号与正文的段落间距区分 */
  .caption {
    margin: 14pt 0 6pt;
    font-family: "NotoSerifSC", "Songti SC", serif;
    font-size: 16pt;
    line-height: 28.9pt;
    font-weight: 400;
    color: #000000;
    break-after: avoid;
  }

  /* ---------- 数据表（全框线） ---------- */
  /* table-layout: auto 同上：数据表列多（预算表 6 列），写死百分比会把
     「费用类别」「费用项目」这些中文列挤到换行。交给浏览器按内容分配。 */
  table.data { width: 100%; border-collapse: collapse; table-layout: auto; }
  table.data thead { display: table-header-group; }
  table.data th, table.data td {
    border: 0.6pt solid #000000;
    /* 横向内边距压到 5pt（2026-11-02 第三十八轮）：
       费用明细表有 7 列，176mm 版心下 8pt 内边距要吃掉约 40mm，
       「活动场地与布置」这类 7 字中文标签列只剩 25mm，必然断行。 */
    padding: 4pt 5pt;
    font-size: 14pt;
    line-height: 22pt;
    vertical-align: middle;
  }
  table.data thead th {
    background: #ffffff;
    /* 表头：加粗 */
    font-family: "NotoSerifSC", "Songti SC", serif;
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
  }  table.data td { text-align: center; }
  table.data tr { break-inside: avoid; }
  table.data tr.total td { font-family: "NotoSerifSC", "Songti SC", serif; font-weight: 700; }
  /**
   * 反馈表：整表尽量不拆页。
   *
   * 只有 tr 级 break-inside:avoid 时，表格跨页会在末尾**孤立一行**
   * （实测第 4 页只剩「反馈时间」一行，空白 97%）。
   * 反馈表行数不多、整体高度可控，整表避免分页更划算。
   */
  table.fields { break-inside: avoid; }
  /* auto 布局下「序号」列会被内容撑宽，给个上限；其余列按内容自然分配 */
  table.data th:first-child, table.data td:first-child { width: 8%; white-space: nowrap; }
  /* 数字列（金额、占比、预算金额、凭证）不折行——数字被折成两行很难读 */
  table.data .num { white-space: nowrap; }
  /* 中文短标签（费用类别、费用项目）不折行——「活动场地与布」+「置」很难看。
     这些列本身不长，允许它们把富余宽度占住，剩下的宽度给长文本列。 */
  table.data td.nowrap { white-space: nowrap; }

  /* ---------- 版本与审核记录 ---------- */
  .version { margin-top: 10pt; break-inside: avoid; }
  .version + .version { margin-top: 16pt; }
  .version-head {
    display: flex; flex-wrap: wrap; gap: 4pt 16pt;
    margin: 0 0 6pt; font-size: 14pt;
    line-height: 22pt;
  }
  /* 三级标题（版本号）：加粗。Noto Serif SC 有真实 Bold 字重，不会合成粗体 */
  .version-head strong {
    font-family: "NotoSerifSC", "Songti SC", serif;
    font-weight: 700;
  }
  .version-note { margin: 6pt 0 0; font-size: 14pt; line-height: 22pt; color: #333333; }
  table.version-diff { margin-top: 6pt; }

  /* 历史版本收起（2026-11-03 第五十一轮）：
     只在**页面**上出现（页面传 collapsible），导出的 PDF 不传 → 这段样式用不上，
     PDF 版式与从前完全一致。 */
  .version-collapse { margin-top: 12pt; }
  .version-collapse > summary {
    cursor: pointer;
    list-style: none;
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 4pt 12pt;
    padding: 8pt 12pt;
    border: 1px solid #d9d4e6;
    border-radius: 6pt;
    background: #f7f5fc;
    font-size: 14pt; line-height: 22pt; color: #333333;
  }
  .version-collapse > summary::-webkit-details-marker { display: none; }
  .version-collapse > summary::before {
    content: "▸";
    display: inline-block;
    margin-right: 6pt;
    color: #6b4ae6;
  }
  .version-collapse[open] > summary::before { content: "▾"; }
  /**
   * 「共 N 版」这行小字。
   *
   * ⚠️ 必须显式给 background: transparent（2026-11-04）：
   * 页面上的文档区（.activity-doc）有一条 !important 的白底规则会命中它，
   * 于是这行小字在浅紫的收起条上变成**一个突兀的白块**。
   * 加上 transparent 之后它就跟着收起条一起是浅紫底。
   */
  .version-collapse-count {
    color: #6b6b6b;
    font-size: 13pt;
    background: transparent !important;
    margin-left: auto;
  }
  .version-collapse > .version { margin-top: 10pt; }

  .left { text-align: left !important; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .center { text-align: center; }
  .nowrap { white-space: nowrap; }
  .justify { text-align: justify; }
  .preserve { white-space: pre-wrap; }

  /* ---------- 图片：与版心同宽，高度按原图比例（不裁剪） ---------- */
  /**
   * 图片尺寸是**算出来的**，不是写死的（2026-11-02 第三十八轮）。
   *
   * 兜底样式（页面预览态、脚本未跑时）：**满宽 + 高度自适应**，
   * 即 width: 100%; height: auto —— 浏览器按原图比例算高度，不裁剪、不拉伸。
   *
   * 打印时由打印脚本按同一规则算出精确像素值写进**行内样式**
   * （行内样式优先于这里的兜底样式），
   * 见 src/app/(print)/activities/[slug]/print/pdf/route.ts 的「图片排版」。
   *
   * ⚠️ 打印口径的演进：
   *    - 第三十八轮：按「一页放 N 张」分组，每张压到版心宽的一半
   *      （实测只有 80~89mm 宽，看着像缩略图）；
   *    - 第三十八轮之二：改回**满宽 + 等比高度**（但满宽大图一页只放得下一张）；
   *    - 第三十八轮之五：**固定分高度为 2 份**，一页两张，
   *      图在槽位里等比缩放（宽 147~163mm，仍是宽幅大图），不裁剪、不变形；
   *    - 第四十轮：**满宽 176mm + 等高 + 不裁剪**（用户要「都是宽屏的图片」
   *      与「两份等高度图片」，并明说「可以压缩高度变形」）——
   *      同一份材料里所有图用同一个高度，object-fit 用 fill 铺满设定框。
   */
  .photos { display: block; }
  /**
   * 照片区标题：与**第一张图**绑成一体。
   *
   * ⚠️ 这里**不能只靠 break-after:avoid**——Chromium 分页时
   * 「标题 + 满宽大图」绑不住：实测标题留在页尾、整张图跳到下一页，
   * 出现「标题独占一页、下面全空」。
   * 真正可靠的是打印脚本里用 JS 把标题与第一张 figure 包进
   * 一个 .photos-head 容器（见打印路由的「照片标题绑定」步骤）。
   */
  .photos-title { break-after: avoid; page-break-after: avoid; }
  /**
   * 标题 + 第一张图的绑定容器（由打印脚本注入）。
   * 作为不可分割整体分页：要么同页，要么整组下移。
   */
  .photos-head { break-inside: avoid; page-break-inside: avoid; }
  /**
   * ⚠️ 照片区**不能**整体 break-inside: avoid——
   * 照片区常常比一页还高（多张图按版心算就是好几页），
   * 一旦禁止整体分页，浏览器会把前面的正文挤到上一页末尾，
   * 凭空多出一页大半空白（实测第 4 页只用 78mm 就断页）。
   * 只在 **figure 级别**禁止分页：保证「一张图 + 它的说明文字」不拆开。
   */
  .photos figure {
    /* 下边距 12pt → **6pt**（2026-11-02 第三十八轮之五）：
       两个槽位加起来必须 ≤ 版心高（267mm），边距大一点就会把第二张图挤到下一页。 */
    margin: 0 0 6pt;
    break-inside: avoid;
    page-break-inside: avoid;
    /* 图片按脚本算好的尺寸居中放；**顶部对齐**，不垂直平分——
       否则图会浮在页面中间、下面留一大片白。 */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
  }
  /**
   * 图与说明文字必须待在同一页。
   * break-inside: avoid 只加在 figure 上时，**图片本身**（被脚本改过尺寸）
   * 仍可能被分页切开——实测出现「图在上一页、图注在下一页」。
   * 所以给图片本身也加，并把它设成 inline-block（配合 figure 的 flex 居中）。
   */
  .photos img {
    display: inline-block;
    /* 宽度上限 = 版心宽；实际宽度由脚本按高度反推 */
    max-width: 100%;
    width: 100%;
    height: auto;
    /* ⚠️ 这里**故意不写 max-height**：打印的槽位高度（版心高 ÷ 2）是**打印口径**，
       写进共享 CSS 会把工作台页面版的照片也限高——
       预览容器比 A4 宽得多（实测 948px），限高后图在盒子里左右留白（实测只画 616px 宽），
       页面版反而比改动前更小。
       打印路由的脚本会写**行内样式**（精确 px），行内样式优先于这里的兜底样式，
       所以 PDF 里的尺寸由脚本说了算：满宽 176mm + 等高 + 不裁剪。 */
    object-fit: contain;
    break-inside: avoid;
    page-break-inside: avoid;
    border: 0.6pt solid #000000;
    background: #ffffff;
  }
  .photos figcaption { margin-top: 4pt; font-size: 12pt; line-height: 20pt; color: #333333; text-align: center; }

  .receipts { display: block; }
  .receipts figure {
    /* 下边距 14pt → **6pt**（第三十八轮之五）：两张票据要排进同一页 */
    margin: 0 0 6pt;
    break-inside: avoid;
    /* 票据与照片同一条规则：固定分高度为 2 份，一页两张。
       min-height 交给打印脚本按张数设置——
       只有一张时撑开（垂直居中，不孤零零贴页顶），
       多张时交回自然流（两张正好排满一页）。 */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }
  .receipts img {
    display: block;
    width: auto;
    max-width: 100%;
    /* 与照片同理：**打印尺寸由打印路由的行内样式决定**
       （满宽 176mm + 等高 + 不裁剪），这里不写 max-height，
       免得把工作台页面版的票据也限高。
       ⚠️ 行内样式里 object-fit 会覆盖成 fill（铺满、不裁剪），
       这里的 contain 只是**页面预览态**的兜底（预览容器比 A4 宽，
       contain 能保住票据的原始比例）。 */
    height: auto;
    margin: 0 auto;
    border: 0.6pt solid #000000;
    background: #ffffff;
  }
  .receipt-pdf {
    border: 0.6pt solid #000000;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6pt;
    padding: 36pt 12pt;
    text-align: center;
  }
  .receipt-pdf strong {
    font-family: "NotoSerifSC", "Songti SC", serif;
    font-size: 14pt;
    font-weight: 700;
    line-height: 22pt;
    color: #000000;
  }
  .receipt-pdf span { font-size: 12pt; line-height: 20pt; color: #333333; word-break: break-all; }
  .receipts figcaption { margin-top: 4pt; font-size: 12pt; line-height: 20pt; color: #333333; text-align: center; }

  /* ---------- 落款 ---------- */
  .signature {
    margin-top: 34pt;
    text-align: right;
    font-size: 16pt;
    line-height: 28.9pt;
    break-inside: avoid;
  }
  .signature p { margin: 0; }

  /* 附件：整页起排（票据是附件，公文惯例另起页）。
     margin-top 24pt → **0**（第三十八轮之五）：附件本来就另起页，
     顶上再留 24pt 就把「两张票据排一页」挤掉了（实测差 10mm 排不下）。 */
  .appendix { break-before: page; margin-top: 0; }
  .appendix-title {
    margin: 0 0 12pt;
    padding-bottom: 5pt;
    border-bottom: 1pt solid #111111;
    font-family: "NotoSerifSC", "Songti SC", serif;
    font-size: 16pt;
    line-height: 28.9pt;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
`

/**
 * 页面内嵌用：把文档样式限定在 .activity-doc 里（不动全局 html/body）。
 * 这样活动详情页左侧可以**直接用 ActivityHtml 渲染**，与导出的 PDF 同一套版式。
 *
 * ⚠️ @font-face 要**保留**（2026-11-02 第三十八轮改）：
 * 之前这里把 @font-face 整段剥掉，页面版就落回浏览器兜底字体，
 * 于是「页面看到的」和「打印出来的」是两套字形。
 * 现在 @font-face 用**相对路径**（/fonts/xxx.ttf），页面与 PDF 共用同一份字体文件。
 */
export const docCssScoped = () => {
  // 取完整样式，**保留 @font-face 段**（相对路径），只把普通规则限定到 .activity-doc
  const full = docCss('')
  const fontFaces = full.slice(0, full.indexOf('* {'))
  const start = full.indexOf('* {')
  const cleaned = full.slice(start).replace(/\/\*[\s\S]*?\*\//g, '').trim()
  const scoped = cleaned.replace(
    /(^|\})([^{}]+)\{/g,
    (_match: string, brace: string, rawSelectors: string) => {
      const selectors = rawSelectors
        .split(',')
        .map((selector) => selector.trim())
        .filter(Boolean)
      const mapped = selectors
        .map((selector) => {
          // html/body 的 margin/padding 不要映射到文档卡片上（会把纸张内边距清成 0）
          if (selector === 'html' || selector === 'body') return null
          if (selector === '*') return '.activity-doc *'
          return `.activity-doc ${selector}`
        })
        .filter((selector): selector is string => Boolean(selector))
      if (!mapped.length) return ''
      return `${brace}${Array.from(new Set(mapped)).join(', ')}{`
    },
  )
  // @font-face 在最前面（它是全局声明，不能限定到 .activity-doc）
  // ⚠️ 窄屏样式**放在最后**：同优先级时后面的规则胜，
  //    放在前面会被 docCss 里的大屏规则覆盖掉。
  return `${fontFaces.trim()}\n${scoped}\n${SCOPED_NARROW_CSS}`
}

/**
 * 页面版在**窄屏**下的补充样式（2026-11-03 第五十一轮）。
 *
 * ⚠️ 只加在 `docCssScoped()`（页面用）里，**导出的 PDF 不带这段**——
 *    打印版式一个字都不改。
 *
 * 解决的问题：文档里的表格按 PDF 版心（176mm ≈ 620px）排，
 * 手机上（390px）直接被裁掉右半边——「计划活动地点」这一格只看得到一半。
 * 这里在窄屏把表格改成**卡片式**：每行摊成一块，标签在上、值在下，
 * 宽度自适应，不再横向溢出；长文本（地址、事由）也允许换行显示完整。
 */
const SCOPED_NARROW_CSS = `
/* ---------- 窄屏：文档表格改成卡片式 ---------- */
@media (max-width: 639px) {
  .activity-doc { padding: 24px 16px !important; }
  .activity-doc table.fields,
  .activity-doc table.data,
  .activity-doc table.version-diff {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed !important;
  }
  /* 字段表：标签与值各占一行（标签在上、值在下） */
  .activity-doc table.fields,
  .activity-doc table.fields tbody,
  .activity-doc table.fields tr,
  .activity-doc table.fields td,
  .activity-doc table.fields th {
    display: block;
    width: 100% !important;
  }
  .activity-doc table.fields colgroup { display: none; }
  .activity-doc table.fields th {
    border: 0.6pt solid #000000;
    border-bottom: 0;
    padding: 5pt 6pt 2pt;
    background: #f7f5fc;
    font-size: 12pt;
    line-height: 18pt;
    text-align: left;
    white-space: normal;
  }
  .activity-doc table.fields td {
    border: 0.6pt solid #000000;
    border-top: 0;
    padding: 4pt 6pt 6pt;
    font-size: 13pt;
    line-height: 19pt;
    text-align: left;
    /* 值这一格允许换行：长地址、长团名要显示完整，不能被裁掉 */
    white-space: normal !important;
    word-break: normal;
    overflow-wrap: anywhere;
    line-break: strict;
  }
  /* 明细表（预算明细 / 支出明细 / 审核记录）：
     列多（5-7 列），窄屏横排必然把字挤成竖排。
     改成**每行一张卡**：表头行变成「字段名：值」的列表，一行一字段。 */
  .activity-doc table.data thead { display: none; }
  .activity-doc table.data,
  .activity-doc table.data tbody,
  .activity-doc table.data tr,
  .activity-doc table.data td {
    display: block;
    width: 100% !important;
  }
  .activity-doc table.data colgroup { display: none; }
  .activity-doc table.data tr {
    margin-top: 8pt;
    border: 0.6pt solid #d9d4e6;
    border-radius: 4pt;
    background: #fbfaff;
  }
  .activity-doc table.data td {
    border: 0;
    border-top: 0.6pt dashed #e6e1f2;
    padding: 4pt 8pt;
    font-size: 12pt;
    line-height: 18pt;
    text-align: left !important;
    white-space: normal !important;
    overflow-wrap: anywhere;
  }
  .activity-doc table.data td:first-child { border-top: 0; }
  /* 字段名：窄屏时用 data-label 顶在值上方（没有 data-label 的格子照常） */
  .activity-doc table.data td[data-label]::before {
    content: attr(data-label) "：";
    color: #6b6b6b;
    margin-right: 4pt;
  }
  /* 表格容器不再横向滚动（内容已自适应） */
  .activity-doc .table-scroll,
  .activity-doc .overflow-x-auto { overflow-x: visible; }
}`
