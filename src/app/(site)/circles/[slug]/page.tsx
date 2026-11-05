import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  CalendarHeart,
  Camera,
  Download,
  FolderOpen,
  UserRound,
  Users,
  UsersRound,
  Link2,
  MapPin,
} from 'lucide-react'

import { EmptyState, NoteCard, ProjectTag, Sprig, Wrap, cnDate, museButton, projectName } from '@/components/site/muse'
import { getCircleBySlug } from '@/lib/public-data'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const circle = await getCircleBySlug((await params).slug)
  return { title: circle?.name ?? '互助团' }
}

/** 互助团详情（复刻 muse TeamDetail）：Banner → 关于我们 + 骨干成员 → 活动动态（时间轴） */
export default async function CircleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const circle = await getCircleBySlug((await params).slug)
  if (!circle) notFound()

  // 不再组织新活动（已解散）的团：公开页照常展示，只是安静地说明一句
  const stopped = circle.status === 'closed'

  // 主页大图：工作台设的优先；没设就用最近一场活动的现场照片
  const banner = circle.cover?.url || circle.latest?.cover?.url
  const bannerAlt = circle.cover?.alt || `${circle.name} 活动合照`

  // 骨干成员：团长来自账号，其余四个只存名字；没填的角色不显示，也不解释职责。
  // 骨干成员：按「职能」选图标（lucide 线性）；团长用站内标识里的那个记号（品牌呼应）
  const teamRows = [
    { role: '团长', person: circle.leaderName, icon: UserRound },
    { role: '副团长', person: circle.team?.viceLeader, icon: UsersRound },
    { role: '资源对接员', person: circle.team?.resourceLiaison, icon: Link2 },
    { role: '材料整理员', person: circle.team?.materials, icon: FolderOpen },
    { role: '拍摄宣传员', person: circle.team?.media, icon: Camera },
  ].filter((row) => Boolean(row.person))

  return (
    <div className="pb-8">
      {/* 头部 Banner：圆角大画幅 */}
      <Wrap className="pt-5 sm:pt-6">
        <section className="relative h-[clamp(22rem,44vw,34rem)] w-full overflow-hidden rounded-[2rem] bg-mulan shadow-elegant">
          {banner ? (
            <Image
              src={banner}
              alt={bannerAlt}
              fill
              priority
              sizes="(max-width: 1600px) 100vw, 1520px"
              className="object-cover"
            />
          ) : null}
          <div className="absolute inset-0 img-shade" aria-hidden />
          <div className="absolute inset-x-0 bottom-0">
            <div className="w-full max-w-4xl p-6 sm:p-10 lg:p-14">
              <h1 className="font-display text-[1.875rem] font-light text-white sm:text-[2.75rem] lg:text-[3.25rem]">
                {circle.name}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[1rem] text-white/90">
                {circle.createdAt ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarHeart aria-hidden className="size-4" /> {cnDate(circle.createdAt)} 成立
                  </span>
                ) : null}
                {circle.regionShort || circle.city ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin aria-hidden className="size-4" /> {circle.regionShort || circle.city}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Users aria-hidden className="size-4" /> {circle.outcomeCount || 0} 场活动 · 覆盖{' '}
                  {circle.people || 0} 人
                </span>
              </div>
            </div>
          </div>
        </section>
      </Wrap>

      <Wrap className="mt-8">
        <div className="mb-8">
          <Link href="/circles" className={museButton('outline')}>
            <ArrowLeft aria-hidden className="size-4" /> 返回互助团风采
          </Link>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <div className="min-w-0">
            {/* 关于我们 */}
            <NoteCard>
              <p className="hand-note text-[1rem]">关于我们</p>
              <p className="mt-3 font-display text-[1.1875rem] leading-loose font-light text-ink">
                {circle.description ||
                  `${circle.name}由${circle.city ?? '当地'}参加过「${projectName(circle.category)}」的姐妹自主发起，大家基于共同的地域和职业需求聚在一起，有事就聚、有需就办，在技能提升、情感支持和生活互助中一起成长。`}
              </p>
              {/* 不再组织新活动的团：只说一句事实，不打「解散」这种终结性的标签，
                  也不放到标题旁边——避免让人误以为整个项目黄了 */}
              {stopped ? (
                <p className="mt-4 text-[1rem] leading-relaxed text-ink-muted">
                  {circle.outcomes.length
                    ? '这个互助团现在没有组织新活动了，已经办过的活动都留在这儿。'
                    : '这个互助团现在没有组织新活动了。'}
                </p>
              ) : null}
            </NoteCard>

            {/* 活动动态：时间轴 */}
            <section className="mt-14">
              <h2 className="font-display text-[1.875rem] font-light text-ink">
                <span className="mark-soft font-medium">活动动态</span>
              </h2>
              {circle.outcomes.length === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    title={stopped ? '这个互助团没有留下公开活动' : '这支队伍近期还没有活动'}
                    hint={stopped ? '它现在没有组织新活动了' : '姐妹们正在筹备新内容，过几天再来看看～'}
                  />
                </div>
              ) : (
                <ol className="relative mt-8 border-l border-dashed border-magnolia/30 pl-8">
                  {circle.outcomes.map((o) => (
                    <li key={o.slug} className="relative mb-6 last:mb-0">
                      <span
                        aria-hidden
                        className="absolute top-7 -left-[41px] size-4 rounded-full border-[3px] border-magnolia bg-white ring-4 ring-blush"
                      />
                      <Link
                        href={`/activities/${o.slug}`}
                        className="group grid gap-5 rounded-[1.5rem] border border-line/80 bg-white p-3 shadow-card transition-all duration-500 ease-soft hover:-translate-y-1 hover:shadow-card-hover sm:grid-cols-[13rem_minmax(0,1fr)]"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden rounded-[1.125rem] bg-blush">
                          {o.cover?.url ? (
                            <Image
                              src={o.cover.url}
                              alt={`活动封面：${o.title}`}
                              fill
                              sizes="208px"
                              className="object-cover transition-transform duration-700 ease-soft group-hover:scale-[1.05]"
                            />
                          ) : (
                            <span
                              className="absolute inset-0 flex items-center justify-center text-magnolia/30"
                              aria-hidden
                            >
                              <Sprig className="size-12" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 py-1 pr-2">
                          <p className="hand-note text-[1rem]">{cnDate(o.date)}</p>
                          <h3 className="mt-1.5 font-display text-[1.25rem] font-semibold text-ink transition-colors group-hover:text-magnolia">
                            {o.title}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <ProjectTag value={o.category} className="shadow-none ring-1 ring-line" />
                            <span className="rounded-full bg-blush px-3 py-1 text-[0.9375rem] text-primrose-fg">
                              {o.kind}
                            </span>
                          </div>
                          {o.excerpt ? (
                            <p className="mt-2 line-clamp-2 text-[1rem] leading-relaxed text-ink-muted">
                              {o.excerpt}
                            </p>
                          ) : null}
                          <span className="mt-2 inline-block text-[1rem] text-magnolia underline-offset-4 group-hover:underline">
                            查看活动详情 →
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            {/* 数字 */}
            <dl className="grid grid-cols-2 divide-x divide-line rounded-[1.5rem] border border-line/80 bg-white py-5 text-center shadow-card">
              <div>
                <dd className="font-display text-[2.25rem] leading-none font-light text-ink tabular-nums">
                  {circle.outcomeCount || 0}
                </dd>
                <dt className="mt-2 text-[0.9375rem] text-ink-muted">场活动</dt>
              </div>
              <div>
                <dd className="font-display text-[2.25rem] leading-none font-light text-ink tabular-nums">
                  {circle.people || 0}
                </dd>
                <dt className="mt-2 text-[0.9375rem] text-ink-muted">人次参与</dt>
              </div>
            </dl>

            {/* 骨干成员 */}
            <div className="rounded-[1.5rem] border border-line/80 bg-white p-6 shadow-card">
              <p className="hand-note text-[1rem]">骨干成员</p>
              {teamRows.length ? (
                <ul className="mt-4 space-y-3">
                  {teamRows.map((row, i) => {
                    const Icon = row.icon
                    return (
                      <li key={row.role} className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className={
                            i === 0
                              ? 'flex size-10 shrink-0 items-center justify-center rounded-full bg-magnolia text-white'
                              : 'flex size-10 shrink-0 items-center justify-center rounded-full bg-blush text-magnolia ring-1 ring-white'
                          }
                        >
                          <Icon className="size-[1.4rem]" strokeWidth={1.6} />
                        </span>
                        <div className="flex min-w-0 flex-1 items-baseline justify-between gap-4">
                          <p className="shrink-0 text-[1rem] text-ink-muted">{row.role}</p>
                          <p className="truncate text-[1rem] font-medium text-ink">{row.person}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-[1rem] text-ink-muted">还没有填写骨干成员。</p>
              )}
            </div>

            {/* 这个团留下的资料 */}
            {circle.resources.length ? (
              <div className="rounded-[1.5rem] border border-line/80 bg-white p-6 shadow-card">
                <p className="hand-note text-[1rem]">留下的资料</p>
                <ul className="mt-3 divide-y divide-dashed divide-line">
                  {circle.resources.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/resources/${r.slug}`}
                        className="group flex min-h-12 items-center justify-between gap-3 py-2"
                      >
                        <span className="min-w-0 truncate font-medium text-ink group-hover:text-magnolia">
                          {r.title}
                        </span>
                        <Download aria-hidden className="size-4 shrink-0 text-magnolia" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </Wrap>
    </div>
  )
}
