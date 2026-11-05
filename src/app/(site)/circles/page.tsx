import { TeamGrid } from '@/components/site/TeamGrid'
import { PageIntro } from '@/components/site/muse'
import { site } from '@/content/site'
import { getCircles } from '@/lib/public-data'

export const metadata = { title: '互助团风采' }
// 每次请求取最新数据：否则构建时就把团列表定死了，新建的团、新发布的活动在线上永远不出现
export const dynamic = 'force-dynamic'

/** 互助团风采（复刻 muse TeamList）。浏览型列表页：版心比其它页更宽，一行能放 4 张卡 */
export default async function CirclesPage() {
  const circles = await getCircles(300)
  const sorted = circles.slice().sort((a, b) => (b.outcomeCount ?? 0) - (a.outcomeCount ?? 0))
  return (
    <div className="mx-auto w-full max-w-[1680px] px-5 pt-10 pb-8 sm:px-8 sm:pt-14 xl:px-12">
      <PageIntro title="互助团风采" mark="风采" />
      <TeamGrid circles={sorted} projects={site.projects.items.map((p) => ({ value: p.value, label: p.name }))} />
    </div>
  )
}
