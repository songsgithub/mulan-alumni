'use client'

import { FILTER_TRIGGER } from '@/components/console/kit'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ClearFiltersButton } from '@/components/console/ClearFiltersButton'
import { type RegionValue } from '@/components/console/RegionPicker'
import { RegionSelect, type RegionSearchOption } from '@/components/console/RegionSelect'
import { SearchSelect } from '@/components/console/SearchSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { matchesRegion } from '@/lib/region-filter'
import { cn } from '@/lib/utils'

/**
 * 筛选框宽度按内容长短给：年月最窄，互助团最宽。
 * 移动端一律两列（calc(50% - gap/2)），桌面端按下面的固定宽度。
 */
const W = {
  year: 'w-[calc(50%-0.375rem)] sm:w-[8.375rem]',
  month: 'w-[calc(50%-0.375rem)] sm:w-[8.375rem]',
  project: 'w-[calc(50%-0.375rem)] sm:w-[9rem]',
  region: 'w-[calc(50%-0.375rem)] sm:w-[12rem]',
  cohort: 'w-[calc(50%-0.375rem)] sm:w-[15rem]',
}

interface StatsCohortOption {
  value: string
  label: string
  provinceCode: string
  cityCode: string
  districtCode: string
}

interface StatsFilterOptions {
  years: { value: string; label: string }[]
  months: { value: string; label: string }[]
  cohorts: StatsCohortOption[]
  regions: RegionSearchOption[]
  /** 项目类型（加油木兰 / AI豆计划 / 民宿管家） */
  categories?: { value: string; label: string }[]
}

export interface StatsFilterValue {
  year: string
  monthFrom: string
  monthTo: string
  categories: string[]
  region: RegionValue
  cohort: string
  /** 「只看待办」开关（首页）：换了别的筛选也要留着它 */
  todo?: boolean
}

/** 把筛选状态编成地址（列表与筛选条共用这一份，保证清除/跳转口径一致） */
function filterHref(value: StatsFilterValue): string {
  const query = new URLSearchParams()
  if (value.year && value.year !== 'all') query.set('year', value.year)
  if (value.monthFrom) query.set('monthFrom', value.monthFrom)
  if (value.monthTo) query.set('monthTo', value.monthTo)
  if (value.categories.length) query.set('project', value.categories.join(','))
  if (value.region.provinceCode) query.set('province', value.region.provinceCode)
  if (value.region.cityCode) query.set('city', value.region.cityCode)
  if (value.region.districtCode) query.set('district', value.region.districtCode)
  if (value.cohort) query.set('circle', value.cohort)
  if (value.todo) query.set('todo', '1')
  const qs = query.toString()
  return qs ? `/?${qs}` : '/'
}

/**
 * 统计筛选条：年份 / 月份区间 / 项目类型 / 地域 / 互助团。
 *
 * 月份可以只选一个月，也可以选起止区间（覆盖季度）。
 * 地域可以只选到省或市；互助团与地域都支持输入搜索。
 * 所有条件写进 URL，可直接分享。
 */
