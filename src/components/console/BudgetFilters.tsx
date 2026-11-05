'use client'

import { useRouter } from 'next/navigation'

import { ClearFiltersButton } from '@/components/console/ClearFiltersButton'
import { FILTER_TRIGGER, ListToolbar } from '@/components/console/kit'
import { cn } from '@/lib/utils'
import { UrlSearchField } from '@/components/console/UrlSearchField'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BUDGET_CATEGORY_OPTIONS,
  BUDGET_STATE_OPTIONS,
  BUDGET_YEARS,
  budgetHref,
  hasBudgetFilter,
  type BudgetFilterValue,
} from '@/lib/budget-filter'

/**
 * 经费页的筛选条：年度 / 项目类别 / 预算状态 / 团名关键字。
 *
 * 与通知页、资源页同一套版式：一行放在表格卡片的头部，
 * 条件全部写进地址（`?year=2026&project=a-idol&state=over&q=杭州`）。
 *
 * **年度是这一页的主轴**：从 2026 年起（下拉里往后给 5 年），
 * 换年度等于换一份账，所以它排在最左边。
 */
export function BudgetFilters({
  value,
  showCategory = true,
}: {
  value: BudgetFilterValue
  /** 团长只带一个团，类别与状态没有意义，只留年度 */
  showCategory?: boolean
}) {
  const router = useRouter()
  const apply = (next: Partial<BudgetFilterValue>) => {
    router.push(budgetHref({ ...value, ...next }), { scroll: false })
  }

  const yearItems = BUDGET_YEARS.map((year) => ({ value: String(year), label: `${year} 年` }))
  const filtered = hasBudgetFilter(value)

  return (
    <ListToolbar className="justify-start px-0 sm:px-0">
      {/* 年度：这一页的主轴 */}
      <Select
        items={yearItems}
        value={String(value.year)}
        onValueChange={(next) => apply({ year: Number(next) || value.year })}
      >
        <SelectTrigger aria-label="年度" className={cn(FILTER_TRIGGER, "w-[8.375rem]")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {yearItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showCategory ? (
        <>
          <Select
            items={BUDGET_CATEGORY_OPTIONS}
            value={value.category}
            onValueChange={(next) => apply({ category: String(next) || 'all' })}
          >
            <SelectTrigger aria-label="项目" className={cn(FILTER_TRIGGER, "min-w-[9rem]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={BUDGET_STATE_OPTIONS}
            value={value.state}
            onValueChange={(next) => apply({ state: (next as BudgetFilterValue['state']) || 'all' })}
          >
            <SelectTrigger aria-label="预算状态" className={cn(FILTER_TRIGGER, "min-w-[9rem]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_STATE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : null}

      <div className="ml-auto flex w-full flex-wrap items-center gap-3 sm:w-auto">
        <UrlSearchField
          value={value.q}
          baseHref={budgetHref({ ...value, q: '' })}
          placeholder="搜团名 / 城市…"
          ariaLabel="搜索互助团"
          className="min-w-0 flex-1 sm:w-72 sm:flex-none"
        />
        {filtered ? (
          <ClearFiltersButton
            onClick={() => apply({ category: 'all', state: 'all', q: '' })}
          />
        ) : null}
      </div>
    </ListToolbar>
  )
}

/** 年度下拉（团长视角用：只有一个团，不必给类别与状态） */
export function BudgetYearSelect({ value }: { value: BudgetFilterValue }) {
  const router = useRouter()
  const yearItems = BUDGET_YEARS.map((year) => ({ value: String(year), label: `${year} 年` }))
  return (
    <Select
      items={yearItems}
      value={String(value.year)}
      onValueChange={(next) => router.push(budgetHref({ year: Number(next) || value.year }), { scroll: false })}
    >
      <SelectTrigger aria-label="年度" className={cn(FILTER_TRIGGER, "w-[8.375rem]")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {yearItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
