import Link from 'next/link'

import { isProjectTeam, requireUser } from '@/lib/auth'
import { findForUser, findMyCircle } from '@/lib/console-data'
import { COHORT_CATEGORIES, COHORT_CATEGORY_LABEL } from '@/lib/labels'
import type { CirclePoint } from '@/lib/circle'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/console/PageHeader'
import { PageHelp } from '@/components/console/PageHelp'
import { CategoryFilter } from '@/components/console/CategoryFilter'
import { CircleNetwork } from '@/components/console/CircleNetwork'

export const metadata = { title: '互助团' }

/** 按中文拼音排序（"北京"在"成都"前，"深圳"在"西安"前） */
const collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base', numeric: true })

export default async function CirclePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>
}) {
  const user = await requireUser()
  const projectTeam = isProjectTeam(user)

  // 互助团是公开信息：所有人看得到全部在运转的团（成员管理仍限项目组）。
  // 全国盘会到几百个团，limit 给足（默认 200 不够）。
  const circles = await findForUser<any>(
    user,
    'cohorts',
    {},
    { limit: 1000 },
  )

  const params = await searchParams
  // URL 里的项目用逗号连着（?project=go-mulan,a-idol），也兼容重复参数写法
  const raw = (Array.isArray(params.project) ? params.project : params.project ? [params.project] : [])
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean)
  const validValues = COHORT_CATEGORIES.map((c) => c.value) as string[]
  const selected = validValues.filter((value) => raw.includes(value))

  // 团长自己那个团：「我的互助团」直接进**和别的团一样的详情页**
  const myCircle = projectTeam ? null : await findMyCircle(user)
  /**
   * 这一页是**分布图**：看的是"现在有哪些团在跑"。
   *
   * 已解散的团**不算进来**（数量、地图、列表都不算）——
   * 与公众站同一口径（现状数字只算运行中的团）。
   * 想找已解散的团，去「全部互助团」名录页，那里列出全部并标注「解散」。
   */
  const running = circles.filter((c: any) => (c.status ?? 'active') === 'active')

  const points: CirclePoint[] = running
    .map((c: any) => ({
      id: c.id,
      slug: String(c.slug ?? ''),
      name: String(c.name ?? ''),
      category: String(c.category ?? 'go-mulan'),
      categoryLabel: COHORT_CATEGORY_LABEL[c.category] ?? String(c.category ?? ''),
      status: String(c.status ?? 'active'),
      province: String(c.location?.province ?? ''),
      provinceCode: String(c.location?.provinceCode ?? ''),
      city: String(c.location?.city ?? ''),
      cityCode: String(c.location?.cityCode ?? ''),
      district: String(c.location?.district ?? ''),
      districtCode: String(c.location?.districtCode ?? ''),
      leaderName: (c.leader as any)?.name ?? '',
      theme: String(c.theme ?? ''),
    }))
    .sort((a, b) => collator.compare(a.name, b.name))

  /** 每个类别的互助团总数 */
  const categoryCount = Object.fromEntries(
    COHORT_CATEGORIES.map((c) => [c.value, points.filter((p) => p.category === c.value).length]),
  )

  const filtered = selected.length ? points.filter((p) => selected.includes(p.category)) : points

  return (
    // ⚠️ 高度锁定必须是 `xl` 不是 `lg`：
    // 两栏（地图 + 可滚动侧栏）要到 1280px 才成立，
    // 在 1024–1280px 之间如果先锁了高度，页面不能滚、右侧列表又不自己滚，
    // 列表下半截会被 `overflow-hidden` 裁掉——点不到也滚不到。
    // 所以 1280px 以下一律让页面正常滚（和窄屏一个道理）。
    <div className="flex flex-col xl:h-[calc(100dvh-var(--workspace-header-h)-4rem)] xl:overflow-hidden">
      {/* 页头：标题 + 邀请创建互助团 */}
      <PageHeader
        title={`互助团（${filtered.length}）`}
        help={
          <PageHelp title="互助团网络">
            <p>左边是地图，右边是这个互助团的清单——两边是同一份数据，点哪边另一边都跟着动。</p>
            <p>点地图上的省 / 市 / 区县可以逐级下钻，点右边的团名会定位到它所在的区县。</p>
            <p>
              这一页只统计<strong className="font-medium text-fg">还在运行的团</strong>；
              已解散的团不再计入数量与地图，历史成果仍然算数。
            </p>
            <p>要数个数、要找某个团（含已解散的），去「全部互助团」名录页；要看某一个团的详情，点团名。</p>
          </PageHelp>
        }
        actions={
          <>
            {myCircle?.slug ? (
              <Button variant="outline" render={<Link href={`/circles/${myCircle.slug}`} />}>我的互助团</Button>
            ) : null}
            {projectTeam ? (
              <Button render={<Link href="/circles/new" />}>邀请创建互助团</Button>
            ) : null}
          </>
        }
      />

      {/* 类别筛选（每个类别后面是该类别的互助团总数） */}
      <CategoryFilter
        counts={categoryCount}
        selected={selected}
        basePath="/circles"
        className="mt-8 shrink-0"
      />

      {/* 右侧列表一次列出全部互助团，底部给「全部互助团」页的入口 */}
      <div className="mt-6 min-h-0 flex-1">
        <CircleNetwork
          points={filtered}
          canManage={projectTeam}
          pageSize={2000}
          allHref="/circles/all"
        />
      </div>
    </div>
  )
}
