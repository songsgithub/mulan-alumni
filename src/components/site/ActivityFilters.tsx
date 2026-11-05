'use client'

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarDays, FilterX, Search, SlidersHorizontal } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

import { MuseSearchSelect } from '@/components/site/MuseSearchSelect'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ACTIVITY_KINDS } from '@/lib/activity-kind'
import { cn } from '@/lib/utils'

export interface ActivityFilterValue {
  project?: string
  /** 活动类别（技能提升类 / AI素养类 …），地址栏参数 kind */
  kind?: string
  region?: string
  from?: string
  to?: string
  q?: string
}

const ALL = '__all__'
const KEYS: (keyof ActivityFilterValue)[] = ['project', 'kind', 'region', 'from', 'to', 'q']

/**
 * 活动筛选（复刻 muse 的 QuickFilters / FilterPanel / CategoryTabs）。
 * 条件写进地址栏，服务端按条件取数——地址可以直接分享。
 * - quick：首页的「项目 + 类别」一行；
 * - full：活动列表页的完整筛选（项目 / 区域 / 关键词 / 时间 / 类别 / 清空），窄屏可折叠。
 */
export function ActivityFilters({
  value,
  projects,
  regions = [],
  mode = 'full',
  anchor,
}: {
  value: ActivityFilterValue
  projects: { value: string; label: string }[]
  regions?: string[]
  mode?: 'quick' | 'full'
  /** 跳转后滚动到的锚点（首页筛选后停在「最新活动」） */
  anchor?: string
}) {
  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const [keyword, setKeyword] = useState(value.q ?? '')
  const [open, setOpen] = useState(false)

  const apply = (patch: ActivityFilterValue) => {
    const next = { ...value, ...patch }
    const query = new URLSearchParams()
    for (const key of KEYS) if (next[key]) query.set(key, String(next[key]))
    const qs = query.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}${anchor ? `#${anchor}` : ''}`, {
      scroll: !anchor ? false : true,
    })
  }
  const hasAny = KEYS.some((key) => Boolean(value[key]))

  const projectSelect = (
    <MuseSelect
      label="项目"
      value={value.project ?? ''}
      placeholder="全部项目"
      options={projects}
      onChange={(v) => apply({ project: v || undefined })}
      className="w-44"
    />
  )
  const categoryTabs = (
    <div role="group" aria-label="活动类别" className="flex flex-wrap gap-1.5">
      {ACTIVITY_KINDS.map((kind) => {
        const on = value.kind === kind
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={on}
            onClick={() => apply({ kind: on ? undefined : kind })}
            className={cn(
              'min-h-11 rounded-full border px-4 text-[1rem] transition-all duration-300',
              on
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-white text-ink/75 hover:border-magnolia hover:text-magnolia',
            )}
          >
            {kind}
          </button>
        )
      })}
    </div>
  )

  if (mode === 'quick') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-line/80 bg-white/80 p-4 shadow-card backdrop-blur sm:p-5">
        <span className="hand-note shrink-0 text-[1.0625rem]">项目</span>
        {projectSelect}
        {categoryTabs}
      </div>
    )
  }

  const panel = (
    <div className="space-y-3 rounded-[1.5rem] border border-line/80 bg-white/80 p-4 shadow-card backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="hand-note shrink-0 text-[1.0625rem]">项目</span>
        {projectSelect}
        {regions.length ? (
          <>
            <span className="hand-note shrink-0 text-[1.0625rem]">地域</span>
            <MuseSearchSelect
              label="地域"
              value={value.region ?? ''}
              placeholder="全部地域"
              options={regions.map((r) => ({ value: r, label: r }))}
              onChange={(v) => apply({ region: v || undefined })}
              searchPlaceholder="搜索地域…"
              className="w-64"
            />
          </>
        ) : null}
        <form
          role="search"
          className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault()
            apply({ q: keyword.trim() || undefined })
          }}
        >
          <input
            type="search"
            autoComplete="off"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索活动标题…"
            aria-label="搜索活动"
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-[1rem] outline-none placeholder:text-ink-muted focus-visible:border-magnolia/50 focus-visible:ring-[3px] focus-visible:ring-magnolia/15 sm:w-52"
          />
          <button
            type="submit"
            aria-label="搜索"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-card hover:bg-ink-strong"
          >
            <Search className="size-4" />
          </button>
        </form>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="hand-note shrink-0 text-[1.0625rem]">时间</span>
        <DateInput label="活动时间起" value={value.from} onChange={(v) => apply({ from: v })} />
        <span className="text-ink-muted" aria-hidden>
          —
        </span>
        <DateInput label="活动时间止" value={value.to} onChange={(v) => apply({ to: v })} />
        {categoryTabs}
        {hasAny ? (
          <button
            type="button"
            onClick={() => {
              setKeyword('')
              router.push(pathname, { scroll: false })
            }}
            className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[1rem] text-ink-muted hover:bg-blush"
          >
            <FilterX className="size-4" /> 清空筛选
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-white text-[1.0625rem] text-ink"
        >
          <SlidersHorizontal className="size-4" />
          {open ? '收起筛选' : '筛选条件'}
          {hasAny ? <span className="size-2 rounded-full bg-magnolia" aria-label="已设置筛选" /> : null}
        </button>
        {open ? <div className="mt-3">{panel}</div> : null}
      </div>
      <div className="hidden lg:block">{panel}</div>
    </>
  )
}

/** 日期选择：shadcn/ui 的 Popover + Calendar（不用浏览器原生日期框） */
function DateInput({
  label,
  value,
  onChange,
}: {
  label: string
  value?: string
  onChange: (v?: string) => void
}) {
  const selected = value ? new Date(`${value}T00:00:00`) : undefined
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="inline-flex h-11 w-52 items-center gap-2 rounded-full border border-line bg-white px-4 text-left text-[1rem] outline-none transition-colors hover:border-magnolia/50 focus-visible:border-magnolia/50 focus-visible:ring-[3px] focus-visible:ring-magnolia/15"
          >
            <CalendarDays aria-hidden className="size-4 shrink-0 text-magnolia/80" />
            <span className={cn('whitespace-nowrap tabular-nums', selected ? 'text-ink' : 'text-ink-muted')}>
              {selected ? format(selected, 'yyyy年M月d日', { locale: zhCN }) : '选择日期'}
            </span>
          </button>
        }
      />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          locale={zhCN}
          onSelect={(next) => onChange(next ? format(next, 'yyyy-MM-dd') : undefined)}
        />
      </PopoverContent>
    </Popover>
  )
}

function MuseSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
  className,
}: {
  label: string
  value: string
  placeholder: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <Select
      items={[{ value: ALL, label: placeholder }, ...options]}
      value={value || ALL}
      onValueChange={(next) => onChange(next == null || next === ALL ? '' : String(next))}
    >
      <SelectTrigger
        aria-label={label}
        className={cn('h-11 rounded-full border-line bg-white text-[1rem] text-ink', className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
