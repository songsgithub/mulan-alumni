import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, Earth, Lightbulb, MapPin, Quote, Users } from 'lucide-react'

import { RichTextBlock } from '@/components/site/RichText'
import { SiteAlbum } from '@/components/site/SiteAlbum'
import { ActivityCard, NoteCard, Wrap, cnDate, museButton, projectName } from '@/components/site/muse'
import { getOutcomeBySlug, getOutcomes } from '@/lib/public-data'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const outcome = await getOutcomeBySlug((await params).slug)
  return { title: outcome?.title ?? '活动' }
}

/** 活动详情（复刻 muse ActivityDetail）：大图 Banner → 摘要批注卡 → 正文 → 活动相册 */
export default async function OutcomeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const outcome = await getOutcomeBySlug(slug)
  if (!outcome) notFound()

  const all = await getOutcomes(60, { sort: 'eventDate' })
  const related = all
    .filter(
      (o) => o.slug !== slug && (o.circle?.slug === outcome.circle?.slug || o.category === outcome.category),
    )
    .slice(0, 3)
  const photos = (outcome.gallery ?? [])
    .filter((p) => p.url)
    .map((p, i) => ({ url: p.url as string, alt: `活动相册第 ${i + 1} 张：${outcome.title}` }))
  const region = outcome.location || outcome.circle?.city

  return (
    <div className="pb-8">
      {/* 头部 Banner：圆角大画幅，标题压在梅子色暗角上 */}
      <Wrap className="pt-5 sm:pt-6">
        <section className="relative h-[clamp(22rem,44vw,34rem)] w-full overflow-hidden rounded-[2rem] bg-mulan shadow-elegant">
          {outcome.cover?.url ? (
            <Image
              src={outcome.cover.url}
              alt={`活动封面：${outcome.title}`}
              fill
              priority
              sizes="(max-width: 1600px) 100vw, 1520px"
              className="animate-in object-cover fade-in duration-700"
            />
          ) : null}
          <div className="absolute inset-0 img-shade" aria-hidden />
          <div className="absolute inset-x-0 bottom-0">
            <div className="w-full max-w-4xl p-6 sm:p-10 lg:p-14">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/90 px-3.5 py-1 text-[0.9375rem] font-medium text-magnolia backdrop-blur">
                  {projectName(outcome.category)}
                </span>
                <span className="rounded-full border border-white/30 bg-white/10 px-3.5 py-1 text-[0.9375rem] text-white backdrop-blur-md">
                  {outcome.kind}
                </span>
              </div>
              <h1 className="mt-4 font-display text-[1.875rem] leading-[1.25] font-light text-white sm:text-[2.75rem] lg:text-[3.25rem]">
                {outcome.title}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[1rem] text-white/90">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden className="size-4" /> {cnDate(outcome.date)}
                </span>
                {region ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin aria-hidden className="size-4" /> {region}
                  </span>
                ) : null}
                {outcome.circle?.name ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Users aria-hidden className="size-4" /> {outcome.circle.name}
                    {outcome.attendeeCount ? ` · ${outcome.attendeeCount} 位姐妹参与` : ''}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </Wrap>

      {/* 正文（左，最宽 46em 好读）+ 活动档案（右，吸顶） */}
      <Wrap className="mt-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link href="/activities" className={museButton('outline')}>
            <ArrowLeft aria-hidden className="size-4" /> 返回所有活动
          </Link>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <div className="min-w-0">
            {/* 活动摘要（批注卡） */}
            {outcome.excerpt ? (
              <NoteCard>
                <div className="flex gap-3">
                  <Quote aria-hidden className="size-6 shrink-0 text-magnolia" />
                  <p className="font-display text-[1.1875rem] leading-loose font-light text-ink">
                    {outcome.excerpt}
                  </p>
                </div>
              </NoteCard>
            ) : null}

            {/* 正文 */}
            {outcome.content ? (
              <article className="mt-10 text-[1.0625rem] leading-[1.95] text-ink/90 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-[1.5rem] [&_h2]:font-medium [&_h2]:text-ink [&_li]:mb-2 [&_p]:mb-5">
                <RichTextBlock data={outcome.content} />
              </article>
            ) : null}

            {/* 活动相册 */}
            {photos.length ? (
              <section className="mt-12">
                <h2 className="font-display text-[1.5rem] font-medium text-ink">活动相册</h2>
                <SiteAlbum photos={photos} title={outcome.title} />
              </section>
            ) : null}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[1.5rem] border border-line/80 bg-white p-6 shadow-card">
              <p className="hand-note text-[1rem]">活动档案</p>
              <dl className="mt-4 divide-y divide-dashed divide-line text-[1rem]">
                {[
                  ['项目', projectName(outcome.category)],
                  ['活动类别', outcome.kind],
                  ['活动时间', cnDate(outcome.date)],
                  ['活动地点', region || '——'],
                  ['参与姐妹', outcome.attendeeCount ? `${outcome.attendeeCount} 人` : '——'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="shrink-0 text-ink-muted">{label}</dt>
                    <dd className="text-right font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              {outcome.circle?.slug ? (
                <Link
                  href={`/circles/${outcome.circle.slug}`}
                  className="group mt-4 flex items-center justify-between gap-4 rounded-control bg-blush/60 px-4 py-3 transition-colors hover:bg-blush"
                >
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] text-ink-muted">主办互助团</span>
                    <span className="mt-0.5 block truncate font-medium text-ink group-hover:text-magnolia">
                      {outcome.circle.name}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[0.9375rem] font-medium text-magnolia">
                    主页 <Earth aria-hidden className="size-4" />
                  </span>
                </Link>
              ) : null}
            </div>
            <div className="glow-panel rounded-[1.5rem] border border-white p-6 text-center shadow-card">
              <Lightbulb aria-hidden className="mx-auto size-6 text-magnolia" />
              <p className="mt-3 font-display text-[1.125rem] text-ink">想组建自己的互助团？</p>
              <Link href="/about#steps" className={`${museButton('default')} mt-4`}>
                了解互助团怎么办 →
              </Link>
            </div>
          </aside>
        </div>
      </Wrap>

      {related.length ? (
        <Wrap className="mt-20">
          <h2 className="mb-6 font-display text-[1.75rem] font-light text-ink">相关活动</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {related.map((o, i) => (
              <ActivityCard key={o.slug} outcome={o} index={i + 3} />
            ))}
          </div>
        </Wrap>
      ) : null}
    </div>
  )
}
