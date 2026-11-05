'use client'

import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { TableHead } from '@/components/ui/table'
import { budgetHref, type BudgetFilterValue, type BudgetSortField } from '@/lib/budget-filter'
import { cn } from '@/lib/utils'

/**
 * 可排序的表头（点一下换排序）。
 *
 * - 当前排序列：显示 ↑ / ↓；
 * - 没排的列：显示上下箭头（一点就按它排，默认降序——数字列往下看更常用）；
 * - 排序写进地址（`?sort=spent&dir=desc`），刷新与分享都保持同一个顺序。
 */
export function SortableHead({
  label,
  field,
  value,
  align = 'left',
  className,
  title,
}: {
  label: string
  field: BudgetSortField
  /** 当前筛选条件（排序要把别的条件一起带在地址里） */
  value: BudgetFilterValue
  align?: 'left' | 'right'
  className?: string
  /** 说明这一列是什么（悬停可见） */
  title?: string
}) {
  const router = useRouter()
  const active = value.sort === field
  // 同一列再点一次就翻方向；换一列则默认降序（数字列看大的）
  const nextDir = active ? (value.dir === 'desc' ? 'asc' : 'desc') : 'desc'

  const Icon = active ? (value.dir === 'desc' ? ArrowDown : ArrowUp) : ChevronsUpDown

  return (
    <TableHead
      className={cn(
        align === 'right' ? 'text-right' : 'text-left',
        'p-0',
        className,
      )}
    >
      <button
        type="button"
        title={title}
        aria-label={`按${label}排序`}
        onClick={() =>
          router.push(budgetHref({ ...value, sort: field, dir: nextDir }), { scroll: false })
        }
        className={cn(
          'inline-flex min-h-11 w-full items-center gap-1.5 px-4 py-2 text-left font-medium transition-colors',
          align === 'right' ? 'justify-end' : 'justify-start',
          active ? 'text-fg' : 'text-muted hover:text-fg',
        )}
      >
        {label}
        <Icon
          aria-hidden
          className={cn('size-4 shrink-0', active ? 'text-accent' : 'text-faint')}
        />
      </button>
    </TableHead>
  )
}
