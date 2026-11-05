'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 首页的大数字：滚到眼前时从 0 数上去（参考 ashoka.org 首页的做法）。
 *
 * - 用 `IntersectionObserver`：数字块**进入视口**才开动，离开再回来不重播；
 * - 缓动用 `easeOutExpo`（开头快、末尾慢），1.6 秒数完；
 * - 系统开了「减少动态效果」就直接给最终值，不做动画；
 * - 数字本身对读屏软件始终是**最终值**（`aria-label`），动画过程不让读屏念中间数。
 */

const DURATION = 1600

/** 缓出指数曲线：前段快、后段慢，末尾正好停在整数上 */
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

export function CountUpNumber({
  value,
  className,
}: {
  /** 最终值；非数字（比如「—」）时原样显示 */
  value: number | string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const target = typeof value === 'number' ? value : Number.NaN
  // ⚠️ 服务端渲染时**先显示 0**（不是最终值）：否则用户先看到 53，
  //    滚到眼前又跳回 0 再数上去，会闪一下。首帧由客户端补上。
  const [display, setDisplay] = useState<number | string>(Number.isFinite(target) ? 0 : value)
  const done = useRef(false)

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setDisplay(value)
      return
    }
    const el = ref.current
    if (!el) return

    // 减少动态效果：直接显示最终值
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target)
      return
    }

    let raf = 0
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry.isIntersecting || done.current) return
        done.current = true
        observer.disconnect()

        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION)
          // 末尾取整，避免出现 12.999 这种闪烁
          setDisplay(t === 1 ? target : Math.round(target * easeOutExpo(t)))
          if (t < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.35 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [target, value])

  const text = typeof display === 'number' ? display.toLocaleString('zh-CN') : display

  return (
    <span ref={ref} className={className} aria-label={typeof value === 'number' ? String(value) : undefined}>
      {text}
      {/* 禁用 JS 时给真实数字（动效要靠 JS，页面上的地图与轮播本来也需要 JS） */}
      {typeof value === 'number' ? <noscript>{value.toLocaleString('zh-CN')}</noscript> : null}
    </span>
  )
}
