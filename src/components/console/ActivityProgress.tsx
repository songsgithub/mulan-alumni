'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

import { ActivityOutline, type OutlineItem } from '@/components/console/ActivityOutline'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHandle,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

/**
 * 窄屏用的「活动进度」：一行紧凑状态条 + 一个按钮，点了从**底部升起**完整清单。
 *
 * 为什么不是直接铺在正文上方：
 * 那四个环节在正文里已经各有一个标题（① 活动方案 / ② 审批 / …），
 * 手机上再铺一份目录等于白占一屏。
 * 所以上面只留一条"走到哪了"的横条，清单收进底部抽屉（shadcn/ui 的 `Sheet`）。
 */
export function ActivityProgress({ items }: { items: OutlineItem[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {/* min-w-0：flex 子项默认不肯缩到内容宽度以下，不写就会把整页撑出横向滚动 */}
        <ol
          aria-label="环节状态"
          // relative：里面读屏用的 sr-only 是绝对定位，不以这里为包含块就会逃出裁剪、把窄屏撑宽
          className="relative -mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
        >
          {items.map((item) => (
            <li key={item.id} className="shrink-0">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-small font-medium whitespace-nowrap',
                  item.tone === 'done' && 'bg-success-soft text-success',
                  item.tone === 'active' && 'bg-accent-soft text-accent',
                  item.tone === 'pending' && 'bg-surface text-muted',
                  item.tone === 'stop' && 'bg-danger-soft text-danger',
                )}
              >
                {item.tone === 'done' ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
                {item.title}
                <span className="sr-only">：{item.status}</span>
              </span>
            </li>
          ))}
        </ol>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="outline" className="shrink-0" />}>
            活动进度
          </SheetTrigger>
          <SheetContent side="bottom" className="gap-0">
            <SheetHandle />
            <SheetHeader>
              <SheetTitle>活动进度</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <ActivityOutline items={items} title={null} onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
