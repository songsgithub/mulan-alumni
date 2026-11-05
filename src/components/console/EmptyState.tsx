import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * 工作台统一的空状态。
 *
 * 之前每个页面各写一句灰字（"没有符合条件的通知" / "这一类还没有资源"），
 * 冷冰冰、也没给出路。现在统一成公众站空状态的同一个语气：
 * 一枚花饰徽标 + 一句标题 + 一句提示 + 可选的出口按钮。
 *
 * 花饰是自己画的一份线稿（不引用 `src/components/site/` 的 `Sprig`）：
 * 公众站与工作台各用各的 token 与组件，不互相引用（见 docs/设计规范.md §4.2.2）。
 */
export function EmptyState({
  title,
  hint,
  actions,
  compact = false,
  className,
}: {
  /** 一句话说清「这里为什么是空的」 */
  title: string
  /** 补一句「可以怎么办」 */
  hint?: string
  /** 出口按钮（清空筛选 / 回到首页 / 去上传…） */
  actions?: ReactNode
  /** 紧凑版：放在列表 / 弹层 / 表格里（没有柔光面板，徽标小一号） */
  compact?: boolean
  className?: string
}) {
  // 完整版与公开站的空状态同一长相：柔光面板 + 白色圆徽标 + 花饰
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'px-4 py-8' : 'glow-panel rounded-[1.5rem] border border-rule px-6 py-14 shadow-card',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex items-center justify-center rounded-full text-accent',
          compact ? 'size-12 bg-accent-soft' : 'size-20 bg-white shadow-card',
        )}
      >
        <Sprig className={compact ? 'size-6' : 'size-10'} />
      </span>
      <p className={cn('font-display font-medium text-fg', compact ? 'mt-3 text-body' : 'mt-5 text-title')}>
        {title}
      </p>
      {hint ? <p className="mt-2 max-w-md text-small leading-relaxed text-muted">{hint}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  )
}

/** 花饰：一枝细线木兰（工作台版，线稿与公众站同款但独立维护） */
function Sprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn('shrink-0', className)}>
      <path d="M16 28c0-7 0-12 0-16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M16 12c-3.6-1-5.6-4.2-5-8 3.6.6 5.8 3.6 5 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M16 12c3.6-1 5.6-4.2 5-8-3.6.6-5.8 3.6-5 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M16 20c-2.8-.2-5-2-5.6-4.6 2.8-.2 5 1.6 5.6 4.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M16 23c2.8-.2 5-2 5.6-4.6-2.8-.2-5 1.6-5.6 4.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}
