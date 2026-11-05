import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * 详情页的「返回上一级」链接（工作台统一一处）。
 *
 * 2026-11-02 第四十一轮：互助团详情页与活动详情页各写各的返回入口，
 * 一个是页头右侧的按钮（挤在「公开主页」「编辑资料」中间）、
 * 一个是吸顶条里的一行小字。现在两页共用这一个组件：
 *
 * - **放在页面左边**：返回是「往回走」，入口该在起点那一侧，
 *   右上角那堆操作按钮是「往里走」的动作，两者混在一起会点错；
 * - **文案写清楚去哪**：光一个箭头太抽象，「返回互助团」四个字
 *   对 27–55 岁的用户更省事（公开站的详情页也用「返回所有活动」这套说法）；
 * - **不用面包屑**：工作台只有「列表 → 详情」一层，
 *   顶栏那四个主导航已经说明了��在哪，面包屑是重复信息，还占竖向空间。
 *
 * 样式是安静的一行小字，悬停才变深色——它不该跟页头标题抢注意力。
 */
export function PageBackLink({
  href,
  children,
  className,
}: {
  /** 回到哪里 */
  href: string
  /** 写清回到哪：返回互助团 / 返回活动 */
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 text-small text-muted transition-colors hover:text-fg',
        className,
      )}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {children}
    </Link>
  )
}
