import Link from 'next/link'
import { CARD_HOVER, ListToolbar, StatCard } from '@/components/console/kit'
import { EmptyState } from '@/components/console/EmptyState'
import { Bell, Check, ChevronDown, Download } from 'lucide-react'
import type { Where } from 'payload'

import { CreateActivityButton } from '@/components/console/CreateActivityButton'
import { PhotoGallery } from '@/components/console/PhotoGallery'
import { PageHeader } from '@/components/console/PageHeader'
import { PageHelp } from '@/components/console/PageHelp'
import { StatsFilters, type StatsFilterValue } from '@/components/console/StatsFilters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LinkTabs } from '@/components/console/LinkTabs'
import { Pager } from '@/components/console/Pager'
import { UrlSearchField } from '@/components/console/UrlSearchField'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { activityDateKey, activityPhotos, formatDateKey } from '@/lib/activity-photos'
import { isCohortLead, isProjectTeam, requireUser } from '@/lib/auth'
import { findForUser, ownCohortWhere, yuan } from '@/lib/console-data'
import { loadHomeScope, readHomeFilters } from '@/lib/home-scope'
import { COHORT_CATEGORY_LABEL } from '@/lib/labels'
import { cn } from '@/lib/utils'

export const metadata = { title: '活动' }

const PAGE_SIZE = 10
const IMAGE_PAGE_SIZE = 5
type Tab = 'activities' | 'images'

/** 报销只有「通过」与「不通过」：金额只算通过的 */
const isApproved = (reimbursement: any) =>
  Boolean(reimbursement) && ['approved', 'paid'].includes(reimbursement.status)

/**
 * 活动（工作台首屏）：待办 · 数字 · 筛选 · 活动清单（「活动」「图片」两个视图）。
 *
 * ⚠️ **资金相关的内容都搬到「经费」页了**（2026-10-30）：
 * 首页只管"活动与待办"，年度额度、实际执行、费用类别这些到经费页看——
 * 左侧「活动数据」卡里留了一个入口。
 *
 * 资金口径（与 SOP 一致：反馈被采纳后报销按结果通过或不通过）：
 * - 预算：活动方案的预算合计；
 * - 实际报销：报销通过的金额（即实际支出）；
 * - 执行率：已完成报销的活动，实际报销 ÷ 这些活动的预算。未完成报销的活动不参与计算，
 *   否则刚申请的活动会把比例拉得很低。
 *
 * 活动 / 图片 / 资金共用同一份数据范围（`lib/home-scope.ts`），图片下载接口也用它。
 */
