'use client'

import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'

/** 回到顶部（muse BackTop）：滚过一屏后出现在右下角 */
export function BackTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!show) return null
  return (
    <button
      type="button"
      aria-label="回到顶部"
      onClick={() =>
        window.scrollTo({
          top: 0,
          // 系统开了「减少动态效果」就直接跳回顶部（与 SiteLogo / SiteNav 同一口径）
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        })
      }
      className="fixed right-5 bottom-6 z-40 flex size-12 items-center justify-center rounded-full bg-magnolia text-white shadow-elegant transition-transform hover:-translate-y-0.5"
    >
      <ArrowUp className="size-5" />
    </button>
  )
}
