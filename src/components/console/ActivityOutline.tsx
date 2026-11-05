'use client'

import { useEffect, useState } from 'react'

import { StatusBadge, type StatusTone } from '@/components/console/StatusBadge'
import { cn } from '@/lib/utils'

/** 环节状态：done 已完成 / active 进行中 / pending 还没到 / stop 被驳回 */
type OutlineTone = StatusTone

export interface OutlineItem {
  /** 对应左侧区块的 DOM id，点击锚点跳过去 */
  id: string
  index: string
  title: string
  status: string
  tone: OutlineTone
}

/**
 * 活动详情页右侧的**活动进度**——像一篇文章的目录：
 *
 * - 固定在视口里，左边往下滚时它不动；
 * - 滚动时高亮当前所在环节；
 * - 点一下跳到对应环节。
 *
 * 每个环节带自己的**审批状态**（已通过 / 待审批 / 未提交 / 已驳回）。
 */
export function ActivityOutline({
  items,
  title = '活动进度',
  onNavigate,
}: {
  items: OutlineItem[]
  /** 标题；传 null 表示不画这一行（底部抽屉里已经有 SheetTitle 了） */
  title?: string | null
  /** 点击某一环节后调用（窄屏抽屉里用来收起面板，否则它会一直盖着页面并锁住滚动） */
  onNavigate?: () => void
}) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '')

  useEffect(() => {
    // 当前环节 = **阅读线**（视口上方 30% 处）所在的那一节。
    // 用固定的 140px 在窄屏上会失真，所以按视口高度算。
    const onScroll = () => {
      const line = Math.max(120, window.innerHeight * 0.3)
      let current = items[0]?.id ?? ''
      for (const item of items) {
        const el = document.getElementById(item.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= line) current = item.id
      }
      setActiveId(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [items])

  return (
    <nav aria-label="活动进度导航">
      {title ? <p className="text-small font-semibold tracking-[0.06em] text-faint">{title}</p> : null}
      <ol className={cn('space-y-1', title ? 'mt-3' : '')}>
        {items.map((item) => {
          const isActive = item.id === activeId
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={() => onNavigate?.()}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-control border px-3 py-2.5 transition-colors',
                  isActive
                    ? 'border-accent bg-accent-soft'
                    : 'border-transparent hover:border-rule hover:bg-accent-soft/50',
                )}
              >
                <span
                  className={cn(
                    'min-w-0 truncate text-body',
                    isActive ? 'font-semibold text-fg' : 'text-muted',
                  )}
                >
                  {item.title}
                </span>
                <OutlineStatus status={item.status} tone={item.tone} />
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function OutlineStatus({ status, tone }: { status: string; tone: OutlineTone }) {
  return <StatusBadge status={status} tone={tone} />
}