export default async function ConsoleDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const projectTeam = isProjectTeam(user)
  const lead = isCohortLead(user)
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))

  const thisYear = new Date().getFullYear()
  const filters = readHomeFilters(sp, thisYear)
  const { year, monthFrom, monthTo, categories, provinceCode, cityCode, districtCode } = filters
  const cohortParam = filters.cohort
  const requestedPage = Math.max(1, Number.parseInt(one(sp.page), 10) || 1)
  const requestedImagePage = Math.max(1, Number.parseInt(one(sp.ipage), 10) || 1)
  const tabParam = one(sp.tab)
  const initialTab: Tab = tabParam === 'images' ? 'images' : 'activities'
  // 「只看待办」：地址里带 todo=1 就是（2026-11-02 第四十一轮）
  const onlyTodo = one(sp.todo) === '1'

  const filterValue: StatsFilterValue = {
    year,
    monthFrom,
    monthTo,
    categories,
    region: {
      province: '',
      provinceCode,
      city: '',
      cityCode,
      district: '',
      districtCode,
    },
    cohort: cohortParam,
    todo: onlyTodo,
  }

  const { allCohorts, cohorts, plans, reports, reportByPlan, reimburseByPlan } = await loadHomeScope(
    user,
    filters,
  )

  /* ------------------------------------------------------------- 待办
   * 待办是「我现在要动手的事」，**不跟着筛选走**：筛选到 2025 年也应该看到
   * 今年的待办数量，否则会以为没事可做。
   *
   * ⚠️ 这一段算在**关键词筛选之前**：下面的「只看待办」筛选要用它。 */
  const ownWhere = await ownCohortWhere(user)
  const todoConds: Where[] = []
  if (Object.keys(ownWhere).length) todoConds.push(ownWhere)
  if (projectTeam) todoConds.push({ status: { not_equals: 'draft' } })
  const todoPlans = await findForUser<any>(
    user,
    'activity-plans',
    todoConds.length ? { and: todoConds } : {},
    { limit: 1000, depth: 0 },
  )
  const todoPlanIds = todoPlans.map((p: any) => p.id)
  const todoReports = todoPlanIds.length
    ? await findForUser<any>(
        user,
        'activity-reports',
        { plan: { in: todoPlanIds } },
        { limit: 1000, depth: 0 },
      )
    : []
  const reportedPlanIds = new Set(
    todoReports.map((r: any) => r.plan?.id ?? r.plan).filter(Boolean) as number[],
  )
  const reimbConds: Where[] = [{ status: { equals: 'submitted' } }]
  if (Object.keys(ownWhere).length) reimbConds.push(ownWhere)
  const pendingReimbursements = await findForUser<any>(
    user,
    'reimbursements',
    { and: reimbConds },
    { limit: 1000, depth: 0 },
  )
  // ⚠️ 2026-11-03 第五十一轮：**没有审核人的报销单不进待办**。
  //    报销审核负责人被置空时生成的单子，谁都审不了（也不该占着别人的待办）。
  //    判据是报销单自己记的快照（`reviewerId`），不是当前设置——
  //    之后才设负责人，也不会把以前没人的单子翻出来。
  const reviewableReimbursements = pendingReimbursements.filter(
    (r: any) => r.reviewerId?.id ?? r.reviewerId,
  )

  const pendingPlans = todoPlans.filter((p: any) => p.status === 'submitted')
  const toFillReports = todoPlans.filter((p: any) => p.status === 'approved' && !reportedPlanIds.has(p.id))
  const toSubmitPlans = todoPlans.filter((p: any) => p.status === 'draft')

  /* ----------------------------------------------------- 待办落到具体活动上
   * 待办不再单独占一张卡：谁有事做，就在那一场活动旁边标出来。
   * 项目组看「待审核 / 报销待核」，团长看「待提交 / 待填反馈」。 */
  const todoByPlan = new Map<number, string[]>()
  const markTodo = (planId: unknown, label: string) => {
    const id = Number(planId)
    if (!id) return
    const list = todoByPlan.get(id) ?? []
    if (!list.includes(label)) list.push(label)
    todoByPlan.set(id, list)
  }
  if (projectTeam) {
    for (const p of pendingPlans) markTodo(p.id, '待审核')
    for (const r of reviewableReimbursements) markTodo(r.plan?.id ?? r.plan, '报销待核')
  } else {
    for (const p of toSubmitPlans) markTodo(p.id, '待提交')
    for (const p of toFillReports) markTodo(p.id, '待填反馈')
  }
  const todoTotal = [...todoByPlan.values()].reduce((sum, list) => sum + list.length, 0)

  /* ------------------------------------------- 关键词（全局筛选：活动与图片共用） */
  const keyword = one(sp.q).trim().slice(0, 50)
  const keywordLower = keyword.toLowerCase()
  const matchesKeyword = (plan: any) => {
    if (!keywordLower) return true
    const report = reportByPlan.get(plan.id)
    return [
      plan.title,
      plan.theme,
      plan.location,
      plan.cohort?.name,
      plan.cohort?.location?.district,
      report?.summary,
      report?.location,
    ]
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(keywordLower))
  }
  // 关键词现在是**全局筛选**：活动列表与图片列表都按它筛
  const keywordPlans = plans.filter(matchesKeyword)

  /* ------------------------------------------------- 「只看待办」筛选
   * 2026-11-02 第四十一轮：待审核的事原先夹在按日期排的清单中间，
   * 要一屏一屏翻才找得到。加一个筛选比"把待审核的顶到最上面"好：
   * - 顶到最上面会打乱日期（这列表本来就是按活动日期排的）；
   * - 筛选是**点一下就有、看完就关**，不改变默认那一份按日期排的清单。
   *
   * ⚠️ 待办本身**不跟着筛选走**（筛选到 2025 年也该看到今年的待办），
   * 所以这里是「在当前筛选结果里，再只看有待办的那些」——
   * 两层筛选叠加，取交集，跟别的筛选一个口径。
   */
  const listedPlans = onlyTodo
    ? keywordPlans.filter((p: any) => todoByPlan.has(p.id))
    : keywordPlans
  const imagePlans = listedPlans.filter(
    (p: any) => activityPhotos(reportByPlan.get(p.id)).length > 0,
  )

  /* ------------------------------------------- 活动列表（分页） */
  const totalPages = Math.max(1, Math.ceil(listedPlans.length / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const pagePlans = listedPlans.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const totalPhotos = imagePlans.reduce(
    (acc: number, p: any) => acc + activityPhotos(reportByPlan.get(p.id)).length,
    0,
  )
  const imageTotalPages = Math.max(1, Math.ceil(imagePlans.length / IMAGE_PAGE_SIZE))
  const currentImagePage = Math.min(requestedImagePage, imageTotalPages)
  const pageImagePlans = imagePlans.slice(
    (currentImagePage - 1) * IMAGE_PAGE_SIZE,
    currentImagePage * IMAGE_PAGE_SIZE,
  )
  const imageRows = pageImagePlans.map((plan: any) => {
    const report = reportByPlan.get(plan.id)
    return {
      key: String(plan.id),
      slug: plan.slug as string,
      title: plan.title || plan.theme || '未命名活动',
      cohort: plan.cohort?.name ?? '未归属互助团',
      date: formatDateKey(activityDateKey(report?.actualAt || plan.plannedAt)),
      summary: (report?.summary as string | undefined) ?? '',
      photos: activityPhotos(report),
    }
  })

  /* ----------------------------------------------------------- 统计口径 */
  const peopleTotal = listedPlans.reduce(
    (acc: number, p: any) => acc + (Number(reportByPlan.get(p.id)?.actualParticipants) || 0),
    0,
  )

  /* ------------------------------------------------------------- 筛选器选项 */
  const years = [
    { value: 'all', label: '全部年份' },
    ...Array.from(new Set(allCohorts.map((c: any) => c.createdAt?.slice(0, 4)).filter(Boolean)))
      .concat([String(thisYear)])
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => b.localeCompare(a))
      .map((v) => ({ value: v, label: `${v} 年` })),
  ]
  const cohortOptions = allCohorts
    .slice()
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), 'zh'))
    .map((c: any) => ({
      value: String(c.id),
      label: c.name,
      provinceCode: c.location?.provinceCode ?? '',
      cityCode: c.location?.cityCode ?? '',
      districtCode: c.location?.districtCode ?? '',
    }))

  const regionSearchOptions = Array.from(
    new Map(
      allCohorts
        .filter((c: any) => c.location?.districtCode)
        .map((c: any) => {
          const loc = c.location
          const label = [loc.province, loc.city !== loc.province ? loc.city : '', loc.district]
            .filter(Boolean)
            .join(' / ')
          return [
            loc.districtCode,
            {
              label,
              province: loc.province ?? '',
              provinceCode: loc.provinceCode ?? '',
              city: loc.city ?? '',
              cityCode: loc.cityCode ?? '',
              district: loc.district ?? '',
              districtCode: loc.districtCode ?? '',
            },
          ]
        }),
    ).values(),
  ).sort((a: any, b: any) => String(a.label).localeCompare(String(b.label), 'zh'))

  const filterOptions = {
    years,
    categories: ['go-mulan', 'a-idol', 'homestay-manager'].map((value) => ({
      value,
      label: COHORT_CATEGORY_LABEL[value] ?? value,
    })),
    months: Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      label: `${i + 1} 月`,
    })),
    cohorts: cohortOptions,
    regions: regionSearchOptions,
  }

  /* ------------------------------------------------------ 链接 */
  // 当前筛选条件（不含标签与分页）。年份总是写出来：「全部年份」要保留成 all，
  // 否则会被默认成今年。
  const filterQuery = () => {
    const query = new URLSearchParams()
    query.set('year', year)
    if (monthFrom) query.set('monthFrom', monthFrom)
    if (monthTo) query.set('monthTo', monthTo)
    if (categories.length) query.set('project', categories.join(','))
    if (provinceCode) query.set('province', provinceCode)
    if (cityCode) query.set('city', cityCode)
    if (districtCode) query.set('district', districtCode)
    if (cohortParam) query.set('circle', cohortParam)
    if (onlyTodo) query.set('todo', '1')
    return query
  }
  // qOverride：换关键词时传进来的新值（不传 = 用地址里的 q，传 null = 清空）
  const hrefFor = (
    tab: Tab,
    pages: { page?: number; ipage?: number } = {},
    qOverride?: string | null,
  ) => {
    const query = filterQuery()
    query.set('tab', tab)
    if (pages.page && pages.page > 1) query.set('page', String(pages.page))
    if (pages.ipage && pages.ipage > 1) query.set('ipage', String(pages.ipage))
    // 关键词现在是**全局**筛选：两个视图都带着它
    const q = (qOverride === undefined ? keyword : (qOverride ?? '')).trim()
    if (q) query.set('q', q)
    return `/?${query.toString()}`
  }
  const downloadAllHref = `/api/activity-photos?${filterQuery().toString()}`

  const emptyText =
    year !== 'all' || categories.length || provinceCode || cohortParam || keyword || onlyTodo
      ? onlyTodo
        ? '当前筛选条件内没有待办。'
        : '当前筛选条件内没有活动。'
      : projectTeam
        ? '还没有活动。'
        : '你所在互助团还没有活动。'

  // 问候按北京时间分时段（与 muse 站一致）：<5 夜深了 / <12 早上好 / <14 中午好 / <18 下午好 / 晚上好
  // ⚠️ 别用 zh-CN + hour:'numeric'：它返回「13时」，Number() 会得到 NaN
  const greetingHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Shanghai',
    }).format(new Date()),
  )
  const greeting =
    greetingHour < 5
      ? '夜深了'
      : greetingHour < 12
        ? '早上好'
        : greetingHour < 14
          ? '中午好'
          : greetingHour < 18
            ? '下午好'
            : '晚上好'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting}，${user.name ?? user.email}，${
          todoTotal > 0 ? `你有 ${todoTotal} 项待办` : '目前没有待办'
        }`}
        mark={String(user.name ?? user.email)}
        help={
          <PageHelp title="活动">
            <p>这一页是"今天要做什么"：标题里是待办数量，下面几个数字是眼下的规模，最下面是活动清单。</p>
            <p>
              <span className="font-medium text-fg">待办</span>
              数量在标题里；具体是哪几件事，看下面活动旁边挂的铃铛
              （项目组是待审核 / 报销待核，团长是待提交 / 待填反馈）。
            </p>
            <p>
              <span className="font-medium text-fg">筛选</span>
              就在活动清单的上方——筛的就是下面这张表。
            </p>
          </PageHelp>
        }
        actions={lead ? <CreateActivityButton /> : undefined}
        className="mb-2"
      />

      {/* 数字在最上面：一眼看完"有多少活动、多少人"。待办在标题里，具体在哪场活动看下面的铃铛。 */}
      <div className={cn('grid gap-4 sm:grid-cols-2', projectTeam && 'sm:grid-cols-3')}>
        <StatCard label="活动场次" value={`${listedPlans.length} 场`} />
        <StatCard label="参与人次" value={`${peopleTotal} 人`} />
        {projectTeam ? (
        <StatCard label="覆盖互助团" value={`${cohorts.length} 个`} />
        ) : null}
      </div>

      {/* 一整张大卡：筛选 + 活动列表（图片是另一个标签） */}
      <Card className="min-w-0 gap-0 overflow-hidden py-0">
          {/* 筛选是**前置条件**：先筛，再在筛出来的结果里切「活动 / 图片」。
              两个视图共用同一套筛选——切到图片时，筛选条件还在上面，不会丢。 */}
          <div className="space-y-4 px-5 py-5">
            <div className="hidden lg:block">
              <StatsFilters
                value={filterValue}
                layout="row"
                plain
                showPlace={projectTeam}
                showCategories={projectTeam}
                options={filterOptions}
              />
            </div>
            <details className="lg:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-control border px-4 text-body font-medium [&::-webkit-details-marker]:hidden">
                展开筛选
                <ChevronDown className="size-4 opacity-50" aria-hidden />
              </summary>
              <div className="mt-4">
                <StatsFilters
                  value={filterValue}
                  layout="row"
                  plain
                  showPlace={projectTeam}
                  showCategories={projectTeam}
                  options={filterOptions}
                />
              </div>
            </details>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* 关键词搜索：与全站同一个搜索框（放大镜在左、清空在右、边打边筛） */}
              <UrlSearchField
                value={keyword}
                baseHref={hrefFor(initialTab, {}, null)}
                placeholder={projectTeam ? '搜活动名称、互助团、地点' : '搜活动名称、地点'}
                ariaLabel="搜索活动"
                className="min-w-0 flex-1 sm:max-w-md"
              />

              {/* 「只看待办」：待审核的事原先夹在按日期排的清单中间，要一屏一屏翻。
                  点一下就只看这些，再点一下取消——不改变默认那份按日期排的清单。
                  开着的时候，表格与图片两个视图都只看待办那些。 */}
              {todoTotal > 0 ? (
                <Link
                  href={onlyTodo ? hrefFor(initialTab) : `${hrefFor(initialTab)}&todo=1`}
                  scroll={false}
                  aria-pressed={onlyTodo}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-small transition-colors',
                    onlyTodo
                      ? 'border-accent/40 bg-console-accent text-fg'
                      : 'border-rule bg-card text-muted hover:bg-console-accent hover:text-fg',
                  )}
                >
                  <Bell aria-hidden className="size-4" />
                  {onlyTodo ? '正在只看待办' : `只看待办（${todoTotal}）`}
                </Link>
              ) : null}
            </div>
          </div>

          {/* 视图切换也走地址（tab=activities / tab=images）：
              切了视图，筛选条件与关键词都跟着走，刷新和分享还是这一屏。 */}
          <ListToolbar className="border-t">
            <LinkTabs
              value={initialTab}
              ariaLabel="视图"
              items={[
                { value: 'activities', label: '活动', href: hrefFor('activities') },
                { value: 'images', label: '图片', href: hrefFor('images') },
              ]}
            />
          </ListToolbar>

          {initialTab === 'activities' ? (
            <div className="space-y-5 px-3 pt-1 pb-5">
              {listedPlans.length ? (
                <>
                  <ActivityTable
                    plans={pagePlans}
                    reportByPlan={reportByPlan}
                    reimburseByPlan={reimburseByPlan}
                    todoByPlan={todoByPlan}
                  />
                  <Pager
                    page={currentPage}
                    totalPages={totalPages}
                    total={listedPlans.length}
                    pageSize={PAGE_SIZE}
                    hrefFor={(p) => hrefFor('activities', { page: p })}
                  />
                </>
              ) : (
                <Empty text={emptyText} />
              )}
            </div>
          ) : (
            <div className="space-y-5 p-5">
              {/* 关键词搜索在上面的筛选区里，这里不再重复一遍 */}
              <div className="flex flex-wrap items-center justify-end gap-3">
                {/* 「下载全部」按筛选范围打包；搜索结果请逐场下载，避免包的内容和看到的不一致 */}
                {imagePlans.length && !keyword ? (
                  <Button render={<a href={downloadAllHref} />} variant="outline">
                    <Download aria-hidden className="size-4" />
                    下载全部图片
                  </Button>
                ) : null}
              </div>
              {imagePlans.length ? (
                <>
                  <p className="text-body text-muted tabular-nums">
                    {keyword ? <>「{keyword}」 · </> : null}
                    {imagePlans.length} 场活动 · {totalPhotos} 张图片
                  </p>
                  <ImageList rows={imageRows} />
                  <Pager
                    page={currentImagePage}
                    totalPages={imageTotalPages}
                    total={imagePlans.length}
                    pageSize={IMAGE_PAGE_SIZE}
                    hrefFor={(p) => hrefFor('images', { ipage: p })}
                  />
                </>
              ) : (
                <Empty text={emptyText} />
              )}
            </div>
          )}
        </Card>
    </div>
  )
}

/* ============================================================ 组件 */

function Empty({ text }: { text: string }) {
  return <EmptyState compact title={text} />
}

/**
 * 待办标记：挂在**具体活动**旁边（不再是首页单独一张"待办"卡）。
 *
 * 事项不同角色不一样：项目组是「待审核 / 报销待核」，团长是「待提交 / 待填反馈」。
 * 用铃铛图标 + 事项名，鼠标悬停能看清具体要做什么。
 */
function TodoBadge({ labels }: { labels?: string[] }) {
  if (!labels?.length) return null
  const text = labels.join(' · ')
  return (
    <Badge variant="warning" title={`待办：${text}`} className="py-0.5">
      <Bell aria-hidden className="size-3.5" />
      {text}
    </Badge>
  )
}


/** 活动的展示信息：一次算好，表格与卡片共用 */
function activityFacts(plan: any, report: any, reimbursement: any) {
  const settled = isApproved(reimbursement)
  return {
    title: plan.title || plan.theme || '未命名活动',
    cohort: plan.cohort?.name ?? '未归属互助团',
    date: plan.plannedAt ? new Date(plan.plannedAt).toLocaleDateString('zh-CN') : '待定',
    /**
     * 申请日期（2026-11-02 第四十一轮）：
     * 待审核的行在日期下面补一行「申请 M-D」——
     * 审批的人真正在意的是「这份申请等多久了」，
     * 而主日期是活动开展日期（跟排序、跟年份月份筛选是同一个口径，不能换）。
     */
    applied:
      plan.status === 'submitted' && plan.submittedAt
        ? `申请 ${new Date(plan.submittedAt).toLocaleDateString('zh-CN')}`
        : null,
    people: report?.actualParticipants || plan.participants || 0,
    budget: plan.budgetTotal ?? null,
    approved: settled ? Number(reimbursement.approvedAmount) || 0 : null,
    steps: [
      {
        label: STEP_LABELS[0],
        done: ['submitted', 'approved', 'implemented', 'closed'].includes(plan.status),
      },
      { label: STEP_LABELS[1], done: ['approved', 'implemented', 'closed'].includes(plan.status) },
      { label: STEP_LABELS[2], done: Boolean(report) },
      { label: STEP_LABELS[3], done: settled },
    ],
  }
}

/** 一个活动一行：宽屏表格（列宽按比例铺满）；窄屏每个活动一张卡 */
function ActivityTable({
  plans,
  reportByPlan,
  reimburseByPlan,
  todoByPlan,
}: {
  plans: any[]
  reportByPlan: Map<number, any>
  reimburseByPlan: Map<number, any>
  /** 待办落到具体活动：活动 id → 待办事项（"待审核" / "报销待核" / …） */
  todoByPlan?: Map<number, string[]>
}) {
  const rows = plans.map((plan) => ({
    plan,
    ...activityFacts(plan, reportByPlan.get(plan.id), reimburseByPlan.get(plan.id)),
  }))

  return (
    <>
      <div className="hidden md:block">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[12%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
            <col className="w-[27%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>活动</TableHead>
              <TableHead>日期</TableHead>
              <TableHead className="text-right">参与</TableHead>
              <TableHead className="text-right">预算</TableHead>
              <TableHead className="text-right">实际报销</TableHead>
              <TableHead className="pl-4">
                <span className="sr-only">进度</span>
                <ProgressHeader />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.plan.id}
                className="transition-colors duration-300 hover:bg-accent-soft/40 motion-reduce:transition-none"
              >
                <TableCell className="whitespace-normal">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/activities/${row.plan.slug}`}
                      className="font-semibold text-fg underline-offset-4 hover:text-accent hover:underline"
                    >
                      {row.title}
                    </Link>
                    <TodoBadge labels={todoByPlan?.get(row.plan.id)} />
                  </span>
                  <p className="mt-0.5 text-small text-muted">{row.cohort}</p>
                </TableCell>
                <TableCell className="text-body tabular-nums">
                  {row.date}
                  {row.applied ? (
                    <span className="block text-small font-normal text-faint">{row.applied}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.people ? `${row.people} 人` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.budget !== null ? yuan(row.budget) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.approved !== null ? yuan(row.approved) : '—'}
                </TableCell>
                <TableCell className="pl-4">
                  <Progress steps={row.steps} compact />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.plan.id} className={cn("rounded-card border border-rule/70 bg-card p-4 shadow-card", CARD_HOVER)}>
            <Link href={`/activities/${row.plan.slug}`} className="block">
              <span className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-fg">{row.title}</p>
                <TodoBadge labels={todoByPlan?.get(row.plan.id)} />
              </span>
              <p className="mt-0.5 text-small text-muted">
                {row.cohort} · {row.date}
                {row.applied ? ` · ${row.applied}` : ''}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <dt className="text-small text-muted">参与</dt>
                  <dd className="tabular-nums">{row.people ? `${row.people} 人` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-small text-muted">预算</dt>
                  <dd className="tabular-nums">{row.budget !== null ? yuan(row.budget) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-small text-muted">实际报销</dt>
                  <dd className="tabular-nums">{row.approved !== null ? yuan(row.approved) : '—'}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <Progress steps={row.steps} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

/** 图片列表：每场活动一块，名称与日期、活动总结、缩略图（点开看大图），以及本活动的下载 */
function ImageList({
  rows,
}: {
  rows: {
    key: string
    slug: string
    title: string
    cohort: string
    date: string
    summary: string
    photos: any[]
  }[]
}) {
  return (
    <ul className="divide-y divide-rule">
      {rows.map((row) => (
        <li key={row.key} className="space-y-4 py-6 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/activities/${row.slug}`}
                className="font-semibold text-fg underline-offset-4 hover:text-accent hover:underline"
              >
                {row.title}
              </Link>
              <p className="mt-0.5 text-small text-muted">
                {row.cohort} · {row.date}
              </p>
            </div>
            <Button render={<a href={`/api/activity-photos?plan=${row.slug}`} />} variant="outline" size="sm">
              下载本活动（{row.photos.length} 张）
            </Button>
          </div>

          {row.summary ? <p className="text-body leading-relaxed text-fg/80">{row.summary}</p> : null}

          <PhotoGallery
            title={row.title}
            photos={row.photos
              .filter((photo) => photo.url)
              .map((photo, index) => ({
                id: photo.id ?? index,
                url: photo.url as string,
                alt: `${row.title} 第 ${index + 1} 张`,
              }))}
          />
        </li>
      ))}
    </ul>
  )
}

const STEP_LABELS = ['申请', '审核', '反馈', '报销'] as const

/** 进度列的表头：四个环节名，与下面每行的圆点一一对齐（同一套四列网格） */
function ProgressHeader() {
  return (
    <span className="grid grid-cols-4" aria-hidden>
      {STEP_LABELS.map((label) => (
        <span key={label} className="text-center">
          {label}
        </span>
      ))}
    </span>
  )
}

/**
 * 进度图形：四个圆点用线连起来，走过的部分是**主题深紫**的实心点 + 白勾；
 * 当前那一步一圈淡紫光环；没到的是空心圆。
 * `compact` 时只画图形（表头已经写了环节名）；窄屏卡片里带上文字。
 *
 * ⚠️ 走过的圆点用**主题深紫做底**（`bg-accent` + 白勾）——实心、看得清、跟品牌一致；
 * 不要用深紫→粉的渐变加粉色投影（那样又花又撞色），也不要退成浅紫底（太轻，看不出来已完成）。
 */
function Progress({
  steps,
  compact = false,
}: {
  steps: { label: string; done: boolean }[]
  compact?: boolean
}) {
  const doneCount = steps.filter((s) => s.done).length
  const current = steps.findIndex((s) => !s.done)
  const summary = steps.map((s) => `${s.label}${s.done ? '已完成' : '未完成'}`).join('，')

  return (
    <div className="relative" role="img" aria-label={`进度：${summary}`}>
      {/* 底线与走过的线：从第一列中心到最后一列中心 */}
      <span className="absolute top-3.5 right-[12.5%] left-[12.5%] h-0.5 rounded-full bg-rule" aria-hidden />
      <span
        className="absolute top-3.5 left-[12.5%] h-0.5 rounded-full bg-accent/45 transition-[width] duration-700 motion-reduce:transition-none"
        style={{ width: `${(Math.max(0, doneCount - 1) / (steps.length - 1)) * 75}%` }}
        aria-hidden
      />
      <ol className="relative grid grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.label} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full border-2 transition-colors',
                step.done
                  ? 'border-transparent bg-accent text-inverse-fg'
                  : index === current
                    ? 'border-accent bg-card ring-4 ring-accent-soft'
                    : 'border-rule bg-card',
              )}
              aria-hidden
            >
              {step.done ? <Check className="size-4" strokeWidth={3} /> : null}
            </span>
            {compact ? null : (
              <span className={cn('text-small', step.done ? 'text-fg' : 'text-faint')} aria-hidden>
                {step.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
