import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * 工作台统一的页头。
 *
 * 全站只有一种页头：**左边标题（+ 徽标），右边帮助与操作**。
 *
 * ## 顶边永远是 97px
 *
 * 标题顶边等于容器的内容顶边（`main` 的 `py-8` 之下那 32px）。
 * 右边有没有按钮、徽标有多高，标题都不动（标题 `self-start` 钉在行顶）。
 *
 * ## 页头不放解释
 *
 * 这一页的说明（口径、谁能看到）一律写进 `help`（问号弹窗），页头只留标题。
 * 2026-10-31 起删掉了兜底用的 `note` / `description`：所有页面都已改用 `help`。
 */
export function PageHeader({
  title,
  mark,
  help,
  meta,
  actions,
  className,
}: {
  title: string
  /** 标题里要强调的几个字（必须是 title 的结尾部分，与公开站 PageIntro 同一写法） */
  mark?: string
  /** 「帮助」弹窗：这一页是做什么的 */
  help?: ReactNode
  /** 标题旁边的徽标（类别 / 状态这类） */
  meta?: ReactNode
  /** 右侧操作 */
  actions?: ReactNode
  className?: string
}) {
  // mark 可以是标题里任意一段（首页是「名字」，其它页是结尾那几个字）
  const at = mark ? title.indexOf(mark) : -1
  const marked = at >= 0 ? mark : undefined
  const before = at >= 0 ? title.slice(0, at) : title
  const after = at >= 0 ? title.slice(at + (marked?.length ?? 0)) : ''
  // min-h-11：右侧操作按钮高 44px，没有按钮的页面也占同样的高度，
  // 否则下一块内容会比有按钮的页面高 12px
  return (
    <div
      className={cn(
        'flex min-h-11 flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-rule/70 pb-6',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="self-start font-display text-page-title font-light tracking-[0.02em] text-fg">
            {before}
            {marked ? <span className="mark-soft font-medium">{marked}</span> : null}
            {after}
          </h1>
          {meta}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {help}
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  )
}
