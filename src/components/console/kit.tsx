import Link from 'next/link'
import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * 工作台的版式小件（**全站只此一份**，页面里不再各写各的）。
 *
 * 口径与公开站同一套（2026-10-31 第三十轮）：
 * - 卡片标题 = 公开站卡片标题：display 字体 19px / 600；
 * - 数字卡的数字 = 公开站数字条：display 字体、细字重（light）、等宽数字；
 * - 可点的卡片 = 公开站卡片：悬停上浮 2px + 柔光影加深，300ms ease-soft。
 */

/** 卡片 / 区块标题：可带数量（灰色）与右侧操作 */
export function SectionTitle({
  children,
  count,
  actions,
  as: Tag = 'h2',
  className,
}: {
  children: ReactNode
  /** 标题后面的数量，如「活动 3」 */
  count?: number | string
  actions?: ReactNode
  as?: 'h2' | 'h3'
  className?: string
}) {
  const title = (
    <Tag className="section-title">
      {children}
      {count !== undefined ? (
        <span className="ml-2 font-sans text-small font-normal text-muted tabular-nums">{count}</span>
      ) : null}
    </Tag>
  )
  if (!actions) return <div className={className}>{title}</div>
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      {title}
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}

/**
 * 列表卡片顶部的工具条（通知 / 资源 / 经费 / 首页共用）：
 * 左边分页签或筛选，右边搜索 / 数量 / 操作；下面一条细线接表格。
 */
export function ListToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-4 sm:px-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * 表单类页面（设置 / 个人信息 / 邀请创建互助团）的版式：
 * 左边主卡固定最宽 48rem，右边可选一张 24rem 的侧卡（如修改记录）；
 * 三个页面的主卡左边缘、宽度完全一致。
 */
export const FORM_COLUMNS =
  'mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,48rem)_minmax(0,24rem)]'

/** 筛选条里的下拉触发框：胶囊（表单里的下拉仍是 12px 圆角，与输入框一致） */
export const FILTER_TRIGGER = 'rounded-full px-4'

/** 可点卡片的动效（与公开站卡片同一套） */
export const CARD_HOVER =
  'transition-all duration-300 ease-soft hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0'

/**
 * 数字卡：标签 + 数字 + 一句说明。
 * 首页、经费页、活动资金看板共用；只有负面口径（超支）用红色。
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  tone = 'default',
  className,
}: {
  label: string
  value: string
  hint?: string
  icon?: ReactNode
  href?: string
  tone?: 'default' | 'accent' | 'warning' | 'danger'
  className?: string
}) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-small text-muted">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          'mt-2 truncate font-display text-stat font-light tracking-[0.01em] tabular-nums',
          tone === 'danger'
            ? 'text-danger'
            : tone === 'warning'
              ? 'text-warning'
              : tone === 'accent'
                ? 'text-accent'
                : 'text-fg',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 truncate text-small text-muted">{hint}</p> : null}
    </>
  )
  return (
    <Card className={cn('gap-0 p-5', href && CARD_HOVER, className)}>
      {href ? (
        <Link href={href} className="block rounded-[inherit] focus-visible:outline-none">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  )
}
