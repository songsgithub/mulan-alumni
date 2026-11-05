import Link from 'next/link'

import { EmptyState, PageIntro, ResourceCard, Wrap } from '@/components/site/muse'
import { FILE_KIND_LABEL, RESOURCE_CATEGORY_LABEL } from '@/lib/labels'
import { getLibrary } from '@/lib/public-data'
import { cn } from '@/lib/utils'

export const metadata = { title: '资源' }

/** 资源（文档 / 视频）：按形态与分类筛选，四列卡片。任何人都能打开、下载 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; type?: string }>
}) {
  const { category, type } = await searchParams
  const all = await getLibrary(60)
  const active = category && RESOURCE_CATEGORY_LABEL[category] ? category : ''
  const isVideo = (i: (typeof all)[number]) =>
    i.type === 'video' || Boolean(i.file?.mimeType?.startsWith('video/'))
  const activeType = type === 'doc' || type === 'video' ? type : ''
  const typed = activeType ? all.filter((i) => (activeType === 'video' ? isVideo(i) : !isVideo(i))) : all
  const items = active ? typed.filter((i) => i.category === active) : typed
  // 分类只列当前形态下真有的（筛到「视频」时不必显示空分类）
  const categories = Object.entries(RESOURCE_CATEGORY_LABEL).filter(([value]) =>
    typed.some((i) => i.category === value),
  )
  const typeTabs: { value: '' | 'doc' | 'video'; label: string }[] = [
    { value: '', label: '全部' },
    { value: 'doc', label: '文档' },
    { value: 'video', label: '视频' },
  ]
  const hrefWith = (patch: { category?: string; type?: string }) => {
    const query = new URLSearchParams()
    const nextCategory = patch.category ?? active
    const nextType = patch.type ?? activeType
    if (nextCategory) query.set('category', nextCategory)
    if (nextType) query.set('type', nextType)
    const qs = query.toString()
    return `/resources${qs ? `?${qs}` : ''}`
  }
  const chip = (on: boolean) =>
    cn(
      'inline-flex min-h-11 items-center rounded-full border px-4 text-[1rem] transition-all duration-300',
      on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink/75 hover:border-magnolia',
    )

  return (
    <Wrap className="pt-10 pb-8 sm:pt-14">
      <PageIntro
        title="资源"
        actions={
          <span className="text-[1rem] text-ink-muted">
            {active || activeType ? `筛出 ${items.length} 份 · 共 ${all.length} 份` : `共 ${all.length} 份`}
          </span>
        }
      />
      {/* 形态：文档 / 视频 */}
      <nav aria-label="资源形态" className="mt-6 flex flex-wrap gap-1.5">
        {typeTabs.map((tab) => {
          const count =
            tab.value === 'video'
              ? all.filter(isVideo).length
              : tab.value === 'doc'
                ? all.filter((i) => !isVideo(i)).length
                : all.length
          return (
            <Link
              key={tab.value || 'all'}
              href={hrefWith({ type: tab.value })}
              aria-current={activeType === tab.value ? 'page' : undefined}
              className={chip(activeType === tab.value)}
            >
              {tab.label}
              <span className="ml-1.5 tabular-nums">{count}</span>
            </Link>
          )
        })}
      </nav>

      {categories.length ? (
        <nav aria-label="资源分类" className="mt-3 flex flex-wrap gap-1.5">
          <Link href={hrefWith({ category: '' })} aria-current={!active ? 'page' : undefined} className={chip(!active)}>
            全部分类
          </Link>
          {categories.map(([value, label]) => (
            <Link
              key={value}
              href={hrefWith({ category: value })}
              aria-current={active === value ? 'page' : undefined}
              className={chip(active === value)}
            >
              {label}
              <span className="ml-1.5 tabular-nums">{typed.filter((i) => i.category === value).length}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {items.length ? (
        <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))] sm:gap-5">
          {items.map((item) => (
            <ResourceCard
              key={item.slug}
              item={item}
              categoryLabel={RESOURCE_CATEGORY_LABEL[item.category ?? '']}
              kindLabel={item.file?.mimeType ? FILE_KIND_LABEL[item.file.mimeType] : item.type === 'video' ? '视频' : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState title="这一类还没有资源" hint="换个分类看看，或回到全部资源" resetHref="/resources" />
        </div>
      )}
    </Wrap>
  )
}
