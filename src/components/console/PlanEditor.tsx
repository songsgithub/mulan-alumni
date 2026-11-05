'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { submitExistingPlan, updatePlan } from '@/app/(admin)/(workspace)/actions'
import { ConfirmDialog } from '@/components/console/ConfirmDialog'
import { DatePicker } from '@/components/console/DatePicker'
import { FormSelect } from '@/components/console/FormSelect'
import { useActivityIssue } from '@/components/console/ActivityIssue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BudgetCategoryDef } from '@/lib/budget'
import { DEFAULT_EXPENSE_CATEGORIES, expenseDetailText } from '@/lib/budget'
import { formatDateCN, yuan } from '@/lib/format'

/** 活动设置里的两条硬规则（来自「活动设置」，服务端提交时再校验一次） */
export interface ActivityRulesView {
  /** 预算合计上限（元） */
  budgetMax: number
  /** 预计参与人数下限（人） */
  participantsMin: number
  /**
   * 费用类目树（一级类别 + 二级明细项），来自项目组在「设置」里维护的清单。
   * 不传就用内置兜底（设置还没初始化时）。
   */
  expenseCategories?: BudgetCategoryDef[]
}

interface Row {
  category: string
  item: string
  amount: string
  note: string
}

/**
 * 【活动申请】编辑 —— 就是《活动申请表》本身，只不过格子可以填。
 *
 * 字段顺序、表格结构与导出的 PDF 完全一致：
 * 互助团名称 / 活动形式 / 活动主题 / 计划时间 / 地点 / 人数 / 申报人；
 * 下面是《经费预算明细表》：费用类别 → **预算明细** → 金额 → 占比。
 * 保存与提交不在表里，放在中间的「处理」面板（用 form= 触发本表单）。
 *
 * 2026-11-02 第四十六轮：「费用项目」与「数量与规格」**合并成一列**，
 * 叫「预算明细」，由人**手动填**（写清实际发生的东西或服务）；
 * 「费用类别」仍是大类下拉（清单来自项目组在「设置」里维护的那份）。
 */
