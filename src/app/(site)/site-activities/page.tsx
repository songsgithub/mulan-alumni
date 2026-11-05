import { ActivityFilters } from '@/components/site/ActivityFilters'
import { ActivityCard, EmptyState, PageIntro, Pager, Wrap } from '@/components/site/muse'
import { site } from '@/content/site'
import { getOutcomes } from '@/lib/public-data'
import { filterOutcomes, readActivityFilters, regionOptions } from '@/lib/public-filter'

export const metadata = { title: '所有活动' }

const PAGE_SIZE = 12

/** 活动列表（复刻 muse ActivityList）：多维筛选 + 三列卡片 + 分页 */
export default async function ActivityListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const filters = readActivityFilters(sp)
  // 活动列表按**活动开展日期**倒序（不是项目组推送时间），2026-11-03 第四十九轮
  const all = await getOutcomes(300, { sort: 'eventDate' })
  const list = filterOutcomes(all, filters)
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(String(sp.page ?? '1'), 10) || 1))
  const pageList = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const hrefFor = (n: number) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, String(value))
    if (n > 1) query.set('page', String(n))
    const qs = query.toString()
    return `/activities${qs ? `?${qs}` : ''}`
  }

  return (
    <Wrap className="pt-10 pb-8 sm:pt-14">
      <div className="mb-8">
        <PageIntro
          title="所有活动"
          mark="活动"
          actions={<span className="text-[1rem] text-ink-muted">共 {list.length} 场活动</span>}
        />
      </div>

      <ActivityFilters
        value={filters}
        projects={site.projects.items.map((p) => ({ value: p.value, label: p.name }))}
        regions={regionOptions(all)}
      />

      {pageList.length ? (
        <>
          <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))] sm:gap-5">
            {pageList.map((o, i) => (
              <ActivityCard key={o.slug} outcome={o} index={i} />
            ))}
          </div>
          <Pager page={page} totalPages={totalPages} hrefFor={hrefFor} />
        </>
      ) : (
        <div className="mt-6">
          <EmptyState resetHref="/activities" />
        </div>
      )}
    </Wrap>
  )
}
