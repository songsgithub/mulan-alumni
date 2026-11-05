
import { StatCard } from '@/components/console/kit'
import { BudgetFilters, BudgetYearSelect } from '@/components/console/BudgetFilters'
import { BudgetTable } from '@/components/console/BudgetTable'
import { CohortBudgetDialog, DefaultBudgetDialog } from '@/components/console/BudgetDialogs'
import { EmptyState } from '@/components/console/EmptyState'
import { FundPanel } from '@/components/console/FundPanel'
import { PageHeader } from '@/components/console/PageHeader'
import { Pager } from '@/components/console/Pager'
import { PageHelp } from '@/components/console/PageHelp'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { computeAnnualBudget } from '@/lib/annual-budget'
import { computeFundPanel } from '@/lib/fund-panel'
import { loadFundScope } from '@/lib/fund-scope'
import {
  budgetHref,
  filterBudgetRows,
  hasBudgetFilter,
  readBudgetFilters,
  sortBudgetRows,
} from '@/lib/budget-filter'
import { findOwnCohorts } from '@/lib/console-data'
import { yuan, formatRate } from '@/lib/format'
import { isProjectTeam, requireUser } from '@/lib/auth'

export const metadata = { title: '经费' }
export const dynamic = 'force-dynamic'

/**
 * 经费页：**年度规划预算 vs 实际执行**。
 *
 * ## 为什么单独开一页
 *
 * 年度预算是**跨活动**的汇总：一场活动的预算在活动详情页里看，
 * 但"这个团今年还剩多少钱""哪个团超支了"这种问题，
 * 只有把所有团放在一起才看得出来——所以单开一页，不塞进活动列表。
 *
 * ## 两个预算不是一回事
 *
 * - **活动预算**：这一场打算花多少（活动方案里填，受单场经费上限约束）；
 * - **年度预算**：这个团一整年能用多少（这一页）。
 *
 * ## 实际执行怎么算
 *
 * = 已核定的报销之和（`approvedAmount`）。**没闭环的不计入**
 * （草稿 / 待审核 / 被驳回一律不算），核减过的按核减后算。
 *
 * ## 谁能看到
 *
 * - 项目组：全部互助团 + 统一设置 + 单独设置；
 * - 团长：只看自己那个团（只读）。
 */
