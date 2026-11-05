'use client'

import { FileText, FolderArchive, Printer, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type PrintMode = 'full' | 'final'

const MODE_LABEL: Record<PrintMode, string> = {
  full: '完整记录',
  final: '报销存档版',
}

const MODE_DESC: Record<PrintMode, string> = {
  full: '含每一次版本变更与审核记录，项目组内部看档用。',
  final: '只留最终提交的方案与两次审核通过结论，纸质报销归档用。',
}

/**
 * 活动材料打印（2026-11-01 第三十六轮：**分两种**）。
 *
 * - **完整记录**：申请、每一次版本变更与审核记录、反馈、报销审核全过程。
 *   项目组内部看档用——想知道"中间驳回过几次、每次改了什么"就看这份。
 * - **报销存档版**：不管中间过程，只呈现
 *   「最终提交的申请方案 + 活动审核通过 + 活动反馈 + 报销核定通过」，
 *   以及关键时间点。**纸质报销材料归档用这一份**。
 *
 * 顶栏只留一个「打印」按钮，两种放菜单里——两个按钮并排会把顶栏塞满。
 * 两种都在**当前页**弹窗里预览：浏览器的 PDF 阅读器本身就带下载 / 打印。
 *
 * 关闭按钮自己放在标题行里（不用 DialogContent 自带的绝对定位那颗）：
 * 自带那颗是 44px 的圆按钮、按 top-4 定位，中心比标题低一截，还压着标题栏的下边框。
 */
export function ActivityPrintDialog({ slug, title }: { slug: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PrintMode>('full')
  const pdfUrl = `/activities/${slug}/print/pdf${mode === 'final' ? '?mode=final' : ''}`

  const pick = (next: PrintMode) => {
    setMode(next)
    setOpen(true)
  }

  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" className="shrink-0">
              <Printer aria-hidden className="size-4" />
              打印
            </Button>
          }
        />
        <PopoverContent align="end" className="w-80 p-2">
          <p className="px-2 pt-1 pb-2 text-small font-medium text-fg">打印活动材料</p>
          <button
            type="button"
            onClick={() => pick('full')}
            className="flex w-full items-start gap-2.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-console-accent"
          >
            <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            <span className="min-w-0">
              <span className="block text-body font-medium">{MODE_LABEL.full}</span>
              <span className="mt-0.5 block text-small leading-relaxed text-muted">
                {MODE_DESC.full}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => pick('final')}
            className="flex w-full items-start gap-2.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-console-accent"
          >
            <FolderArchive aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            <span className="min-w-0">
              <span className="block text-body font-medium">{MODE_LABEL.final}</span>
              <span className="mt-0.5 block text-small leading-relaxed text-muted">
                {MODE_DESC.final}
              </span>
            </span>
          </button>
        </PopoverContent>
      </Popover>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[92dvh] w-[95vw] max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px]"
        >
          <DialogHeader className="flex flex-row items-center gap-3 border-b border-rule px-5 py-2">
            <DialogTitle className="shrink-0 text-body">
              活动材料预览 · {MODE_LABEL[mode]}
            </DialogTitle>
            <DialogDescription className="min-w-0 flex-1 truncate text-label">
              {title}
            </DialogDescription>
            <DialogClose
              aria-label="关闭预览"
              className="grid size-11 shrink-0 place-content-center rounded-full text-muted transition-colors hover:bg-console-accent hover:text-fg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <X className="size-4" />
            </DialogClose>
          </DialogHeader>

          <div className="min-h-0 flex-1 bg-surface">
            <iframe
              src={pdfUrl}
              title={`${title} · ${MODE_LABEL[mode]}`}
              className="h-full w-full border-0 bg-white"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
