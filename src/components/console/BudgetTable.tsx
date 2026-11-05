'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Settings2 } from 'lucide-react'

import { CohortBudgetDialog } from '@/components/console/BudgetDialogs'
import { SortableHead } from '@/components/console/SortableHead'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { clearBudgetOverrides, setBudgetForMany } from '@/app/(admin)/(workspace)/actions'
import type { BudgetFilterValue } from '@/lib/budget-filter'
import { yuan, formatRate } from '@/lib/format'

interface BudgetTableRow {
  cohortId: number | string
  cohortName: string
  planned: number
  spent: number
  balance: number
  ratio: number | null
  /** 该年度已开展的活动场次 */
  activities: number
  /** 该年度参与人次 */
  participants: number
  /** 人均花费（元）；没人时为 null */
  perCapita: number | null
  hasOverride: boolean
  note?: string | null
}

/**
 * 各团年度预算表（**可勾选、可批量设额度**）。
 *
 * ## 为什么要有批量
 *
 * 真实情况多半是「大部分团 5000、少数几个团 3000」，
 * 一个个点对话框去改，既慢又容易漏。现在：
 * 1. 「统一设置」给**全体**一个数（5000）；
 * 2. 在表里**勾上要例外的那几个**，点「批量设置」一次改成 3000；
 * 3. 例外取消了就点「取消单独额度」，这几个团回到统一额度。
 */