export function StatsFilters({
  value,
  options,
  layout = 'row',
  showPlace = true,
  showCategories = false,
  plain = false,
}: {
  value: StatsFilterValue
  options: StatsFilterOptions
  /** row = 横排一条（整页用）；rail = 竖向堆叠（工作台左栏用） */
  layout?: 'row' | 'rail'
  /** 地域 / 互助团两项：团长只带一个团，这两项选了也没有意义，不给 */
  showPlace?: boolean
  /** 项目类型下拉：默认不给（首页给） */
  showCategories?: boolean
  /** 不画自己的卡片边框与内边距（嵌在别的卡片里时用） */
  plain?: boolean
}) {
  const rail = layout === 'rail'
  const router = useRouter()
  const [monthFrom, setMonthFrom] = useState(value.monthFrom)
  const [monthTo, setMonthTo] = useState(value.monthTo)

  useEffect(() => {
    setMonthFrom(value.monthFrom)
    setMonthTo(value.monthTo)
  }, [value.monthFrom, value.monthTo])

  const apply = (next: Partial<StatsFilterValue>) => {
    const merged = { ...value, monthFrom, monthTo, ...next }
    // 换了地域后，已选的互助团如果不在新地域里，就清掉，避免结果为空又看不出原因
    if (merged.cohort) {
      const chosen = options.cohorts.find((c) => c.value === merged.cohort)
      if (chosen && !matchesRegion(chosen, merged.region)) merged.cohort = ''
    }
    router.push(filterHref(merged), { scroll: false })
  }


  const changeMonthFrom = (from: string) => {
    if (!from) {
      setMonthFrom('')
      setMonthTo('')
      apply({ monthFrom: '', monthTo: '' })
      return
    }
    const to = monthTo && Number(monthTo) >= Number(from) ? monthTo : from
    setMonthFrom(from)
    setMonthTo(to)
    apply({ monthFrom: from, monthTo: to })
  }

  const changeMonthTo = (to: string) => {
    if (!to) {
      setMonthTo(monthFrom)
      apply({ monthFrom, monthTo: monthFrom })
      return
    }
    const from = monthFrom && Number(monthFrom) <= Number(to) ? monthFrom : to
    setMonthFrom(from)
    setMonthTo(to)
    apply({ monthFrom: from, monthTo: to })
  }

  // 互助团下拉只列所选地域内的团
  const cohortChoices = options.cohorts.filter((c) => matchesRegion(c, value.region))

  // 默认就是「今年」：今年不算筛选（否则清空按钮永远在，点了也没变化）
  const hasFilter =
    value.year !== String(new Date().getFullYear()) ||
    Boolean(monthFrom) ||
    Boolean(monthTo) ||
    value.categories.length > 0 ||
    Boolean(value.region.provinceCode) ||
    Boolean(value.cohort) ||
    Boolean(value.todo)

  return (
    <div className={cn(!plain && 'rounded-card border border-rule bg-card', !plain && (rail ? 'p-4' : 'p-5'))}>
      <div className={cn(rail ? 'space-y-3' : 'flex flex-wrap items-end gap-x-6 gap-y-4')}>
        {/* rail：时间一行三列（年份 / 起始月 / 结束月） */}
        <div className={rail ? 'grid grid-cols-3 gap-3' : 'contents'}>
          <FilterSelect
            label="年份"
            value={value.year}
            onChange={(v) => {
              setMonthFrom('')
              setMonthTo('')
              apply({ year: v, monthFrom: '', monthTo: '' })
            }}
            options={options.years}
            rail={rail}
            width={W.year}
          />
          <FilterSelect
            label="起始月"
            value={monthFrom}
            placeholder="全年"
            onChange={changeMonthFrom}
            options={options.months}
            disabled={value.year === 'all'}
            rail={rail}
            width={W.month}
          />
          <FilterSelect
            label="结束月"
            value={monthTo}
            placeholder="全年"
            onChange={changeMonthTo}
            options={options.months}
            disabled={value.year === 'all'}
            rail={rail}
            width={W.month}
          />
        </div>

        {showCategories ? (
          <FilterSelect
            label="项目"
            value={value.categories[0] ?? ''}
            placeholder="全部项目"
            onChange={(v) => apply({ categories: v ? [v] : [] })}
            options={options.categories ?? []}
            rail={rail}
            width={W.project}
          />
        ) : null}

        {/* rail：地域 / 互助团 一行两列 */}
        {showPlace ? (
        <div className={rail ? 'grid grid-cols-2 gap-3' : 'contents'}>
          <label className={cn('block', rail ? 'w-full' : W.region)}>
            <span className="mb-1.5 block text-small text-faint">地域</span>
            <RegionSelect
              value={value.region}
              onChange={(region) => apply({ region })}
              searchOptions={options.regions}
            />
          </label>

          <label className={cn('block', rail ? 'w-full' : W.cohort)}>
            <span className="mb-1.5 block text-small text-faint">互助团</span>
            <SearchSelect
              value={value.cohort}
              options={cohortChoices}
              placeholder="全部互助团"
              allowEmpty
              emptyLabel="全部互助团"
              label="互助团"
              searchPlaceholder="搜索互助团…"
              onChange={(cohort) => apply({ cohort })}
            />
          </label>
        </div>
        ) : null}

        {hasFilter ? (
          <ClearFiltersButton
            onClick={() => router.push('/', { scroll: false })}
            className={cn(rail ? 'justify-start' : 'mb-1')}
          />
        ) : null}
      </div>

    </div>
  )
}

const ALL_VALUE = '__all__'

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled,
  rail = false,
  width = W.year,
}: {
  label: string
  value: string
  placeholder?: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
  rail?: boolean
  width?: string
}) {
  return (
    <label className={cn('block', rail ? 'w-full' : width)}>
      <span className="mb-1.5 block text-small text-faint">{label}</span>
      <Select
        items={[
          ...(placeholder ? [{ value: ALL_VALUE, label: placeholder }] : []),
          ...options,
        ]}
        value={value || (placeholder ? ALL_VALUE : null)}
        disabled={disabled}
        onValueChange={(next) => onChange(next == null || next === ALL_VALUE ? '' : next)}
      >
        <SelectTrigger
          aria-label={label}
          className={cn(FILTER_TRIGGER, 'w-full bg-card text-body')}
        >
          <SelectValue placeholder={placeholder ?? label} />
        </SelectTrigger>
        <SelectContent className="w-(--anchor-width)">
          {placeholder ? <SelectItem value={ALL_VALUE}>{placeholder}</SelectItem> : null}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}
