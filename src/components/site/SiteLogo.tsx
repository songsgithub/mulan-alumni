'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { BrandMark } from '@/components/console/BrandMark'
import { BrandSlogan } from '@/components/console/BrandSlogan'

/**
 * 公开站顶栏标识：**只放官方组合标**。
 *
 * 2026-11-04：标识换成新版组合标（`public/brand/mulan-logo.svg`），
 * 画面里已经写了「数字木兰校友会」，后面再挂一个竖线 +「校友会」纯属重复，已去掉。
 *
 * 尺寸：新版标识字重很粗，字画得越大笔画间的空隙越多、看着才清楚，
 * 但也不能大过导航 —— 36px 是刚好的量级：比 44px 更收敛（标识宽 267px，
 * 只占顶栏五分之一），笔画里的空隙还撑得住，不至于糊成一团。
 *
 * 已经在首页时，点它不会触发路由跳转（同一路径），浏览器也就不会滚动——
 * 所以这里补一手：已经在家就滚回顶部。
 */
export function SiteLogo({ wordmark }: { wordmark: string }) {
  const pathname = usePathname() ?? ''
  const atHome = pathname === '/'

  return (
    <Link
      href="/"
      title={wordmark}
      onClick={() => {
        if (atHome) {
          window.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          })
        }
      }}
      className="flex min-h-11 items-center gap-3"
    >
      {/* 窄屏只有标识 + 汉堡按钮，24px 刚好（再宽就顶到屏幕边了） */}
      <BrandMark size={24} className="sm:hidden" />
      {/* ≥640px：画到 30px —— 标识里字的墨迹占画布 80%，所以 30px → 字高 24px，
          是导航正文（16px）的 1.5 倍：比 24px 有存在感，又不像 36px 那样压过导航。 */}
      <BrandMark size={30} className="hidden sm:inline-flex" />
      {/* 标语「AI时代 木兰同行」：放在标识后面。
          1024px 那段顶栏放不下（标识 + 标语 + 五个导航会超宽），所以 1280px 起才出现。
          ⚠️ 往下挪 4px：实测标语字身的基线比标识高 5px，不对齐会显得「飘」；
          挪下来之后两边的字身基本坐在同一条基线上（行字的拖尾自然垂到基线以下）。 */}
      <BrandSlogan size={28} className="hidden translate-y-[4px] xl:inline-flex" />
    </Link>
  )
}
