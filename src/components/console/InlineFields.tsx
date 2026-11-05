'use client'

import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 「一行一项」的字段列表 + 就地编辑表头。
 *
 * 查看态与编辑态共用同一套行骨架：标签在左、值/控件在右、行高固定。
 * 编辑时控件只是把右边的文字换掉，行高与卡片高度都不变（不会闪）。
 *
 * 分隔线画在**每一行自己身上**（`border-b`），不用 `divide-y`——
 * 这样这套装扮与团详情页那两张卡（团信息 / 团长）的行完全一致：
 * 标签左、值右、各自带一条分隔线。
 *
 * 两条硬规则写在这两个组件里，**页面不要再自己写版式**：
 *
 * 1. 行高与对齐（`InlineFieldRow`）：`py-3` 上下留白，行内容区 ≥ 48px，
 *    控件才不会被顶到上一条分隔线上；值列 `min-w` 等于控件宽度，
 *    标签可压缩并省略——**控件宽度与标签长短无关**，否则同一张卡里的框会长短不一。
 * 2. 控件宽度（`InlineFieldControl`）：窄屏 180px、宽屏 224px，全站一个口径。
 */

/** 控件宽度：窄屏 180px、宽屏 224px */
const INLINE_FIELD = 'w-[11.25rem] shrink-0 sm:w-56'

/**
 * 行内控件的固定宽度外壳：所有行内输入框 / 下拉框都套一层，
 * 宽度由这里统一决定——页面自己写 `max-w-56` 会在窄屏被压成不同宽度。
 */
export function InlineFieldControl({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn(INLINE_FIELD, className)}>{children}</div>
}

export function InlineFieldList({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={cn(className)}>{children}</dl>
}

export function InlineFieldRow({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-h-14 items-center justify-between gap-2 border-b border-rule py-3 last:border-b-0 last:pb-0 sm:gap-6 [&>dt]:min-w-0 [&>dt]:shrink [&>dt]:truncate [&>dd]:min-w-[11.25rem] sm:[&>dd]:min-w-56',
        className,
      )}
    >
      <dt className="shrink-0 text-small text-faint">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center justify-end text-right text-body text-fg">
        {children}
      </dd>
    </div>
  )
}

/**
 * 卡片表头：标题在左，「编辑」/「保存 + 取消」在右——三者占同一个位置、同一个高度（44px）。
 */
export function InlineEditHeader({
  title,
  editing,
  pending,
  canEdit = true,
  editLabel = '编辑',
  onEdit,
  onCancel,
}: {
  title: string
  editing: boolean
  pending: boolean
  canEdit?: boolean
  editLabel?: string
  onEdit: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <h2 className="section-title">{title}</h2>
      {editing ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? '保存中…' : '保存'}
          </Button>
        </div>
      ) : canEdit ? (
        <Button type="button" variant="outline" onClick={onEdit}>
          {editLabel}
        </Button>
      ) : null}
    </div>
  )
}
