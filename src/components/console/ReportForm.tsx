'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { submitReport, updateReport } from '@/app/(admin)/(workspace)/actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/console/DatePicker'
import { FormSelect } from '@/components/console/FormSelect'
import { PhotoUploader } from '@/components/console/PhotoUploader'
import { ReceiptPicker } from '@/components/console/ReceiptPicker'
import { useActivityIssue } from '@/components/console/ActivityIssue'
import {
  DEFAULT_EXPENSE_CATEGORIES,
  expenseDetailText,
  type BudgetCategoryDef,
} from '@/lib/budget'
import { formatDateCN, formatDateTimeCN, yuan } from '@/lib/format'

interface ExpenseRow {
  category: string
  item: string
  amount: string
  note: string
  receiptName: string
}

interface AttendeeRow {
  name: string
  organization: string
  position: string
  signed: boolean
}

/**
 * 活动反馈编辑 —— 就是《活动反馈表》本身，格子可以直接填。
 * 字段顺序与导出的 PDF 一致；提交按钮在中间「处理」面板。
 * 提交（或驳回后重新提交）会同时生成报销单。
 */
export function ReportForm({
  plans,
  defaultPlanId,
  report,
  budgetItems = [],
  formId = 'activity-report-form',
  categories: expenseCategories = [],
}: {
  plans: { id: number | string; title: string; slug?: string; cohortId?: number | string }[]
  defaultPlanId?: string
  report?: any
  /** 活动申请里的《经费预算明细表》：默认带出来，团长照着改就行 */
  budgetItems?: { category?: string; item?: string; description?: string; amount?: number; note?: string }[]
  /** 外部「处理」面板用 form= 提交时，表单要有 id */
  formId?: string
  /**
   * 费用类目树（一级类别 + 二级明细项），来自项目组在「设置」里维护的清单；
   * 不传就用内置兜底。
   */
  categories?: BudgetCategoryDef[]
}) {
  const categories = expenseCategories.length ? expenseCategories : DEFAULT_EXPENSE_CATEGORIES
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { report: reportIssue } = useActivityIssue('report')
  const [summary, setSummary] = useState(String(report?.summary ?? ''))
  const [actualDate, setActualDate] = useState<Date | undefined>(
    report?.actualAt ? new Date(report.actualAt) : undefined,
  )
  const [actualStart, setActualStart] = useState(String(report?.actualStart ?? ''))
  const [actualEnd, setActualEnd] = useState(String(report?.actualEnd ?? ''))
  const actualTimeValue =
    actualDate && actualStart && actualEnd
      ? `${formatDateCN(actualDate)} ${actualStart}-${actualEnd}`
      : ''
  // 费用明细：已有反馈用反馈里的；新建反馈则**按活动申请的预算明细带出来**，
  // 团长照着预算改一改就行，不用从头再填一遍。
  // 明细正文 = 「费用项目 + 数量与规格」合并后的那一句（第四十六轮）
  const [expenses, setExpenses] = useState<ExpenseRow[]>(() => {
    if (Array.isArray(report?.expenseItems) && report.expenseItems.length) {
      return report.expenseItems.map((row: any) => ({
        category: String(row.category ?? ''),
        item: expenseDetailText(row),
        amount: row.amount === undefined || row.amount === null ? '' : String(row.amount),
        note: String(row.note ?? ''),
        receiptName: String(row.receiptName ?? ''),
      }))
    }
    if (budgetItems.length) {
      return budgetItems.map((row) => ({
        category: String(row.category ?? ''),
        item: expenseDetailText(row),
        amount: row.amount === undefined || row.amount === null ? '' : String(row.amount),
        note: String(row.note ?? ''),
        receiptName: '',
      }))
    }
    return [{ category: '', item: '', amount: '', note: '', receiptName: '' }]
  })
  const prefilledFromBudget = !report?.id && budgetItems.length > 0
  // 「费用类别」下拉的选项 = 当前清单里的大类 + 这条反馈原来就有的大类
  // （老记录的类别后来被从清单里删了，也不能让它在下拉里消失）
  const categoryOptions = Array.from(
    new Set([
      ...categories.map((cat) => cat.name),
      ...expenses.map((row) => row.category).filter(Boolean),
    ]),
  )
  const [attendees, setAttendees] = useState<AttendeeRow[]>(
    Array.isArray(report?.attendees) && report.attendees.length
      ? report.attendees.map((row: any) => ({
          name: String(row.name ?? ''),
          organization: String(row.organization ?? ''),
          position: String(row.position ?? ''),
          signed: Boolean(row.signed),
        }))
      : [{ name: '', organization: '', position: '', signed: true }],
  )

  // 实际参与人数 = 签到表里签了到的人数，自动生成，不能手改
  const signedCount = attendees.filter((row) => row.signed).length

  const existingPhotos = (Array.isArray(report?.photos) ? report.photos : [])
    .map((photo: any) => ({ url: photo?.url ?? null, note: photo?.alt ?? '' }))
    .filter((photo: any) => photo.url)

  const isEditing = Boolean(report?.id)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = isEditing ? await updateReport(data) : await submitReport(data)
      if (result.ok) {
        reportIssue({ ok: true, title: result.message ?? '活动反馈已提交' })
        router.refresh()
      } else {
        // 失败原因进右侧「处理」面板：说清楚缺什么、哪一笔有问题
        reportIssue({
          ok: false,
          title: isEditing ? '反馈没能提交' : '反馈提交失败',
          lines: [result.message ?? '提交失败，请检查填写内容'],
        })
      }
    })
  }

  const updateExpense = (index: number, patch: Partial<ExpenseRow>) =>
    setExpenses((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  return (
    // noValidate：不让浏览器先用英文气泡拦下提交——
    // 缺什么、缺哪一笔，由服务端查清楚后在右侧「处理」面板里说
    <form id={formId} onSubmit={onSubmit} noValidate className="space-y-6">
      {isEditing ? <input type="hidden" name="id" value={report.id} /> : null}

      {/* 与 PDF 同一张《活动反馈表》：开展时间在左、地点在右（与活动申请一致） */}
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
            <td colSpan={3}>
              <input type="hidden" name="plan" value={defaultPlanId ?? ''} />
              {plans.find((p) => String(p.id) === String(defaultPlanId))?.title ?? '—'}
            </td>
          </tr>
          <tr>
            <th>活动开展时间<span className="req">*</span></th>
            <td>
              <input type="hidden" name="actualTime" value={actualTimeValue} />
              <DatePicker value={actualDate} onChange={setActualDate} placeholder="请选择活动日期" />
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="time"
                  step={60}
                  value={actualStart}
                  onChange={(e) => setActualStart(e.target.value)}
                  aria-label="开始时间"
                  className="h-12 flex-1"
                />
                <span className="shrink-0 text-small text-muted">至</span>
                <Input
                  type="time"
                  step={60}
                  value={actualEnd}
                  onChange={(e) => setActualEnd(e.target.value)}
                  aria-label="结束时间"
                  className="h-12 flex-1"
                />
              </div>
            </td>
            <th>活动开展地点<span className="req">*</span></th>
            <td>
              <Input
                name="location"
                required
                maxLength={60}
                defaultValue={String(report?.location ?? '')}
                className="w-full"
              />
            </td>
          </tr>
          <tr>
            <th>实际参与人数</th>
            <td colSpan={3}>
              <span className="font-semibold text-fg tabular-nums">{signedCount} 人</span>
              <span className="ml-2 text-small text-muted">
                与下方《活动签到表》中签到的人数一致，自动生成
              </span>
            </td>
          </tr>
          <tr>
            <th>活动总结<span className="req">*</span></th>
            <td colSpan={3}>
              <Textarea
                name="summary"
                required
                rows={4}
                maxLength={200}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="活动怎么进行的、谁来了、现场发生了什么（200 字以内）"
                className="w-full"
              />
              <span className="mt-1 block text-right text-small text-muted">
                {summary.length}/200
              </span>
            </td>
          </tr>
          <tr>
            <th>活动感受</th>
            <td colSpan={3}>
              <Textarea
                name="highlights"
                rows={4}
                defaultValue={String(report?.highlights ?? '')}
                placeholder="哪些做法有效？下次可以怎么改进？"
                className="w-full"
              />
            </td>
          </tr>
          {/* 反馈时间（2026-11-01 第三十六轮）：以提交活动反馈的时间为准。
              编辑时是只读的——时间是系统记的，改不了。 */}
          <tr>
            <th>反馈时间</th>
            <td colSpan={3} className="text-muted">
              {report?.submittedAt
                ? formatDateTimeCN(report.submittedAt)
                : '提交反馈后由系统记录'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 《活动照片》 */}
      <div>
        <h3 className="caption">（一）活动照片（3-5 张）</h3>
        <PhotoUploader existing={existingPhotos} />
      </div>

      {/* 《经费支出明细表》（2026-11-02 第四十六轮）：
          费用类别 → **实际支出明细** → 金额 → 预算金额（参考）→ 凭证。
          「费用项目」与「数量与规格」合并成一列，手动填；
          「预算金额」是活动申请里同一笔的预算值，只读参考——
          一眼看出这笔超没超预算（纸质报销存档时最想看的就是这个）。 */}
      <div>
        <h3 className="caption">（二）经费支出明细表</h3>
        <div className="overflow-x-auto">
          <table className="data min-w-[820px]">
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>序号</th>
                <th>费用类别</th>
                <th>实际支出明细</th>
                <th>金额</th>
                <th>预算金额</th>
                <th>凭证/照片证明</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((row, index) => {
                // 预算金额参考：按明细文字去活动申请的预算明细里找同一笔
                const budgetAmount = budgetItems.find(
                  (b) => b.item && row.item && expenseDetailText(b) === row.item,
                )?.amount
                return (
                  <tr key={index}>
                    <td className="center">{index + 1}</td>
                    <td>
                      <FormSelect
                        name="category"
                        value={row.category}
                        onValueChange={(value) => updateExpense(index, { category: value })}
                        options={categoryOptions.map((name) => ({ value: name, label: name }))}
                        placeholder="费用类别"
                      />
                    </td>
                    <td>
                      <Input
                        name="item"
                        value={row.item}
                        onChange={(e) => updateExpense(index, { item: e.target.value })}
                        placeholder="写清实际花了什么，如：会议室租赁 3 小时"
                        aria-label={`第 ${index + 1} 行实际支出明细`}
                        className="w-full"
                      />
                    </td>
                    <td>
                      <Input
                        name="amount"
                        type="number"
                        step="0.01"
                        min={0}
                        value={row.amount}
                        onChange={(e) => updateExpense(index, { amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full text-right"
                      />
                    </td>
                    <td className="num text-muted">
                      {budgetAmount ? yuan(Number(budgetAmount)) : '—'}
                    </td>
                    <td>
                      <ReceiptPicker
                        rowIndex={index}
                        itemName={row.item || `第 ${index + 1} 笔`}
                        existing={(report?.expenseItems?.[index]?.receipt ?? []).map((r: any) => ({
                          id: r?.id,
                          filename: r?.filename,
                          note: r?.note,
                        }))}
                        onError={(message) =>
                          reportIssue({ ok: false, title: '附件没通过', lines: [message] })
                        }
                      />
                    </td>
                    <td className="center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpenses((prev) => prev.filter((_, i) => i !== index))}
                      >
                        移除
                      </Button>
                    </td>
                  </tr>
                )
              })}
              <tr className="total">
                <td colSpan={3} className="center">
                  合计
                </td>
                <td className="num">{yuan(sumExpenses(expenses))}</td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-right">
          <Button
            variant="link"
            type="button"
            onClick={() =>
              setExpenses((prev) => [
                ...prev,
                { category: '', item: '', amount: '', note: '', receiptName: '' },
              ])
            }
          >
            + 增加一项
          </Button>
        </div>
      </div>

      {/* 《活动签到表》：签到人数即实际参与人数 */}
      <div>
        <h3 className="caption">（三）活动签到表</h3>
        <p className="mt-1 text-small text-muted">签到 {signedCount} 人，即实际参与人数。</p>
        <div className="mt-2 overflow-x-auto">
          <table className="data">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>姓名</th>
                <th>工作单位</th>
                <th>工作职位</th>
                <th>签到</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((row, index) => (
                <tr key={index}>
                  <td>
                    <Input
                      name="attendeeName"
                      value={row.name}
                      onChange={(e) =>
                        setAttendees((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)),
                        )
                      }
                      className="w-full"
                    />
                  </td>
                  <td>
                    <Input
                      name="attendeeOrg"
                      value={row.organization}
                      onChange={(e) =>
                        setAttendees((prev) =>
                          prev.map((r, i) =>
                            i === index ? { ...r, organization: e.target.value } : r,
                          ),
                        )
                      }
                      className="w-full"
                    />
                  </td>
                  <td>
                    <Input
                      name="attendeePosition"
                      value={row.position}
                      onChange={(e) =>
                        setAttendees((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, position: e.target.value } : r)),
                        )
                      }
                      className="w-full"
                    />
                  </td>
                  <td className="center">
                    <input type="hidden" name="attendeeSigned" value={row.signed ? 'on' : ''} />
                    <Checkbox
                      checked={row.signed}
                      onCheckedChange={(checked) =>
                        setAttendees((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, signed: checked === true } : r)),
                        )
                      }
                      aria-label={`第 ${index + 1} 位签到`}
                    />
                  </td>
                  <td className="center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttendees((prev) => prev.filter((_, i) => i !== index))}
                    >
                      移除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-right">
          <Button
            variant="link"
            type="button"
            onClick={() =>
              setAttendees((prev) => [
                ...prev,
                { name: '', organization: '', position: '', signed: true },
              ])
            }
          >
            + 增加一位
          </Button>
        </div>
      </div>


      {pending ? <p className="text-small text-muted">提交中…</p> : null}
    </form>
  )
}

function sumExpenses(expenses: ExpenseRow[]) {
  return expenses.reduce((acc, row) => acc + (Number(row.amount) || 0), 0)
}
