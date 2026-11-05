'use client'

import { useCallback, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface GalleryPhoto {
  id: string | number
  url: string
  alt: string
}

/**
 * 照片墙：统一尺寸的方形缩略图，一排 5 张（悬停轻微放大）+ 灯箱（上一张 / 下一张、键盘左右键、Esc 关闭、计数）。
 * 每组照片自成一个灯箱序列——翻页只在本场活动里翻。
 *
 * 灯箱的弹窗宽度**跟随图片本身**（w-fit），图片按原比例等比缩放、不设固定外框，所以周围没有多余的背景。
 * 标题与下载 / 关闭放在弹窗顶部，不压在图片上。
 *
 * ⚠️ 关闭时**不能**把当前图片一起卸掉：弹层的收起动画还在播，图片一消失就会闪。
 * 所以「是否打开」与「正在看哪一张」分开保存，关闭只切换前者。
 */
export function PhotoGallery({ photos, title }: { photos: GalleryPhoto[]; title: string }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(0)
  const count = photos.length

  const go = useCallback(
    (step: number) => setView((i) => (i + step + count) % count),
    [count],
  )

  // 弹层会把焦点圈在自己里面，键盘事件在弹层上接（挂 window 会被弹层拦下）
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      go(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      go(-1)
    }
  }

  if (!count) return null
  const current = photos[Math.min(view, count - 1)]

  return (
    <>
      {/* 窄屏 3 列（5 列在 320px 屏上每格只有 52px，缩略图看不清） */}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
        {photos.map((photo, i) => (
          <li key={photo.id} className="min-w-0">
            <button
              type="button"
              onClick={() => {
                setView(i)
                setOpen(true)
              }}
              aria-label={`查看大图：${photo.alt}`}
              className="group block w-full cursor-zoom-in overflow-hidden rounded-card bg-console-muted outline-none focus-visible:ring-[3px] focus-visible:ring-accent/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.alt}
                loading="lazy"
                className={cn(
                  'aspect-square w-full object-cover transition-transform duration-500 ease-out',
                  'group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100',
                )}
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          onKeyDown={onKeyDown}
          className="w-fit min-w-[min(20rem,96vw)] max-w-[96vw] gap-0 border-0 bg-inverse-bg p-0 text-inverse-fg sm:max-w-[96vw]"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">用左右方向键切换图片，Esc 关闭</DialogDescription>

          {/* 顶部：名称 + 计数 · 下载 · 关闭 */}
          <div className="flex items-center gap-3 px-4 py-2">
            <p className="min-w-0 flex-1 truncate text-body">
              {title}
              <span className="ml-3 text-inverse-muted tabular-nums">
                {view + 1} / {count}
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={current.url}
                download
                aria-label="下载这张"
                className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10"
              >
                <Download className="size-5" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭"
                className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* 图片：按原比例缩放，弹窗跟着它的尺寸走 */}
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.alt}
              className="block h-auto max-h-[80dvh] w-auto max-w-[96vw]"
            />

            {count > 1 ? (
              <>
                <LightboxButton side="left" label="上一张" onClick={() => go(-1)}>
                  <ChevronLeft className="size-6" />
                </LightboxButton>
                <LightboxButton side="right" label="下一张" onClick={() => go(1)}>
                  <ChevronRight className="size-6" />
                </LightboxButton>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function LightboxButton({
  side,
  label,
  onClick,
  children,
}: {
  side: 'left' | 'right'
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      {children}
    </button>
  )
}