export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const user = await requireUser()
  const projectTeam = isProjectTeam(user)

  // 筛选条件全部写进地址（年度 / 类别 / 状态 / 关键字）
  const filters = readBudgetFilters(sp)

  // 团长只看自己那个团
  const ownCohorts = await findOwnCohorts(user)
  const ownIds = projectTeam ? undefined : ownCohorts.map((c) => c.id)
  const summary = await computeAnnualBudget(filters.year, ownIds)

  // 按筛选条件过滤，再按指定列排序（两者都在地址里）
  const rows = sortBudgetRows(filterBudgetRows(summary.rows, filters), filters.sort, filters.dir)
  // 与通知、资源同一口径：表格每页 20 条，页码写进地址（汇总数字仍按全部筛选结果算）
  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const rawPage = Number.parseInt(String(Array.isArray(sp.page) ? sp.page[0] : (sp.page ?? '1')), 10) || 1
  const currentPage = Math.min(totalPages, Math.max(1, rawPage))
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageHref = (n: number) => {
    const base = budgetHref(filters)
    if (n <= 1) return base
    return `${base}${base.includes('?') ? '&' : '?'}page=${n}`
  }
  const totals = {
    planned: rows.reduce((sum, r) => sum + r.planned, 0),
    spent: rows.reduce((sum, r) => sum + r.spent, 0),
    balance: 0,
    overCount: rows.filter((r) => r.planned > 0 && r.spent > r.planned).length,
    overrideCount: rows.filter((r) => r.hasOverride).length,
  }
  totals.balance = totals.planned - totals.spent
  const ratio = totals.planned > 0 ? totals.spent / totals.planned : null

  // 「活动资金」视图：活动层面的预算 vs 已核定的报销（从首页搬过来的那套）
  const fundScope = await loadFundScope({
    year: filters.year,
    category: filters.category,
    q: filters.q,
    cohortIds: ownIds,
  })
  const fundData = computeFundPanel(fundScope)

  return (
    <div>
      <PageHeader
        title="经费"
        help={
          <PageHelp title="经费">
            <p>这一页有两个口径，别混：</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <span className="font-medium text-fg">年度预算</span>
                ：项目组给这个团一整年的额度，能统一设，也能单独改某几个团。
              </li>
              <li>
                <span className="font-medium text-fg">活动资金</span>
                ：每场活动自己申请的预算，与已核定的报销对比。
              </li>
            </ul>
            <p>实际执行只按已核定的报销算：草稿、待审核、被驳回的申请都不计入。</p>
            <p>团长：年度预算由项目组设定，可以在活动方案里按它安排这一年的花销。</p>
            <p>年度与筛选条件都写进地址，刷新和分享都还是这一份账。</p>
          </PageHelp>
        }
      />

      <Card className="mt-8 gap-0 p-4 sm:p-6">
        {/* 两个视图：团级年度额度 / 活动级花销 */}
        <Tabs defaultValue="annual" className="gap-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
            <TabsList>
              <TabsTrigger value="annual">{projectTeam ? '各团年度预算' : '年度预算'}</TabsTrigger>
              <TabsTrigger value="fund">活动资金</TabsTrigger>
            </TabsList>
            {projectTeam ? (
              <DefaultBudgetDialog
                year={filters.year}
                defaultAmount={summary.defaultAmount}
                note={null}
              />
            ) : null}
          </div>

          {/* ---------------------------------------- 各团年度预算（团级额度） */}
          <TabsContent value="annual" className="space-y-6 pt-5">
            {projectTeam ? <BudgetFilters value={filters} /> : null}

            {projectTeam ? (
              <>
                {/* 汇总：四个数字，一眼看完 */}
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="规划预算合计" value={yuan(totals.planned)} hint={`${rows.length} 个互助团`} />
                  <StatCard label="实际执行合计" value={yuan(totals.spent)} hint="按已核定的报销" />
                  <StatCard
                    label="剩余预算"
                    value={yuan(totals.balance)}
                    hint={totals.balance < 0 ? '已经超支' : '还能用'}
                    tone={totals.balance < 0 ? 'danger' : 'default'}
                  />
                  <StatCard
                    label="执行率"
                    value={formatRate(ratio)}
                    hint={
                      totals.overCount > 0
                        ? `${totals.overCount} 个团超支`
                        : totals.overrideCount > 0
                          ? `${totals.overrideCount} 个团单独设过额度`
                          : '都跟着统一额度'
                    }
                    tone={
                      totals.overCount > 0
                        ? 'danger'
                        : ratio !== null && ratio > 0.8
                          ? 'warning'
                          : 'default'
                    }
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                    <h2 className="section-title">
                      各团年度预算（{filters.year}）
                    </h2>
                    <span className="text-small text-muted">
                      {hasBudgetFilter(filters)
                        ? `筛出 ${rows.length} / ${summary.rows.length} 个团`
                        : `共 ${summary.rows.length} 个团`}
                    </span>
                  </div>

                  {rows.length ? (
                    <>
                    <BudgetTable
                      rows={pageRows}
                      year={filters.year}
                      defaultAmount={summary.defaultAmount}
                      value={filters}
                    />
                    <Pager
                      page={currentPage}
                      totalPages={totalPages}
                      total={rows.length}
                      pageSize={PAGE_SIZE}
                      hrefFor={pageHref}
                    />
                    </>
                  ) : (
                    <EmptyState
                      compact
                      title={summary.rows.length ? '没有符合筛选条件的互助团' : '还没有互助团'}
                      hint={
                        summary.rows.length
                          ? '换个项目、状态或关键字再看看。'
                          : '建好第一个互助团后，这里就会列出各团的年度预算。'
                      }
                    />
                  )}
                </div>
              </>
            ) : (
              /* 团长：只看自己那个团 */
              <div>
                {summary.rows.length ? (
                  summary.rows.map((row) => {
                    const over = row.planned > 0 && row.spent > row.planned
                    return (
                      <div key={String(row.cohortId)} className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h2 className="section-title">
                            {row.cohortName} · {filters.year} 年
                          </h2>
                          <div className="flex flex-wrap items-center gap-3">
                            {over ? <Badge variant="danger">已超支</Badge> : null}
                            {/* 团长只有一个团，不必给类别与状态筛选，年度下拉就够 */}
                            <BudgetYearSelect value={filters} />
                          </div>
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
                          <StatCard
                            label="年度规划预算"
                            value={row.planned > 0 ? yuan(row.planned) : '未设'}
                            hint="由项目组设定"
                          />
                          <StatCard label="实际执行" value={yuan(row.spent)} hint="按已核定的报销" />
                          <StatCard
                            label="剩余"
                            value={row.planned > 0 ? yuan(row.balance) : '—'}
                            hint={
                              row.ratio === null
                                ? undefined
                                : `已用 ${formatRate(row.ratio)}`
                            }
                            tone={over ? 'danger' : 'default'}
                          />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <EmptyState
                    compact
                    title="你还没有带团"
                    hint="你担任团长的互助团出现在这里后，就能看到这一年的预算与执行情况。"
                  />
                )}
              </div>
            )}
          </TabsContent>

          {/* ---------------------------------------- 活动资金（活动级花销） */}
          <TabsContent value="fund" className="pt-5">
            <BudgetFilters value={filters} showCategory={projectTeam} />
            <div className="pt-6">
              <FundPanel data={fundData} />
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}

