import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { ClearFiltersButton } from '@/components/console/ClearFiltersButton'
import { COHORT_CATEGORIES } from '@/lib/labels'

/**
 * 项目筛选条（工作台**唯一**的一份；首页、互助团地图、互助团名录共用）。
 *
 * 三个项目（加油木兰 / AI豆计划 / 民宿管家），可带各项目的数量；选中的高亮。
 * 点一下就选中 / 再点取消（地址参数 `?project=` 逗号连写，服务端渲染，链接可分享）。
 *
 * 按 shadcn/ui 的筛选面板写法：项目是**可切换的按钮**（选中=实心主色），
 * 清除是**独立的 ghost 按钮**（与公开站活动页同一长相）。
 *
 * 地址怎么拼由页面决定：互助团页只有 `?project=`（传 basePath）；
 * 首页还要带上年份 / 地域 / 关键词等条件（传 hrefFor）。
 * （原来首页另有一个 CategoryToggles 做同一件事，已合并进来。）
 */
export function CategoryFilter({
  counts,
  selected,
  basePath = '/circles',
  hrefFor,
  label,
  className = '',
}: {
  /** 各项目的数量（不传就不显示数字） */
  counts?: Record<string, number>
  /** 当前选中的项目 */
  selected: string[]
  /** 筛选写在哪个路径上（只有 `?project=` 一个参数时用） */
  basePath?: string
  /** 选中集合 → 地址（要保留别的筛选条件时用；传了就不看 basePath） */
  hrefFor?: (next: string[]) => string
  /** 行首的小标签（如「项目」） */
  label?: string
  className?: string
}) {
  const href = (next: string[]) =>
    hrefFor ? hrefFor(next) : `${basePath}${next.length ? `?project=${next.join(',')}` : ''}`
  const toggleHref = (value: string) =>
    href(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {label ? <span className="mr-1 text-small text-faint">{label}</span> : null}
      {COHORT_CATEGORIES.map((category) => {
        const active = selected.includes(category.value)
        return (
          <Button
            key={category.value}
            variant={active ? 'default' : 'outline'}
            render={<Link href={toggleHref(category.value)} scroll={false} />}
            aria-current={active ? 'true' : undefined}
          >
            {category.label}
            {counts ? (
              <span className={active ? 'font-semibold tabular-nums' : 'text-muted tabular-nums'}>
                {counts[category.value] ?? 0}
              </span>
            ) : null}
          </Button>
        )
      })}

      {selected.length ? (
        <>
          <span className="ml-1 text-small text-muted">已选 {selected.length} 个</span>
          <ClearFiltersButton href={href([])} />
        </>
      ) : null}
    </div>
  )
}
