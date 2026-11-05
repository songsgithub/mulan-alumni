'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

export interface CarouselSlide {
  key: string
  href?: string
  image?: string
  title: string
  sub: string
}

const INTERVAL = 6000

/**
 * 首页 Banner（muse 结构：精选活动轮播 + 底部大字）。
 * 第二十轮：圆角大画幅；当前那张照片缓慢推近（Ken Burns）；左下角是标题与「看看这场活动」，
 * 右下角是「01 / 05」与进度条。悬停 / 聚焦暂停，系统开了「减少动态效果」则不动。
 */
export function HomeCarousel({ slides }: { slides: CarouselSlide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const count = slides.length
  const timer = useRef<number | null>(null)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])
  useEffect(() => {
    if (count < 2 || paused || reduced) return
    timer.current = window.setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [count, paused, reduced, index])

  if (!count) return null
  const current = slides[index]
  const go = (step: number) => setIndex((i) => (i + step + count) % count)

  return (
    <section
      aria-roledescription="轮播"
      aria-label="精选活动"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="relative h-[calc(100dvh-6.75rem)] w-full overflow-hidden rounded-[2rem] bg-mulan shadow-elegant sm:h-[calc(100dvh-7.25rem)]"
    >
      {slides.map((slide, i) =>
        slide.image ? (
          <div
            key={slide.key}
            className={cn(
              'absolute inset-0 transition-opacity duration-[1200ms] ease-soft motion-reduce:transition-none',
              i === index ? 'opacity-100' : 'opacity-0',
            )}
          >
            <Image
              src={slide.image}
              alt={`精选活动轮播图：${slide.sub}`}
              fill
              priority={i === 0}
              sizes="(max-width: 1600px) 100vw, 1520px"
              className={cn(
                'object-cover transition-transform ease-linear motion-reduce:transition-none',
                i === index && !reduced ? 'scale-[1.08] duration-[7000ms]' : 'scale-100 duration-0',
              )}
            />
          </div>
        ) : null,
      )}
      {/* 梅子色暗角：底部压暗托住白字，左侧再轻轻压一点 */}
      <div className="absolute inset-0 img-shade-strong" aria-hidden />
      <div className="absolute inset-0 img-shade-side" aria-hidden />

      <div
        className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-6 p-6 sm:p-10 lg:p-14"
        aria-live="polite"
      >
        <div
          key={current.key}
          className="max-w-3xl animate-in fade-in slide-in-from-bottom-3 duration-700 motion-reduce:animate-none"
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-ink/40 px-4 py-1.5 text-[0.9375rem] tracking-[0.08em] text-white backdrop-blur-md">
            {current.title}
          </p>
          <h1 className="mt-4 font-display text-[1.875rem] leading-[1.25] font-light text-white sm:text-[2.75rem] lg:text-[3.5rem]">
            {current.sub}
          </h1>
          {current.href ? (
            <Link
              href={current.href}
              className="group mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-[1.0625rem] font-medium text-ink shadow-on-photo transition-all duration-300 hover:-translate-y-0.5 hover:bg-blush"
            >
              看看这场活动
              <ArrowUpRight
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          ) : null}
        </div>

        {count > 1 ? (
          <div className="flex items-center gap-4">
            <p className="font-display text-[1rem] tracking-[0.12em] text-white/85 tabular-nums">
              <span className="text-white">{String(index + 1).padStart(2, '0')}</span> /{' '}
              {String(count).padStart(2, '0')}
            </p>
            <div className="hidden items-center gap-1.5 sm:flex">
              {slides.map((slide, i) => (
                <button
                  key={slide.key}
                  type="button"
                  aria-label={`切换到第 ${i + 1} 张轮播图`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => setIndex(i)}
                  className="flex h-11 items-center"
                >
                  <span className="relative block h-[3px] w-8 overflow-hidden rounded-full bg-white/30">
                    <span
                      className={cn(
                        'absolute inset-y-0 left-0 rounded-full bg-white',
                        i < index && 'w-full',
                        i > index && 'w-0',
                        i === index &&
                          (paused || reduced
                            ? 'w-full'
                            : 'w-full animate-[carousel-progress_6s_linear]'),
                      )}
                    />
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <ArrowButton label="上一张" onClick={() => go(-1)}>
                <ChevronLeft className="size-5" />
              </ArrowButton>
              <ArrowButton label="下一张" onClick={() => go(1)}>
                <ChevronRight className="size-5" />
              </ArrowButton>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ArrowButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white hover:text-ink focus-visible:ring-[3px] focus-visible:ring-white/50 focus-visible:outline-none"
    >
      {children}
    </button>
  )
}
