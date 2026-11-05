import Link from 'next/link'

import { ActivityFilters } from '@/components/site/ActivityFilters'
import { CountUpNumber } from '@/components/site/CountUpNumber'
import { HomeCarousel, type CarouselSlide } from '@/components/site/HomeCarousel'
import { ProvinceChoropleth } from '@/components/site/ProvinceChoropleth'
import {
  ActivityCard,
  EmptyState,
  SectionHead,
  TeamCard,
  Wrap,
  museButton,
  projectName,
} from '@/components/site/muse'
import { site } from '@/content/site'
import { getChinaGeo, shortProvinceName } from '@/lib/china-geo'
import { getCircles, getOutcomes, getPublicStats } from '@/lib/public-data'
import { filterOutcomes, readActivityFilters } from '@/lib/public-filter'

export const metadata = {
  title: { absolute: '数字木兰校友会' },
}

const HOME_LIMIT = 6

/**
 * 首页（muse 结构）：Banner → 数字 → 最新活动（快速筛选）→ 互助团风采。
 *
 * 「从各忙各的到互相搭把手」「互助团这样办起来」「有事就聚，有需就办」三块
 * 属于"关于互助团"的说明，已移到 /about，首页只留看点与入口。
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = readActivityFilters(await searchParams)
  const quick = { project: filters.project, kind: filters.kind }
  // 首页是**现状**：团数、地图、覆盖行政区都只算还在组织新活动的团；
  // 已解散的团页面照常公开（历史算数），但不进首页的现状数据。
  const [outcomes, stats, circles] = await Promise.all([
    // 成果流按**活动开展日期**倒序（不是项目组推送时间），2026-11-03 第四十九轮
    getOutcomes(200, { sort: 'eventDate' }),
    getPublicStats(),
    getCircles(200, { activeOnly: true }),
  ])
  const list = filterOutcomes(outcomes, quick)

  // Banner：最近几场有现场照片的活动；不足 3 张时用几句话补位
  const slides: CarouselSlide[] = outcomes
    .filter((o) => o.cover?.url)
    .slice(0, 5)
    .map((o) => ({
      key: o.slug,
      href: `/activities/${o.slug}`,
      image: o.cover!.url!,
      title: `${projectName(o.category)} · ${o.circle?.name ?? '互助团'}`,
      sub: o.title,
    }))
  for (const banner of site.home.banners) {
    if (slides.length >= 3) break
    slides.push({ key: banner.title, title: banner.title, sub: banner.sub })
  }

  const statItems = [
    { value: stats.circles || '—', label: '互助团' },
    { value: stats.outcomes || '—', label: '场活动' },
    { value: stats.alumnae || '—', label: '人次参与' },
  ]

  // 覆盖范围：省级行政区（省 / 自治区 / 直辖市）+ 县级行政区（区 / 县 / 县级市 / 旗）
  const coveredProvinces = new Set(
    circles.map((c) => (c.regionShort ?? c.city ?? '').split('·')[0].trim()).filter(Boolean),
  ).size
  const coveredDistricts = new Set(circles.map((c) => c.placeFull).filter(Boolean)).size

  // 省份分布：按互助团所在省份汇总（公开数据），用于地图填色与悬停
  const placeOf = (c: (typeof circles)[number]) => {
    const province = (c.regionShort ?? c.city ?? '').split('·')[0].trim()
    return { province, place: c.placeFull || c.city || '—' }
  }
  const provinceCounts = new Map<string, number>()
  for (const c of circles) {
    const { province } = placeOf(c)
    if (!province) continue
    provinceCounts.set(province, (provinceCounts.get(province) ?? 0) + 1)
  }
  const provinceRows = Array.from(provinceCounts.entries()).sort((a, b) => b[1] - a[1])

  // 填色数据：把简称（浙江）对回 GeoJSON 的完整省名（浙江省）
  const geo = getChinaGeo()
  const shortToFull = new Map<string, string>(
    geo.regions.features.map((f: any) => [
      shortProvinceName(String(f.properties?.name ?? '')),
      String(f.properties?.name ?? ''),
    ]),
  )
  const choroplethData = provinceRows.flatMap(([short, count]) => {
    const full = shortToFull.get(short)
    if (!full) return []
    const places = circles
      .filter((c) => placeOf(c).province === short)
      .map((c) => ({ place: placeOf(c).place, name: c.name }))
      .sort(
        (a, b) => a.place.localeCompare(b.place, 'zh-Hans-CN') || a.name.localeCompare(b.name, 'zh-Hans-CN'),
      )
    return [{ name: full, count, circles: places }]
  })
  const spotlight = circles
    .slice()
    .sort((a, b) => (b.outcomeCount ?? 0) - (a.outcomeCount ?? 0))
    .slice(0, 3)
  const projects = site.projects.items.map((p) => ({
    value: p.value,
    label: p.name,
  }))
  const moreQuery = new URLSearchParams(
    Object.entries(quick).filter(([, v]) => v) as [string, string][],
  ).toString()

  return (
    <div>
      {/* ---------------------------------------------------------- Banner + 数字 */}
      <Wrap className="pt-5 sm:pt-6">
        <HomeCarousel slides={slides} />
      </Wrap>

      {/* 第二屏：左地图（透明底）、右三组数字；窄屏上下堆叠 */}
      <Wrap className="mt-6 sm:mt-8">
        <section
          aria-label="互助团分布"
          className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16"
        >
          <div>
            {/* 地图画在 canvas 上，读屏软件读不到：图本身对读屏隐藏，
                下面给一份同样内容的文字清单（WCAG 1.1.1） */}
            <div aria-hidden className="h-[320px] sm:h-[420px] lg:h-[calc(100dvh-9rem)]">
              <ProvinceChoropleth geo={geo.regions} boundaryLines={geo.boundaryLines} data={choroplethData} />
            </div>
            <ul className="sr-only" aria-label="各省互助团数量">
              {provinceRows.map(([province, count]) => (
                <li key={province}>
                  {province}：{count} 个互助团
                </li>
              ))}
            </ul>
            <p className="px-1 pt-3 text-[0.9375rem] text-ink">互助团全国分布图</p>
            <p className="px-1 pt-1 text-[0.9375rem] text-ink-muted">
              地图数据：天地图 · 审图号 {geo.approvalNumber}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-10 text-center lg:items-stretch lg:justify-self-center lg:gap-14 lg:text-left">
            {statItems.map((s) => (
              <div
                key={s.label}
                className="flex w-full flex-col items-center lg:flex-row lg:items-baseline lg:gap-6"
              >
                <p className="bg-mulan bg-clip-text font-display text-[clamp(3.75rem,6.6vw,7.5rem)] leading-[0.85] font-light tabular-nums text-transparent">
                  <CountUpNumber value={s.value} />
                </p>
                <p className="mt-3 text-[1.0625rem] tracking-[0.14em] text-ink-muted lg:mt-0 lg:text-[1.25rem]">
                  {s.label}
                </p>
              </div>
            ))}
            <p className="text-[0.9375rem] tracking-[0.04em] text-ink-muted">
              已覆盖 {coveredProvinces} 个省级行政区 · {coveredDistricts} 个县级行政区
            </p>
          </div>
        </section>
      </Wrap>

      {/* ---------------------------------------------------------- 最新活动 */}
      <Wrap className="mt-16 sm:mt-20">
        <section id="latest" className="scroll-mt-24">
          <SectionHead title="最新" mark="活动" link={{ href: '/activities', label: '查看全部活动' }} />
          <div className="mb-8">
            <ActivityFilters mode="quick" value={quick} projects={projects} anchor="latest" />
          </div>
          {list.length ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {list.slice(0, HOME_LIMIT).map((o, i) => (
                <ActivityCard key={o.slug} outcome={o} index={i} feature />
              ))}
            </div>
          ) : (
            <EmptyState resetHref="/#latest" />
          )}
          {list.length > HOME_LIMIT ? (
            <div className="mt-12 text-center">
              <Link
                href={`/activities${moreQuery ? `?${moreQuery}` : ''}`}
                className={museButton('outline', 'lg')}
              >
                查看全部 {list.length} 场活动
              </Link>
            </div>
          ) : null}
        </section>
      </Wrap>

      {/* ---------------------------------------------------------- 互助团风采 */}
      {spotlight.length ? (
        <Wrap className="mt-16 sm:mt-20">
          <section className="glow-panel rounded-[2rem] border border-white px-5 py-12 shadow-paper sm:px-10 sm:py-16 lg:px-14">
            <SectionHead title="互助团" mark="风采" link={{ href: '/circles', label: '全部团队' }} />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {spotlight.map((c) => (
                <TeamCard key={c.slug} circle={c} />
              ))}
            </div>
          </section>
        </Wrap>
      ) : null}
    </div>
  )
}
