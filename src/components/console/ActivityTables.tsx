import Link from 'next/link'

import { expenseDetailText } from '@/lib/budget'
import { formatDateCN, formatDateTimeCN, formatActualTime, yuan } from '@/lib/format'

/**
 * 活动文档里的只读表格（服务端组件）。
 *
 * 与 PDF 版式一一对应：字段表全框线、明细表全框线、列宽用百分比，
 * 在文档页宽（约 700–900px）下也不会把「费用类别 / 事项说明」挤成竖排。
 */

function Caption({ children }: { children: React.ReactNode }) {
  return <h3 className="caption">{children}</h3>
}

/* ------------------------------------------------------------------ 活动申请表 */

/** 一笔支出的凭证（可能多个）：附件说明 + 可点开的链接 */
function receiptLinks(row: any): { id?: number | string; url?: string | null; filename?: string | null; note?: string | null }[] {
  const raw = row?.receipt
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  return list
    .map((item: any) => {
      if (item && typeof item === 'object') {
        return {
          id: item.id,
          url: item.url ?? null,
          filename: item.filename ?? null,
          note: item.note ?? null,
        }
      }
      return { id: item, url: null, filename: null, note: null }
    })
    .filter((item: any) => item.id !== undefined && item.id !== null)
}

export function ApplicationTable({ plan }: { plan: any }) {
  return (
    <div>
      <table className="fields">
        <colgroup>
          <col style={{ width: '17%' }} />
          <col style={{ width: '33%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '33%' }} />
        </colgroup>
        <tbody>
          <tr>
            <th>互助团名称</th>
            <td>{plan.cohortName || '—'}</td>
            <th>活动形式</th>
            <td>{plan.formLabel || '—'}</td>
          </tr>
          <tr>
            <th>活动主题</th>
            <td colSpan={3}>{plan.theme || '—'}</td>
          </tr>
          <tr>
            <th>活动类别</th>
            <td colSpan={3}>{plan.kind || '—'}</td>
          </tr>
          <tr>
            <th>计划活动时间</th>
            <td>{plan.plannedAt ? formatDateCN(plan.plannedAt) : '—'}</td>
            <th>计划活动地点</th>
            <td>{plan.location || '—'}</td>
          </tr>
          <tr>
            <th>预计参与人数</th>
            <td>{plan.participants ? `${plan.participants} 人` : '—'}</td>
            <th>申报人</th>
            <td>{plan.applicantName || '—'}</td>
          </tr>
          <tr>
            <th>申报时间</th>
            <td colSpan={3}>{plan.submittedAt ? formatDateTimeCN(plan.submittedAt) : '—'}</td>
          </tr>
        </tbody>
      </table>
      {plan.budgetItems?.length ? <BudgetTable items={plan.budgetItems} /> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ 经费预算明细表 */

export function BudgetTable({ items }: { items: any[] }) {
  const total = items.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const share = (amount?: number) =>
    total > 0 ? `${(((Number(amount) || 0) / total) * 100).toFixed(1)}%` : '—'
  return (
    <div>
      <Caption>（一）经费预算明细表</Caption>
      <div className="overflow-x-auto">
        <table className="data">
          <colgroup>
            <col style={{ width: '8%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '42%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
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
                {/* data-label：窄屏时表格摊成卡片，字段名顶在值上方（2026-11-03 第五十一轮） */}
                <td className="center" data-label="序号">
                  {index + 1}
                </td>
                <td data-label="费用类别">{row.category || '—'}</td>
                <td data-label="预算明细">{expenseDetailText(row) || '—'}</td>
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
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 活动反馈表 */

export function FeedbackTable({ report }: { report: any }) {
  const photos: any[] = report.photos ?? []
  const attendees: any[] = report.attendees ?? []
  // 实际参与人数 = 签到人数（与《活动签到表》对齐）
  const signedCount = attendees.filter((row) => row.signed).length
  return (
    <div>
      <table className="fields">
        <colgroup>
          <col style={{ width: '17%' }} />
          <col style={{ width: '33%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '33%' }} />
        </colgroup>
        <tbody>
          <tr>
            <th>活动主题</th>
            <td colSpan={3}>{report.theme || '—'}</td>
          </tr>
          <tr>
            <th>活动开展时间</th>
            <td>
              {formatActualTime(report.actualAt, report.actualStart, report.actualEnd) || '—'}
            </td>
            <th>活动开展地点</th>
            <td>{report.location || '—'}</td>
          </tr>
          <tr>
            <th>实际参与人数</th>
            <td colSpan={3}>{signedCount} 人（与签到人数一致）</td>
          </tr>
          <tr>
            <th>活动总结</th>
            <td colSpan={3}>{report.summary || '—'}</td>
          </tr>
          <tr>
            <th>活动感受</th>
            <td colSpan={3} className="whitespace-pre-wrap">
              {report.highlights || '—'}
            </td>
          </tr>
          {/* 反馈时间（2026-11-01 第三十六轮）：以提交活动反馈的时间为准 */}
          <tr>
            <th>反馈时间</th>
            <td colSpan={3}>
              {report.submittedAt ? formatDateTimeCN(report.submittedAt) : '—'}
            </td>
          </tr>
        </tbody>
      </table>

      {photos.length ? (
        <div className="mt-4 space-y-4">
          <Caption>（一）活动照片（{photos.length} 张）</Caption>
          {photos.map((photo: any, index: number) => (
            <figure key={photo?.id ?? index} className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo?.url}
                alt={`${report.theme ?? '活动'} 照片 ${index + 1}`}
                className="block w-full border border-fg/25"
              />
              <figcaption className="mt-1 text-center text-small text-muted">
                {photo?.alt ? `照片 ${index + 1} · ${photo.alt}` : `照片 ${index + 1}`}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {report.expenseItems?.length ? <ExpenseTable items={report.expenseItems} /> : null}
      {report.attendees?.length ? <AttendeeTable attendees={report.attendees} /> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ 经费支出明细表 */

export function ExpenseTable({
  items,
  budgetItems = [],
}: {
  items: any[]
  /** 活动申请的预算明细：用来给每一行一个「预算金额」参考值 */
  budgetItems?: any[]
}) {
  const total = items.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  // 按明细文字去预算明细里找同一笔的预算金额
  const budgetOf = (item: string) => {
    const hit = budgetItems.find((b: any) => b?.item && expenseDetailText(b) === item)
    return hit ? Number(hit.amount) || 0 : 0
  }
  return (
    <div>
      <Caption>（二）经费支出明细表</Caption>
      <div className="overflow-x-auto">
        <table className="data">
          <colgroup>
            <col style={{ width: '8%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '36%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
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
            {items.map((row, index) => (
              <tr key={index}>
                {/* data-label：窄屏时表格摊成卡片，字段名顶在值上方（2026-11-03 第五十一轮） */}
                <td className="center" data-label="序号">
                  {index + 1}
                </td>
                <td data-label="费用类别">{row.category || '—'}</td>
                <td data-label="实际支出明细">{expenseDetailText(row) || '—'}</td>
                <td className="num" data-label="金额">
                  {yuan(row.amount)}
                </td>
                <td className="num text-muted" data-label="预算金额">
                  {budgetOf(expenseDetailText(row)) ? yuan(budgetOf(expenseDetailText(row))) : '—'}
                </td>
                <td className="center" data-label="凭证">
                  {receiptLinks(row).length ? (
                    <ul className="space-y-0.5">
                      {receiptLinks(row).map((receipt, i) => (
                        <li key={receipt.id ?? i}>
                          <Link
                            href={receipt.url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-accent"
                          >
                            {receipt.note || receipt.filename || `附件 ${i + 1}`}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    '未附'
                  )}
                </td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={3} className="center">
                合计
              </td>
              <td className="num">{yuan(total)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 活动签到表 */

export function AttendeeTable({ attendees }: { attendees: any[] }) {
  return (
    <div>
      <Caption>（三）活动签到表</Caption>
      <div className="overflow-x-auto">
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
                <td>{row.name || '—'}</td>
                <td>{row.organization || '—'}</td>
                <td>{row.position || '—'}</td>
                <td className="center">{row.signed ? '已签到' : '未签到'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 审核记录 */

export function RecordTable({
  records,
  empty,
  caption,
}: {
  records: { reviewerName?: string; action?: string; comment?: string; at?: string }[]
  empty: string
  caption?: string
}) {
  if (!records.length) {
    return (
      <div>
        {caption ? <Caption>{caption}</Caption> : null}
        <p className="py-6 text-center text-muted">{empty}</p>
      </div>
    )
  }
  return (
    <div>
      {caption ? <Caption>{caption}</Caption> : null}
      <div className="overflow-x-auto">
      <table className="data">
        <colgroup>
          <col style={{ width: '18%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '42%' }} />
          <col style={{ width: '26%' }} />
        </colgroup>
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
              <td>{record.reviewerName || '—'}</td>
              <td className="center">{record.action === 'approved' ? '审核通过' : '审核不通过'}</td>
              <td>{record.comment || '—'}</td>
              <td className="center">{record.at ? formatDateTimeCN(record.at) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
