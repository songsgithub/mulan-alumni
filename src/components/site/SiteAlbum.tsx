'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * 活动相册（muse ActivityDetail 的相册 + Lightbox）。
 *
 * 点开大图只显示图片本身：没有标题条、没有下载与关闭按钮、没有深色边框。
 * 关闭方式：点图片外任意处、按 Esc；左右方向键或两侧箭头翻页。
 *
 * ⚠️ 「是否打开」与「看第几张」分开存：关闭时图片不能跟着卸掉，
 * 否则弹层收起动画还在播、图片已经没了，会闪一下。
 */
export function SiteAlbum({ photos, title }: { photos: { url: string; alt: string }[]; title: string }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(0)
  const count = photos.length
  const go = (step: number) => setView((i) => (i + step + count) % count)
  const current = photos[Math.min(view, count - 1)]

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <button
            key={`${photo.url}-${i}`}
            type="button"
            onClick={() => {
              setView(i)
              setOpen(true)
            }}
            aria-label={`查看大图：活动相册第 ${i + 1} 张`}
            className="group cursor-zoom-in overflow-hidden rounded-[1.5rem] border border-line bg-primrose shadow-card transition-all duration-300 hover:shadow-card-hover focus-visible:ring-[3px] focus-visible:ring-mountain/30 focus-visible:outline-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.alt}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1)
            if (e.key === 'ArrowLeft') go(-1)
          }}
          className="w-fit max-w-[96vw] gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-[96vw]"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">左右方向键切换图片，Esc 关闭</DialogDescription>
          {/* 容器跟着图片宽度走，左右切换按钮才贴在图片边上而不是容器边上 */}
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={current.alt} className="block max-h-[86dvh] w-auto max-w-[96vw] object-contain" />

            {count > 1
              ? (['left', 'right'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    aria-label={side === 'left' ? '上一张' : '下一张'}
                    onClick={() => go(side === 'left' ? -1 : 1)}
                    className={cn(
                      'absolute top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/55',
                      side === 'left' ? 'left-3' : 'right-3',
                    )}
                  >
                    {side === 'left' ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
                  </button>
                ))
              : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
