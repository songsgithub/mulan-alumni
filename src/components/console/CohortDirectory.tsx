'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { EmptyState } from '@/components/console/EmptyState'
import { CARD_HOVER } from '@/components/console/kit'
import { SearchField } from '@/components/console/SearchField'
import { StatusBadge } from '@/components/console/StatusBadge'
import type { CirclePoint } from '@/lib/circle'
import { cn } from '@/lib/utils'

/**
 * 全部互助团名录（工作台 /circles/all）。
 *
 * 几百个团铺成一列会有几万像素长，所以这里用**紧凑网格**：
 * 一行只留 团名 + 类别 + 地点 + 团长，搜索按团名 / 城市 / 区县 / 类别过滤。
 */
export function CohortDirectory({ items }: { items: CirclePoint[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return items
    return items.filter(
      (item) =>
        item.name.includes(q) ||
        item.city.includes(q) ||
        item.district.includes(q) ||
        item.categoryLabel.includes(q) ||
        item.leaderName.includes(q),
    )
  }, [items, query])

  return (
    <div>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="搜团名 / 城市 / 区县 / 项目 / 团长"
        ariaLabel="搜索互助团"
      />

      {/* grid-cols-1：显式给一列 minmax(0,1fr)。不写的话是 auto 轨道，
          会被最宽那一条撑开，整页横向溢出。 */}
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <li key={item.id}>
            <Link
              href={`/circles/${item.slug}`}
              className={cn('block rounded-card border border-rule/70 bg-card p-4 shadow-card hover:border-accent/40', CARD_HOVER)}
            >
              {/* 团名与类别徽标：窄屏时徽标换到团名下面一行，
                  不能把徽标顶出卡片（那会让整页横向溢出）。 */}
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <span className="min-w-0 break-words font-display text-body font-semibold text-fg">
                  {item.name}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-rule px-2 py-0.5 text-small text-muted">
                    {item.categoryLabel}
                  </span>
                  {item.status === 'closed' ? (
                    <StatusBadge status="解散" tone="pending" />
                  ) : null}
                </div>
              </div>
              <p className="mt-1.5 truncate text-small text-muted">
                {[item.city, item.district].filter(Boolean).join(' · ')}
              </p>
              {item.leaderName ? (
                <p className="mt-0.5 truncate text-small text-faint">团长 {item.leaderName}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      {!filtered.length ? (
        <EmptyState
          compact
          title="没有匹配的互助团"
          hint="换个团名、城市或区县试试，搜索框里清空就能看全部。"
        />
      ) : null}
    </div>
  )
}
