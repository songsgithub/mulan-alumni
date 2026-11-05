import Link from 'next/link'
import { FilterX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 「清空筛选」按钮（工作台统一口径）。
 *
 * 样式沿用公众站 /outcomes 页的「漏斗 + 清空筛选」：
 * 药丸形、静默的辅助文字、悬停才浮出一层浅底，
 * 不与同屏的实心主按钮抢注意力。
 *
 * 颜色仍用工作台自己的 token（muted / console-accent），
 * 不搬公众站的 ink / blush —— 两套主题各自闭环。
 *
 * 用法（二选一）：
 * - `<ClearFiltersButton onClick={...} />`
 * - `<ClearFiltersButton href="/circles" />`
 */
export function ClearFiltersButton({
  onClick,
  href,
  className,
  label = '清空筛选',
}: {
  /** 点一下执行的清空动作 */
  onClick?: () => void
  /** 或者直接给一个清空后的地址（做成链接） */
  href?: string
  className?: string
  label?: string
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      render={href ? <Link href={href} /> : undefined}
      className={cn(
        'min-h-11 gap-1.5 rounded-full px-4 text-small font-normal text-muted',
        'hover:bg-console-accent hover:text-muted',
        className,
      )}
    >
      <FilterX className="size-4" />
      {label}
    </Button>
  )
}
