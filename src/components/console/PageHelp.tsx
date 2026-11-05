'use client'

import { useState } from 'react'
import { CircleHelp } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * 页面的「帮助」：把这一页的解释收进一个小问号里。
 *
 * ## 为什么要有它
 *
 * 以前每页顶部都摆着两三行说明（标题 + 副标题 + 一段解释），
 * 页头比内容还高，看着累。现在页头只留**标题**（顶边仍然钉在 97px），
 * 解释收进这个问号——想看的人点一下，不想看的人眼前干净。
 *
 * 说法跟全站一个语气：写"这一页是干什么的"，不写"怎么用"。
 */
export function PageHelp({
  title,
  children,
}: {
  /** 这一页叫什么（弹窗标题） */
  title: string
  /** 说明正文：几句话、几个要点都行 */
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`${title}：这一页是做什么的`}
            title="这一页是做什么的"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-rule text-muted transition-colors hover:border-accent/40 hover:text-accent"
          >
            <CircleHelp aria-hidden className="size-5" strokeWidth={1.8} />
          </button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}的说明</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-body leading-relaxed text-muted">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
