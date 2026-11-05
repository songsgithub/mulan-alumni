import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 分页器（工作台）。
 *
 * 一行：左边「第 X–Y 条 / 共 N 条」，右边上一页 · 页码 · 下一页。
 * 页码是链接（`Button render={<Link/>}`），条件都带在地址里——
 * 翻页、分享地址都不丢筛选。
 *
 * 页数多的时候只留：首页、末页、当前页前后各一页，中间用省略号。
 */
export function Pager({
  page,
  totalPages,
  total,
  pageSize,
  hrefFor,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  hrefFor: (page: number) => string
}) {
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="分页"
      className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-rule pt-5"
    >
      <p className="text-small text-muted tabular-nums">
        第 {from}–{to} 条 / 共 {total} 条
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <Button variant="outline" render={<Link href={hrefFor(page - 1)} />}>
            上一页
          </Button>
        ) : (
          <Button variant="outline" disabled>
            上一页
          </Button>
        )}

        {pageWindow(page, totalPages).map((item, index) =>
          item === '…' ? (
            <span key={`gap-${index}`} className="px-1 text-small text-faint" aria-hidden>
              …
            </span>
          ) : (
            // 页码：与公开站分页器同一长相（44px 圆形；当前页墨色实心）
            <Link
              key={item}
              href={hrefFor(item)}
              aria-current={item === page ? 'page' : undefined}
              aria-label={`第 ${item} 页`}
              className={cn(
                'flex size-11 items-center justify-center rounded-full border font-display text-small tabular-nums transition-all duration-300 ease-soft',
                item === page
                  ? 'border-fg bg-fg text-inverse-fg'
                  : 'border-rule bg-white text-fg hover:border-accent/40 hover:text-accent',
              )}
            >
              {item}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Button variant="outline" render={<Link href={hrefFor(page + 1)} />}>
            下一页
          </Button>
        ) : (
          <Button variant="outline" disabled>
            下一页
          </Button>
        )}
      </div>
    </nav>
  )
}

/** 页码窗口：≤7 页全列；再多只留首尾与当前页附近 */
function pageWindow(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const wanted = [1, total, page - 1, page, page + 1]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b)
  const out: (number | '…')[] = []
  wanted.forEach((n, index) => {
    if (index > 0 && n - wanted[index - 1] > 1) out.push('…')
    out.push(n)
  })
  return out
}