export function PlanEditor({
  plan,
  editable,
  canSubmit,
  rules,
  cohortName,
  applicantName,
  formId = 'activity-plan-form',
}: {
  plan: {
    id: number
    title: string
    slug?: string
    form?: string
    theme?: string
    kind?: string
    location?: string
    plannedAt?: string
    participants?: number
    status: string
    budgetItems?: {
      category: string
      item?: string
      description?: string
      amount: number
      note?: string
    }[]
  }
  editable: boolean
  canSubmit: boolean
  rules: ActivityRulesView
  cohortName?: string
  applicantName?: string
  /** 外部「处理」面板用 form= 提交时，表单要有 id */
  formId?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { report: reportIssue } = useActivityIssue('plan')

  const [items, setItems] = useState<Row[]>(
    (plan.budgetItems ?? []).length
      ? (plan.budgetItems ?? []).map((item) => ({
          category: item.category,
          // 老记录里「费用项目」与「数量与规格」是分开存的，
          // 这里合成一句（第四十六轮），免得保存时把「数量与规格」丢掉
          item: expenseDetailText(item),
          amount: item.amount === undefined || item.amount === null ? '' : String(item.amount),
          note: item.note ?? '',
        }))
      : [{ category: '', item: '', amount: '', note: '' }],
  )
  const [participants, setParticipants] = useState(
    plan.participants ? String(plan.participants) : '',
  )
  const [theme, setTheme] = useState(plan.theme ?? '')
  const [form, setForm] = useState(plan.form ?? 'offline')
  const [plannedDate, setPlannedDate] = useState<Date | undefined>(
    plan.plannedAt ? new Date(plan.plannedAt) : undefined,
  )
  const plannedAtText = plannedDate ? formatDateCN(plannedDate) : ''
  const [location, setLocation] = useState(plan.location ?? '')

  const total = items.reduce((acc, row) => acc + (Number(row.amount) || 0), 0)
  const people = Number(participants) || 0
  const overBudget = total > rules.budgetMax
  // 费用类目：项目组在「设置」里维护的清单；没有就用内置兜底
  const categories = rules.expenseCategories?.length ? rules.expenseCategories : DEFAULT_EXPENSE_CATEGORIES
  const underParticipants = people < rules.participantsMin

  // 「费用类别」下拉的选项 = 当前清单里的大类 + 这条申请原来就有的大类
  // （老记录的类别后来被从清单里删了，也不能让它在下拉里消失）
  const categoryOptions = Array.from(
    new Set([...categories.map((cat) => cat.name), ...items.map((row) => row.category).filter(Boolean)]),
  )

  const updateRow = (index: number, patch: Partial<Row>) =>
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  // 「提交活动申请」会把方案交给项目组审核、提交后不能再改：先确认一次（存草稿不问）
  const [confirmData, setConfirmData] = useState<FormData | null>(null)

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const intent = submitter?.value === 'submit' ? 'submit' : 'save'
    const data = new FormData(e.currentTarget)
    data.set('id', String(plan.id))
    ;['category', 'item', 'description', 'amount', 'note'].forEach((key) => data.delete(key))
    items.forEach((row) => {
      data.append('category', row.category)
      data.append('item', row.item)
      data.append('amount', row.amount)
      // 「备注」列已从表里去掉（第三十六轮），不再提交
    })
    if (intent === 'submit') {
      setConfirmData(data)
      return
    }
    run(data, 'save')
  }

  const run = (data: FormData, intent: 'save' | 'submit') => {
    startTransition(async () => {
      const saved = await updatePlan(data)
      if (!saved.ok) {
        setConfirmData(null)
        reportIssue({ ok: false, title: '没能保存', lines: [saved.message ?? '保存失败'] })
        return
      }
      if (intent === 'submit') {
        const result = await submitExistingPlan(data)
        setConfirmData(null)
        reportIssue(
          result.ok
            ? { ok: true, title: result.message ?? '活动申请已提交', lines: [] }
            : { ok: false, title: '活动申请没能提交', lines: [result.message ?? '提交失败'] },
        )
        router.refresh()
        return
      }
      reportIssue({ ok: true, title: saved.message ?? '已保存', lines: [] })
      router.refresh()
    })
  }

  if (!editable) {
    return null
  }

  return (
    // noValidate：不让浏览器先用英文气泡拦下提交——缺什么由右侧「处理」面板说清楚
    <form id={formId} onSubmit={save} noValidate className="space-y-6">
      {/* 与 PDF 同一张《活动申请表》 */}
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
            <td>{cohortName || '—'}</td>
            <th>活动形式<span className="req">*</span></th>
            <td>
              <FormSelect
                name="form"
                defaultValue={plan.form ?? 'offline'}
                onValueChange={setForm}
                options={[
                  { value: 'offline', label: '线下' },
                  { value: 'online', label: '线上' },
                  { value: 'hybrid', label: '线上线下结合' },
                ]}
              />
            </td>
          </tr>
          <tr>
            <th>活动主题<span className="req">*</span></th>
            <td colSpan={3}>
              <Input
                name="theme"
                required
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                maxLength={60}
                className="w-full"
              />
            </td>
          </tr>
          <tr>
            <th>活动类别<span className="req">*</span></th>
            <td colSpan={3}>
              <FormSelect
                name="kind"
                defaultValue={plan.kind ?? ''}
                required
                placeholder="请选择活动类别"
                options={[
                  { value: '技能提升类', label: '技能提升类' },
                  { value: 'AI素养类', label: 'AI素养类' },
                  { value: '健康科普类', label: '健康科普类' },
                  { value: '生活成长类', label: '生活成长类' },
                ]}
              />
            </td>
          </tr>
          <tr>
            <th>计划活动时间<span className="req">*</span></th>
            <td>
              <input type="hidden" name="plannedAt" value={plannedAtText} />
              <DatePicker value={plannedDate} onChange={setPlannedDate} placeholder="请选择日期" />
            </td>
            <th>计划活动地点<span className="req">*</span></th>
            <td>
              <Input
                name="location"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={60}
                className="w-full"
              />
            </td>
          </tr>
          <tr>
            <th>预计参与人数<span className="req">*</span></th>
            <td>
              <Input
                name="participants"
                type="number"
                required
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                className="w-full"
              />
            </td>
            <th>申报人</th>
            <td>{applicantName || '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* 《经费预算明细表》：费用类别 → 预算明细 → 金额 → 占比
          （2026-11-02 第四十六轮：「费用项目」与「数量与规格」合并成一列，
            叫「预算明细」，手动填；
            2026-11-03 第五十一轮：移除「查询可支持项」入口——费用类别只剩一级，
            没有可支持项清单可查了） */}
      <div>
        <h3 className="caption">（一）经费预算明细表</h3>
        <div className="overflow-x-auto">
          <table className="data min-w-[640px]">
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '46%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>序号</th>
                <th>费用类别</th>
                <th>预算明细</th>
                <th>金额</th>
                <th>占比</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => (
                <tr key={index}>
                  <td className="center">{index + 1}</td>
                  <td>
                    <FormSelect
                      name="category"
                      value={row.category}
                      onValueChange={(value) => updateRow(index, { category: value })}
                      options={categoryOptions.map((name) => ({ value: name, label: name }))}
                      placeholder="费用类别"
                    />
                  </td>
                  <td>
                    <Input
                      name="item"
                      value={row.item}
                      onChange={(e) => updateRow(index, { item: e.target.value })}
                      placeholder="写清实际发生的东西或服务，如：会议室租赁 3 小时"
                      aria-label={`第 ${index + 1} 行预算明细`}
                      className="w-full"
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.amount}
                      onChange={(e) => updateRow(index, { amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full text-right"
                    />
                  </td>
                  <td className="center">
                    {total > 0
                      ? `${(((Number(row.amount) || 0) / total) * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      移除
                    </Button>
                  </td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={3} className="center">
                  合计
                </td>
                <td className="num">{yuan(total)}</td>
                <td className="num">100%</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-right">
          <Button
            variant="link"
            type="button"
            onClick={() => setItems((prev) => [...prev, { category: '', item: '', amount: '', note: '' }])}
          >
            + 增加一项
          </Button>
        </div>
      </div>

      {/* 两条硬规则：预算上限 / 预计人数下限（提交时服务端再校验一次） */}
      <div className="flex flex-wrap gap-x-8 gap-y-1 border-t border-rule pt-3 text-label text-muted">
        <span>
          预算合计{' '}
          <span
            className={`font-semibold tabular-nums ${overBudget ? 'text-destructive' : 'text-fg'}`}
          >
            {yuan(total)}
          </span>
          <span className="ml-1">（上限 {yuan(rules.budgetMax)}）</span>
        </span>
        <span>
          预计参与人数{' '}
          <span
            className={`font-semibold tabular-nums ${underParticipants ? 'text-destructive' : 'text-fg'}`}
          >
            {people > 0 ? people : '—'}
          </span>
          <span className="ml-1">人（不少于 {rules.participantsMin} 人）</span>
        </span>
      </div>
      {overBudget ? (
        <p className="text-label leading-6 text-destructive">
          预算合计超出上限，调整后才能提交。
        </p>
      ) : null}
      {underParticipants ? (
        <p className="text-label leading-6 text-destructive">
          预计参与人数不足 {rules.participantsMin} 人，调整后才能提交。
        </p>
      ) : null}
      {!canSubmit ? (
        <p className="text-small text-muted">提交活动申请请由团长操作。</p>
      ) : null}
      {pending ? (
        <p role="status" className="text-small text-muted">
          处理中…
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmData !== null}
        onOpenChange={(open) => !open && setConfirmData(null)}
        title="提交活动申请？"
        description={`提交后交项目组审核，审核期间不能再修改。预算合计 ${yuan(total)}，预计 ${people || '—'} 人参与。`}
        confirmLabel="确认提交"
        pending={pending}
        onConfirm={() => confirmData && run(confirmData, 'submit')}
      />
    </form>
  )
}
