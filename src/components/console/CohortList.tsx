'use client'

import { EmptyState } from '@/components/console/EmptyState'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SearchField } from '@/components/console/SearchField'
import { StatusBadge } from '@/components/console/StatusBadge'
import type { CirclePoint, MapNode } from '@/lib/circle'

const PAGE_SIZE = 30

/**
 * 互助团列表（工作台 /circles 右侧）。
 *
 * 团多了以后要解决四件事：
 * 1. **一屏放不下** → 分段显示（默认 30 条，可继续加载），页面不会被拉到几千行；
 * 2. **找特定的一个** → 团名 / 城市 / 区县 / 类别都能搜，搜索框可一键清空；
 * 3. **扫得动** → 每行只留三样关键信息（团名+类别 / 地点 / 成员数），主题收成一行省略；
 * 4. **和地图是一回事** → 点一行，地图下钻到那个区县并高亮（`onLocate`）；
 *    点地图，列表按这个地域筛（`scope`），地域标记写在**搜索框里**（看得见正在搜哪一片）。
 */
export function CohortList({
  items,
  canManage = false,
  activeId,
  onLocate,
  pageSize = PAGE_SIZE,
  actionLabel = '查看',
  actionHref,
  allHref,
  scope = null,
  total,
  onClearScope,
}: {
  items: CirclePoint[]
  /** 项目组能进成员管理 */
  canManage?: boolean
  /** 当前在地图上被定位的那一条 */
  activeId?: number | string
  /** 点某一条：让地图定位到它 */
  onLocate?: (item: CirclePoint) => void
  /** 一页显示多少条；传一个大数就是"全部列出" */
  pageSize?: number
  /** 每条右侧的行动入口文案 */
  actionLabel?: string
  /** 每条右侧的行动入口地址（默认看这个团的详情页） */
  actionHref?: (item: CirclePoint) => string
  /** 列表已全部列出时，底部给一个「全部互助团」的入口 */
  allHref?: string
  /** 当前按地域筛着的（点地图选中的那一片） */
  scope?: MapNode | null
  /** 地域筛选前的总团数（用来显示「X / Y 个」） */
  total?: number
  /** 清除地域筛选 */
  onClearScope?: () => void
}) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(pageSize)

  // 顺序由服务端按团名拼音排好，这里只做搜索筛选，不再重排
  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return items
    return items.filter(
      (item) =>
        item.name.includes(q) ||
        item.city.includes(q) ||
        item.district.includes(q) ||
        item.categoryLabel.includes(q),
    )
  }, [items, query])

  const shown = filtered.slice(0, limit)

  /** 分母：按地域筛着时是筛选前的总数，否则就是全部 */
  const totalCount = scope ? (total ?? items.length) : items.length
  const countText =
    filtered.length === totalCount ? `${totalCount} 个` : `${filtered.length} / ${totalCount} 个`

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-4">
        <h2 className="section-title">
          互助团
          <span className="ml-2 text-small font-normal text-muted">{countText}</span>
        </h2>
      </div>

      {/* 搜索框：地图选中的地域作为**框里的筛选标记**，写在哪就搜哪一片 */}
      <div className="border-b border-rule px-5 py-3">
        <SearchField
          value={query}
          onChange={(next) => {
            setQuery(next)
            setLimit(pageSize)
          }}
          placeholder="搜团名 / 城市 / 区县 / 项目"
          ariaLabel="搜索互助团"
          leading={
            scope ? (
              // 整枚标记就是「清除」按钮：44px 高，比框里再塞一个小 × 好点
              <button
                type="button"
                onClick={onClearScope}
                aria-label={`清除地域筛选：${scope.name}`}
                className="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-accent bg-accent-soft pr-3 pl-3.5 text-small text-accent transition-colors hover:bg-accent/15 hover:text-accent-strong"
              >
                {scope.name}
                <X aria-hidden className="size-4" />
              </button>
            ) : null
          }
        />
      </div>

      {/* 桌面：这块自己滚动；窄屏：跟着页面一起滚（不套可滚动框）。 */}
      <ul className="min-h-0 flex-1 divide-y divide-rule overflow-visible xl:overflow-y-auto">
        {shown.map((item) => {
          const active = activeId !== undefined && String(activeId) === String(item.id)
          return (
            <li key={item.id}>
              {/* 一行两个**并列**的可点元素（不嵌套）：
                  上面是「地图定位」按钮（data-circle-row：验收脚本的稳定选择器），
                  下面是「查看 →」链接。按钮里套链接是 WCAG 4.1.2 禁止的嵌套交互。 */}
              <div
                className={`px-5 py-3 transition-colors ${
                  active ? 'bg-accent-soft' : 'duration-300 hover:bg-accent-soft/40'
                }`}
              >
                {(() => {
                  const body = (
                    <>
                      <span className="flex items-center gap-2">
                        {/* min-w-0：truncate 必须配 min-w-0 才收得下去，
                            否则团名一行会把整张列表卡撑宽（窄屏整页横向溢出）。 */}
                        <span className="min-w-0 truncate text-body font-semibold">{item.name}</span>
                        <span className="shrink-0 rounded-full border border-rule px-2 py-0.5 text-small text-muted">
                          {item.categoryLabel}
                        </span>
                        {item.status === 'closed' ? (
                          <StatusBadge status="解散" tone="pending" className="shrink-0" />
                        ) : null}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-3">
                        <span className="truncate text-small text-muted">
                          {[item.city, item.district].filter(Boolean).join(' · ')}
                        </span>
                        {item.leaderName ? (
                          <span className="shrink-0 text-small text-muted">团长 {item.leaderName}</span>
                        ) : null}
                      </span>
                      {item.theme ? (
                        <span className="mt-1 block truncate text-small text-faint">{item.theme}</span>
                      ) : null}
                    </>
                  )
                  return onLocate ? (
                    <button
                      type="button"
                      data-circle-row={item.slug}
                      aria-pressed={active}
                      aria-label={`在地图上定位：${item.name}`}
                      onClick={() => onLocate(item)}
                      className="block w-full min-w-0 text-left"
                    >
                      {body}
                    </button>
                  ) : (
                    <div data-circle-row={item.slug} className="min-w-0">
                      {body}
                    </div>
                  )
                })()}
                <Link
                  href={actionHref ? actionHref(item) : `/circles/${item.slug}`}
                  className="mt-1 inline-flex min-h-11 items-center text-small font-medium text-accent transition-colors hover:text-accent-strong"
                >
                  {actionLabel} →
                </Link>
              </div>
            </li>
          )
        })}

        {!shown.length ? (
          <li>
            <EmptyState
              compact
              title={
                query.trim()
                  ? '没有匹配的互助团'
                  : scope
                    ? `${scope.name}还没有互助团`
                    : '这个项目下还没有互助团'
              }
              hint={query.trim() ? '换个词试试，或清空搜索' : undefined}
            />
          </li>
        ) : null}
      </ul>

      {shown.length < filtered.length ? (
        <div className="shrink-0 border-t border-rule px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
          >
            显示更多（还有 {filtered.length - shown.length} 个）
          </Button>
        </div>
      ) : allHref ? (
        /* 列表已经全部列出：底部给一个去「全部互助团」页的入口 */
        <div className="shrink-0 border-t border-rule px-5 py-4">
          <Link
            href={allHref}
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-rule bg-white/80 px-4 text-body font-medium transition-all duration-300 hover:border-accent/40 hover:text-accent"
          >
            全部互助团 →
          </Link>
        </div>
      ) : null}
    </div>
  )
}
