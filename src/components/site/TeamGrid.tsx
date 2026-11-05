'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { CircleSummary } from '@/lib/public-data'
import { cn } from '@/lib/utils'

import { EmptyState, TeamCard, projectName } from './muse'

/** 互助团搜索 + 卡片网格（muse TeamList）。优化：多了按项目筛选，搜索也匹配城市 */
export function TeamGrid({ circles, projects }: { circles: CircleSummary[]; projects: { value: string; label: string }[] }) {
  const [keyword, setKeyword] = useState('')
  const [project, setProject] = useState('')
  const filtered = useMemo(() => {
    const k = keyword.trim()
    return circles.filter(
      (c) =>
        (!project || c.category === project) &&
        (!k || [c.name, c.city, c.theme, projectName(c.category)].some((t) => t?.includes(k))),
    )
  }, [circles, keyword, project])

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form role="search" onSubmit={(e) => e.preventDefault()} className="flex w-full max-w-md items-center gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索互助团名称或城市…"
            aria-label="搜索互助团"
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-3 text-[1rem] outline-none placeholder:text-ink-muted focus-visible:border-magnolia/50 focus-visible:ring-[3px] focus-visible:ring-magnolia/15"
          />
          <button
            type="submit"
            aria-label="搜索互助团"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-card"
          >
            <Search className="size-4" />
          </button>
        </form>
        <div role="group" aria-label="按项目筛选" className="flex flex-wrap gap-1.5">
          {[{ value: '', label: '全部' }, ...projects].map((p) => {
            const on = project === p.value
            return (
              <button
                key={p.value || 'all'}
                type="button"
                aria-pressed={on}
                onClick={() => setProject(p.value)}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-[1rem] transition-all duration-300',
                  on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink/75 hover:border-magnolia',
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 与 network 的团卡列表同一套密度：最小 22rem 自动铺列，宽屏一行 4 张 */}
      {filtered.length ? (
        <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))] sm:gap-5">
          {filtered.map((c) => (
            <TeamCard key={c.slug} circle={c} />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState title="没有找到这支互助团" hint="换个名字试试，或先去首页认识其它姐妹团队" />
        </div>
      )}
    </>
  )
}
