'use client'

import { useEffect, useRef, useState } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

/** 文档里可放大的图片：不在链接 / 表单里的 <img> */
const zoomable = (el: Element | null): el is HTMLImageElement =>
  Boolean(el && el.tagName === 'IMG' && !el.closest('a') && !el.closest('form'))

/**
 * 文档里的图片点击放大（只作用于网页，不改变 PDF 渲染）。
 * 用事件委托：文档内所有 <img> 点一下弹层看大图。
 *
 * 键盘也能用（WCAG 2.1.1）：图片挂载后补上 tabindex=0 与「按回车放大」的说明，
 * 聚焦到图片上按 Enter / 空格同样打开大图。
 */
export function DocZoom({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [alt, setAlt] = useState('')

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const open = (img: HTMLImageElement) => {
      setSrc(img.currentSrc || img.src)
      setAlt(img.alt || '图片')
    }
    // 把文档里的图片变成可聚焦的「按钮」（内容会随编辑变化，用 MutationObserver 跟上）
    const mark = () => {
      root.querySelectorAll('img').forEach((img) => {
        if (!zoomable(img) || img.hasAttribute('data-zoom')) return
        img.setAttribute('data-zoom', '')
        img.tabIndex = 0
        img.setAttribute('role', 'button')
        img.setAttribute('aria-label', `${img.alt || '图片'}（按回车放大）`)
      })
    }
    mark()
    const observer = new MutationObserver(mark)
    observer.observe(root, { childList: true, subtree: true })

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!zoomable(target)) return
      event.preventDefault()
      open(target)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const target = event.target as Element | null
      if (!zoomable(target)) return
      event.preventDefault()
      open(target)
    }
    root.addEventListener('click', onClick)
    root.addEventListener('keydown', onKey)
    return () => {
      observer.disconnect()
      root.removeEventListener('click', onClick)
      root.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div ref={ref} className="contents [&_img]:cursor-zoom-in">
      {children}
      <Dialog open={Boolean(src)} onOpenChange={(open) => !open && setSrc(null)}>
        {/* 两个断点的宽度都写全：只写 max-w-4xl 会被基础类的 sm:max-w-lg 压成 512px */}
        <DialogContent className="max-w-[calc(100vw-2rem)] p-3 sm:max-w-4xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <DialogDescription className="sr-only">查看大图</DialogDescription>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt} className="max-h-[82vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