export function BudgetTable({
  rows,
  year,
  defaultAmount,
  value,
}: {
  rows: BudgetTableRow[]
  year: number
  /** 该年度的统一额度（批量设置弹窗里要提示它） */
  defaultAmount: number
  /** 当前筛选与排序条件（表头排序要把它们一起带在地址里） */
  value: BudgetFilterValue
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchOpen, setBatchOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  const allIds = useMemo(() => rows.map((r) => String(r.cohortId)), [rows])
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id))

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(allIds) : new Set())
  }

  return (
    <>
      {/* 勾选后的操作条：只在有勾选时出现（不占地方，勾完才出现） */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-accent/30 bg-accent-soft px-4 py-3">
          <span className="text-body font-medium text-fg">
            已选 {selected.size} 个团
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => setBatchOpen(true)}>
              <Settings2 aria-hidden />
              批量设置额度
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setClearOpen(true)}>
              <RotateCcw aria-hidden />
              取消单独额度
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              不选了
            </Button>
          </div>
        </div>
      ) : null}

      <Table className="resp-table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[3rem]">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(checked) => toggleAll(checked === true)}
                aria-label="全选"
              />
            </TableHead>
            <SortableHead label="互助团" field="name" value={value} className="w-full" />
            <SortableHead
              label="规划预算"
              field="planned"
              value={value}
              align="right"
              className="w-[9rem]"
              title="这个团这一年的规划预算"
            />
            <SortableHead
              label="已执行"
              field="spent"
              value={value}
              align="right"
              className="w-[9rem]"
              title="已核定的报销之和"
            />
            <SortableHead
              label="剩余"
              field="balance"
              value={value}
              align="right"
              className="w-[9rem]"
            />
            <SortableHead
              label="执行率"
              field="ratio"
              value={value}
              align="right"
              className="w-[7rem]"
            />
            <SortableHead
              label="活动次数"
              field="activities"
              value={value}
              align="right"
              className="w-[8rem]"
              title="这一年度已开展的活动场次"
            />
            <SortableHead
              label="参与人次"
              field="participants"
              value={value}
              align="right"
              className="w-[8rem]"
              title="这一年度已开展活动的实际参与人数之和"
            />
            <SortableHead
              label="人均花费"
              field="perCapita"
              value={value}
              align="right"
              className="w-[8rem]"
              title="实际执行 ÷ 参与人次"
            />
            <TableHead className="w-[9rem] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const over = row.planned > 0 && row.spent > row.planned
            const id = String(row.cohortId)
            return (
              <TableRow key={id} data-selected={selected.has(id) ? 'true' : undefined}>
                <TableCell data-label="选择">
                  <Checkbox
                    checked={selected.has(id)}
                    onCheckedChange={(checked) => toggle(id, checked === true)}
                    aria-label={`选择 ${row.cohortName}`}
                  />
                </TableCell>
                <TableCell className="whitespace-normal" data-label="互助团">
                  <span className="font-semibold text-fg">{row.cohortName}</span>
                  {row.hasOverride ? (
                    <Badge variant="outline" className="ml-2">
                      单独额度
                    </Badge>
                  ) : null}
                  {row.note ? (
                    <p className="mt-0.5 text-small text-muted">{row.note}</p>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted" data-label="规划预算">
                  {row.planned > 0 ? yuan(row.planned) : '未设'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted" data-label="已执行">
                  {yuan(row.spent)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${over ? 'font-semibold text-danger' : 'text-fg'}`}
                  data-label="剩余"
                >
                  {row.planned > 0 ? yuan(row.balance) : '—'}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${over ? 'font-semibold text-danger' : 'text-muted'}`}
                  data-label="执行率"
                >
                  {formatRate(row.ratio)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted" data-label="活动次数">
                  {row.activities}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted" data-label="参与人次">
                  {row.participants}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted" data-label="人均花费">
                  {row.perCapita === null ? '—' : yuan(row.perCapita)}
                </TableCell>
                <TableCell className="text-right" data-label="操作">
                  <CohortBudgetDialog
                    year={year}
                    cohortId={row.cohortId}
                    cohortName={row.cohortName}
                    amount={row.hasOverride ? row.planned : 0}
                    note={row.note}
                    defaultAmount={defaultAmount}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <BatchBudgetDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        year={year}
        cohortIds={[...selected]}
        defaultAmount={defaultAmount}
        onDone={() => {
          setBatchOpen(false)
          setSelected(new Set())
          router.refresh()
        }}
      />

      <ConfirmClearDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        year={year}
        cohortIds={[...selected]}
        onDone={() => {
          setClearOpen(false)
          setSelected(new Set())
          router.refresh()
        }}
      />
    </>
  )
}

/** 批量设置额度 */
function BatchBudgetDialog({
  open,
  onOpenChange,
  year,
  cohortIds,
  defaultAmount,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  cohortIds: string[]
  defaultAmount: number
  onDone: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    data.set('year', String(year))
    cohortIds.forEach((id) => data.append('cohort', id))
    setError(null)
    setDone(null)
    setPending(true)
    const result = await setBudgetForMany(data)
    setPending(false)
    if (result.ok) {
      setDone(result.message ?? '已保存')
      onDone()
    } else {
      setError(result.message ?? '保存失败，请重试')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>批量设置 {year} 年预算</DialogTitle>
          <DialogDescription>
            给选中的 {cohortIds.length} 个团设同一个额度。这些团会覆盖该年度的统一额度
            （现在统一额度是 {defaultAmount} 元）。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-label font-semibold text-fg">
              年度预算（元）
            </span>
            <Input name="amount" type="number" min={0} step={100} required placeholder="例如：3000" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-label font-semibold text-fg">备注</span>
            <Textarea name="note" rows={2} placeholder="为什么这几个团不一样（可选）" />
          </label>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {done ? (
            <Alert>
              <AlertDescription>{done}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? '保存中…' : `保存到 ${cohortIds.length} 个团`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** 批量取消单独额度（回到统一额度） */
function ConfirmClearDialog({
  open,
  onOpenChange,
  year,
  cohortIds,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  cohortIds: string[]
  onDone: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setPending(true)
    const data = new FormData()
    data.set('year', String(year))
    cohortIds.forEach((id) => data.append('cohort', id))
    const result = await clearBudgetOverrides(data)
    setPending(false)
    if (result.ok) onDone()
    else setError(result.message ?? '操作失败，请重试')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>取消单独额度？</DialogTitle>
          <DialogDescription>
            选中的 {cohortIds.length} 个团在 {year} 年的单独额度会被删掉，
            它们回到统一额度（本轮已设的数）。
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            再想想
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? '处理中…' : '取消单独额度'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
