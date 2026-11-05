import Link from 'next/link'

import { SectionTitle, StatCard } from '@/components/console/kit'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { yuan, formatRate } from '@/lib/format'
import type { FundPanelData } from '@/lib/fund-panel'

/**
 * 「活动资金」看板（**活动层面**的预算 vs 报销）。
 *
 * 从工作台首页搬过来的——首页只管"活动与待办"，资金的事都到经费页看。
 * 口径：预算 = 活动方案里申请的预算合计；实际 = 已核定的报销。
 * ⚠️ 与「年度预算」（团级额度）是两个口径，两者并列才看得出
 * "这个团今年申请的钱会不会超过给它的年度盘子"。
 */

const CHART_HEIGHT = 160

export function FundPanel({ data }: { data: FundPanelData }) {
  const { total } = data
  const savings = data.savings

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="预算合计" value={yuan(total.budget)} hint={`${total.plans} 场活动`} />
        <StatCard
          label="实际报销"
          value={yuan(total.approved)}
          hint={
            data.executionRate === null
              ? '暂无完成报销'
              : `执行率 ${formatRate(data.executionRate)}`
          }
        />
        <StatCard
          tone={savings >= 0 ? 'accent' : 'danger'}
          label={savings >= 0 ? '结余' : '超出预算'}
          value={total.settledBudget ? yuan(Math.abs(savings)) : '—'}
          hint="已完成报销的活动"
        />
        <StatCard
          label="人均成本"
          value={data.perPerson === null ? '—' : yuan(Math.round(data.perPerson * 100) / 100)}
          hint={data.settledPeople ? `${data.settledPeople} 人次` : '暂无完成报销'}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-2">
        <section className="space-y-3">
          <SectionTitle count={`${data.pendingQueue.length} 笔 · ${yuan(data.pendingAmount)}`}>待审核报销</SectionTitle>
          {data.pendingQueue.length ? (
            <ul className="divide-y divide-rule rounded-card border border-rule">
              {data.pendingQueue.slice(0, 6).map((row) => (
                <li key={row.slug}>
                  <Link
                    href={`/activities/${row.slug}`}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-accent-soft/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{row.title}</span>
                      <span className="block truncate text-small text-muted">{row.cohort}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{yuan(row.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="没有待审核的报销。" />
          )}
        </section>

        <section className="space-y-3">
          <SectionTitle>按费用类别</SectionTitle>
          {data.expenseRows.length ? (
            <ExpenseBars rows={data.expenseRows} />
          ) : (
            <Empty text="这段时间没有费用明细。" />
          )}
        </section>
      </div>

      {data.overBudget.length ? (
        <section className="space-y-3">
          <SectionTitle>超出预算的活动</SectionTitle>
          <ul className="divide-y divide-rule rounded-card border border-danger/25 bg-danger-soft/40">
            {data.overBudget.slice(0, 5).map((row) => (
              <li key={row.slug}>
                <Link
                  href={`/activities/${row.slug}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 hover:bg-danger-soft"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.title}</span>
                    <span className="block truncate text-small text-muted">{row.cohort}</span>
                  </span>
                  <span className="shrink-0 text-right text-small tabular-nums">
                    <span className="block font-semibold text-danger">
                      +{yuan(row.approved - row.budget)}
                    </span>
                    <span className="text-muted">预算 {yuan(row.budget)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle>按月</SectionTitle>
        {data.monthRows.length ? (
          <MonthlyChart rows={data.monthRows} />
        ) : (
          <Empty text="这段时间没有活动。" />
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>按项目</SectionTitle>
        <FundTable
          firstHeader="项目"
          rows={data.categoryRows.map((row, index) => ({
            key: `${row.label}-${index}`,
            name: row.label,
            bucket: row.bucket,
          }))}
        />
      </section>

      <section className="space-y-3">
        <SectionTitle>互助团 · 预算前十</SectionTitle>
        {data.cohortRows.length ? (
          <FundTable
            firstHeader="互助团"
            rows={data.cohortRows.map((bucket, index) => ({
              key: `${bucket.name}-${index}`,
              name: bucket.name,
              bucket,
            }))}
          />
        ) : (
          <Empty text="这段时间没有活动。" />
        )}
      </section>
    </div>
  )
}


function Empty({ text }: { text: string }) {
  return (
    <Card className="gap-0 border-rule py-8">
      <p className="text-center text-body text-muted">{text}</p>
    </Card>
  )
}


/** 按费用类别：每类一行，上条预算（浅紫）、下条实际（木兰粉），同一刻度 */
function ExpenseBars({ rows }: { rows: { name: string; budget: number; spend: number }[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.budget, r.spend]))
  const pct = (v: number) => `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%`
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-small text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-accent/30" aria-hidden />
          预算
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-mountain" aria-hidden />
          实际
        </span>
      </div>
      <ul className="space-y-3">
        {rows.slice(0, 8).map((row) => (
          <li key={row.name} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-small">
              <span className="truncate font-medium text-fg">{row.name}</span>
              <span className="shrink-0 text-muted tabular-nums">
                {yuan(row.spend)} / {yuan(row.budget)}
              </span>
            </div>
            <div className="space-y-1" aria-hidden>
              <span className="block h-2 rounded-full bg-accent/30" style={{ width: pct(row.budget) }} />
              <span className="block h-2 rounded-full bg-mountain" style={{ width: pct(row.spend) }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 按月：每个月两根柱，浅色是预算，深色是实际报销。高度按同一刻度画。 */
function MonthlyChart({
  rows,
}: {
  rows: { key: string; label: string; title: string; budget: number; approved: number }[]
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.budget, r.approved]))
  const height = (v: number) => (v > 0 ? Math.max(2, Math.round((v / max) * CHART_HEIGHT)) : 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-small text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-accent/30" aria-hidden />
          预算
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-mountain" aria-hidden />
          实际报销
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex min-w-[2.75rem] flex-1 flex-col items-center gap-2"
            title={`${row.title}：预算 ${yuan(row.budget)}，实际报销 ${yuan(row.approved)}`}
          >
            <div
              className="flex w-full items-end justify-center gap-1.5"
              style={{ height: CHART_HEIGHT }}
            >
              <span
                className="w-3 rounded-t-full bg-accent/30 transition-[height] duration-500 motion-reduce:transition-none"
                style={{ height: height(row.budget) }}
              />
              <span
                className="w-3 rounded-t-full bg-mountain transition-[height] duration-500 motion-reduce:transition-none"
                style={{ height: height(row.approved) }}
              />
            </div>
            <span className="text-small text-muted tabular-nums">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 资金表：预算、实际报销、执行率。执行率只算已完成报销的活动。 */
function FundTable({
  firstHeader,
  rows,
}: {
  firstHeader: string
  rows: {
    key: string
    name: string
    bucket: {
      plans: number
      budget: number
      approved: number
      settledBudget: number
      settledApproved: number
    }
  }[]
}) {
  return (
    // resp-table：窄屏（<640px）每行摊成一张卡（与通知 / 资源 / 经费表同一口径），不横向滚动
    <Table className="resp-table">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{firstHeader}</TableHead>
          <TableHead className="text-right">场次</TableHead>
          <TableHead className="text-right">预算</TableHead>
          <TableHead className="text-right">实际报销</TableHead>
          <TableHead className="text-right">执行率</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const rate =
            row.bucket.settledBudget > 0
              ? row.bucket.settledApproved / row.bucket.settledBudget
              : null
          return (
            <TableRow key={row.key}>
              <TableCell data-label={firstHeader} className="whitespace-normal">
                {row.name}
              </TableCell>
              <TableCell data-label="场次" className="text-right tabular-nums">
                {row.bucket.plans || '—'}
              </TableCell>
              <TableCell data-label="预算" className="text-right tabular-nums">
                {row.bucket.budget ? yuan(row.bucket.budget) : '—'}
              </TableCell>
              <TableCell data-label="实际报销" className="text-right tabular-nums">
                {row.bucket.approved ? yuan(row.bucket.approved) : '—'}
              </TableCell>
              <TableCell data-label="执行率" className="text-right">
                <Rate value={rate} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function Rate({ value }: { value: number | null }) {
  if (value === null) return <span className="text-faint">—</span>
  const pct = value * 100
  return (
    <span className="inline-flex items-center justify-end gap-2 tabular-nums">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-console-muted" aria-hidden>
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </span>
      <span className="w-14 text-right">{formatRate(value)}</span>
    </span>
  )
}
