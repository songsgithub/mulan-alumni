import { CategoryFilter } from '@/components/console/CategoryFilter'
import { CohortDirectory } from '@/components/console/CohortDirectory'
import { requireUser } from '@/lib/auth'
import { findForUser } from '@/lib/console-data'
import { COHORT_CATEGORIES, COHORT_CATEGORY_LABEL } from '@/lib/labels'
import { PageBackLink } from '@/components/console/PageBackLink'
import { PageHeader } from '@/components/console/PageHeader'
import { PageHelp } from '@/components/console/PageHelp'
import { Card } from '@/components/ui/card'

export const metadata = { title: '全部互助团' }

const collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base', numeric: true })

/**
 * 全部互助团：一张完整清单（不分段）。
 *
 * 地图页看的是"分布"，这里是"名录"——要数个数、要找某个团，来这里。
 */
export default async function AllCirclesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>
}) {
  const user = await requireUser()

  const circles = await findForUser<any>(user, 'cohorts', {}, { limit: 1000 })

  const params = await searchParams
  const raw = (Array.isArray(params.project) ? params.project : params.project ? [params.project] : [])
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean)
  const valid = COHORT_CATEGORIES.map((c) => c.value) as string[]
  const selected = valid.filter((value) => raw.includes(value))

  const points = circles
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
      memberCount: 0,
      theme: String(c.theme ?? ''),
    }))
    .sort((a, b) => collator.compare(a.name, b.name))

  const counts = Object.fromEntries(
    COHORT_CATEGORIES.map((c) => [c.value, points.filter((p) => p.category === c.value).length]),
  )
  const filtered = selected.length ? points.filter((p) => selected.includes(p.category)) : points

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-var(--workspace-header-h)-4rem)] lg:overflow-hidden">
      <PageHeader
        title={`全部互助团（${points.length}）`}
        help={
          <PageHelp title="全部互助团">
            <p>地图页看的是分布，这里是名录——要数个数、要找某个团，来这里。</p>
            <p>按团名、城市、区县、项目、团长都能搜；项目筛选写在地址里，链接可以直接分享。</p>
          </PageHelp>
        }
      />

      {/* 返回：与互助团详情页同一款（PageBackLink，页面左边） */}
      <div className="mt-5 shrink-0">
        <PageBackLink href="/circles">返回互助团</PageBackLink>
      </div>

      <CategoryFilter
        counts={counts}
        selected={selected}
        basePath="/circles/all"
        className="mt-4 shrink-0"
      />

      <Card className="mt-6 min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <CohortDirectory items={filtered} />
      </Card>
    </div>
  )
}
