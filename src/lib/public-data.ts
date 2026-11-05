/**
 * 公众数据读取层。
 *
 * 约定：
 * - 只读公开集合（publications / resources / cohorts / media）；
 * - 一律服务端 overrideAccess + 精确过滤，未登录用户拿不到内部数据；
 * - 返回结构与公开站的组件 props 一一对应，页面不再二次拼装。
 *
 * 公众站的**主内容是"成果"**：一条 publications 记录 = 一条成果卡片。
 */
import type { Where } from 'payload'

import { activityKind, type ActivityKind } from './activity-kind'
import { getClient } from './payload'
import { shortRegion } from './region'

interface OutcomeFile {
  filename?: string
  url?: string
  mimeType?: string
  filesize?: number
}

/** 成果卡片的形态：有图 → 照片卡；有附件 → 文件卡；都没有 → 话语卡 */
type OutcomeVariant = 'photo' | 'quote' | 'file'

export interface Outcome {
  slug: string
  title: string
  excerpt?: string
  type?: string
  date?: string
  location?: string
  byline?: string
  attendeeCount?: number
  cover?: { url?: string; alt?: string; width?: number; height?: number } | null
  file?: OutcomeFile | null
  circle?: { name?: string; slug?: string; city?: string; category?: string } | null
  /** 互助团所属项目类别（go-mulan / a-idol / homestay-manager） */
  category?: string
  /** 活动类别（SOP 四类，见 lib/activity-kind.ts） */
  kind: ActivityKind
  variant: OutcomeVariant
}

interface OutcomeDetail extends Outcome {
  content?: unknown
  gallery?: { url?: string; alt?: string }[]
}

export interface CircleSummary {
  slug: string
  name: string
  city?: string
  /** 紧凑地域：官方省简称 + 区/县简称（浙 · 西湖）；无省市区数据时回落到 city */
  regionShort?: string
  /** 全称地域：市 + 区/县（杭州市西湖区、北京市朝阳区）；用于地图悬停 */
  placeFull?: string
  theme?: string
  category?: string
  outcomeCount?: number
  /** 公开活动的参与人次合计 */
  people?: number
  description?: string
  /** 创建时间：这个团第一次建起来的时间 */
  createdAt?: string
  /**
   * 团的运行状态：active 运行中 / closed 已停止组织新活动。
   * 公开站**不按状态屏蔽**——历史成果照常展示，只是 stopped 的团主页上会有一句说明。
   */
  status?: string
  /** 最近一条成果（团卡上的配图与标题都取自它） */
  latest?: {
    slug?: string
    title?: string
    date?: string
    cover?: { url?: string; alt?: string; width?: number; height?: number } | null
  }
}

/** 互助团详情：谁、做了什么、留下了什么 */
interface CircleDetail extends CircleSummary {
  slug: string
  /** 团长的称呼（只取姓名，不带联系方式） */
  leaderName?: string
  /** 主页 Banner 大图（工作台可换）；没传时页面回落到最近一场活动的现场照片 */
  cover?: { url?: string; alt?: string } | null
  /** 骨干成员：只存名字 */
  team?: {
    viceLeader?: string | null
    resourceLiaison?: string | null
    materials?: string | null
    media?: string | null
  } | null
  outcomes: Outcome[]
  resources: LibrarySummary[]
}

export interface LibrarySummary {
  slug: string
  title: string
  summary?: string
  category?: string
  /** 文件形态：doc 文档 / video 视频 */
  type?: string
  /** 外链：视频在线版、VI 在线版这类 */
  url?: string | null
  cover?: { url?: string; alt?: string; width?: number; height?: number } | null
  file?: OutcomeFile | null
  publishedAt?: string
  body?: unknown
}

const publishedWhere = (): Where => ({
  publishedAt: { less_than_equal: new Date().toISOString() },
})

/** 关系字段可能是 id 或已展开的文档；这里统一取文档对象 */
const asDoc = (value: unknown): any => {
  if (!value || typeof value !== 'object') return null
  return value
}

/** 上传文件关系 → 下载信息 */
const fileOf = (value: unknown): OutcomeFile | null => {
  const file = asDoc(value)
  if (!file?.url) return null
  return {
    filename: file.filename,
    url: file.url,
    mimeType: file.mimeType,
    filesize: file.filesize,
  }
}

const coverOf = (doc: any): Outcome['cover'] => {
  const file = asDoc(doc?.cover)
  if (!file?.url) return null
  return {
    url: file.url,
    alt: file.alt ?? doc?.title,
    width: file.width ?? undefined,
    height: file.height ?? undefined,
  }
}

/** 卡片形态：按有没有图 / 有没有附件自动判定，保证瀑布流高低错落 */
const variantOf = (doc: any): OutcomeVariant => {
  if (fileOf(doc?.file)) return 'file'
  if (coverOf(doc)) return 'photo'
  return 'quote'
}

const outcomeOf = (doc: any): Outcome => {
  const cohort = asDoc(doc?.relatedCohort)
  return {
    slug: doc.slug,
    title: doc.title,
    excerpt: doc.excerpt,
    type: doc.type,
    date: doc.eventDate ?? doc.publishedAt,
    location: doc.eventLocation,
    byline: doc.byline,
    attendeeCount: doc.attendeeCount ?? undefined,
    cover: coverOf(doc),
    file: fileOf(doc?.file),
    circle: cohort?.name
      ? { name: cohort.name, slug: cohort.slug, city: cohort.region, category: cohort.category }
      : null,
    category: cohort?.category,
    kind: (doc.kind as ActivityKind | null | undefined) ?? activityKind(doc.title, doc.excerpt),
    variant: variantOf(doc),
  }
}

/** 成果流（公众站主内容） */
export const getOutcomes = async (
  limit = 30,
  opts: {
    /** 排序口径：`eventDate` = 按活动开展日期倒序（默认）；`publishedAt` = 按项目组推送时间倒序 */
    sort?: 'publishedAt' | 'eventDate'
    type?: string
    circle?: string
    category?: string
  } = {},
): Promise<Outcome[]> => {
  const payload = await getClient()
  const where: Where[] = [publishedWhere()]
  if (opts.type) where.push({ type: { equals: opts.type } })
  if (opts.category) {
    // 项目类别挂在互助团上：先找出该类别的公开团，再按 relatedCohort 过滤
    const cohorts = await payload.find({
      collection: 'cohorts',
      where: {
        and: [
          { category: { equals: opts.category } },
          { isPublic: { equals: true } },
        ],
      },
      limit: 300,
      depth: 0,
      overrideAccess: true,
    })
    const ids = (cohorts.docs ?? []).map((doc: any) => doc.id)
    if (!ids.length) return []
    where.push({ relatedCohort: { in: ids } })
  }
  if (opts.circle) {
    // 按互助团过滤：先定位互助团，再按 relatedCohort 过滤
    const cohort = await payload.find({
      collection: 'cohorts',
      where: {
        and: [
          { slug: { equals: opts.circle } },
          { isPublic: { equals: true } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const cohortId = cohort.docs?.[0]?.id
    if (!cohortId) return []
    where.push({ relatedCohort: { equals: cohortId } })
  }

  // 排序：默认按活动开展日期倒序（`eventDate`），而不是项目组推送时间。
  // ⚠️ Postgres 的 `DESC` 默认把 NULL 排在**最前**，没有活动日期的成果会被顶到最前；
  //    所以分成两批取：有活动日期的按 `-eventDate`，没有的按 `-publishedAt` 接在后面。
  if ((opts.sort ?? 'eventDate') === 'eventDate') {
    const [has, missing] = await Promise.all([
      payload.find({
        collection: 'publications',
        where: { and: [...where, { eventDate: { exists: true } }] },
        sort: '-eventDate',
        limit,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'publications',
        where: { and: [...where, { eventDate: { exists: false } }] },
        sort: '-publishedAt',
        limit,
        depth: 1,
        overrideAccess: true,
      }),
    ])
    return [...(has.docs ?? []), ...(missing.docs ?? [])].map(outcomeOf)
  }

  const res = await payload.find({
    collection: 'publications',
    where: { and: where },
    sort: '-publishedAt',
    limit,
    depth: 1,
    overrideAccess: true,
  })
  return (res.docs ?? []).map(outcomeOf)
}

/** 单条成果详情 */
export const getOutcomeBySlug = async (slug: string): Promise<OutcomeDetail | null> => {
  const payload = await getClient()
  const res = await payload.find({
    collection: 'publications',
    where: { and: [publishedWhere(), { slug: { equals: slug } }] },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const doc = res.docs?.[0]
  if (!doc) return null

  // 现场照片来自该活动的反馈记录；只取活动照片，签到表与费用凭证不出现在公众页
  let gallery: { url?: string; alt?: string }[] = []
  const reportId = asDoc(doc.relatedReport)?.id ?? doc.relatedReport
  if (reportId) {
    try {
      const report = await payload.findByID({
        collection: 'activity-reports',
        id: reportId,
        depth: 1,
        overrideAccess: true,
      })
      const photos = Array.isArray(report?.photos) ? report.photos : []
      gallery = photos
        .map((photo: any) => {
          const file = asDoc(photo)
          return file?.url ? { url: file.url, alt: file.alt ?? doc.title } : null
        })
        .filter(Boolean) as { url?: string; alt?: string }[]
    } catch {
      gallery = []
    }
  }

  return { ...outcomeOf(doc), content: doc.content, gallery }
}

/**
 * 互助团版图：每个团带了成员数与成果数。
 *
 * 默认**包含已解散的团**——它们的页面与成果照常公开（历史算数）。
 * `activeOnly` 给"现状统计"用（首页的数字与地图）：只算还在组织新活动的团，
 * 免得首页写着 54 个团、地图上却数出 55 个。
 */
export const getCircles = async (
  limit = 24,
  opts: { activeOnly?: boolean } = {},
): Promise<CircleSummary[]> => {
  const payload = await getClient()
  const [circles, outcomes] = await Promise.all([
    payload.find({
      collection: 'cohorts',
      where: opts.activeOnly
        ? { and: [{ isPublic: { equals: true } }, { status: { equals: 'active' } }] }
        : { and: [{ isPublic: { equals: true } }] },
      sort: 'name',
      limit,
      depth: 0,
      overrideAccess: true,
    }),
    getOutcomes(200),
  ])

  return (circles.docs ?? []).map((doc: any) => {
    const mine = outcomes.filter((o) => o.circle?.slug === doc.slug)
    const latest = mine[0]
    return {
      slug: doc.slug,
      name: doc.name,
      city: doc.region,
      regionShort: shortRegion(doc.location?.province, doc.location?.district) || doc.region,
      placeFull: [doc.location?.city, doc.location?.district].filter(Boolean).join('') || doc.region,
      theme: doc.theme,
      category: doc.category,
      description: doc.description ?? undefined,
      createdAt: doc.createdAt ?? undefined,
      status: doc.status ?? 'active',
      outcomeCount: mine.length,
      people: mine.reduce((sum, o) => sum + (Number(o.attendeeCount) || 0), 0),
      latest: latest
        ? { slug: latest.slug, title: latest.title, date: latest.date, cover: latest.cover }
        : undefined,
    }
  })
}

/** 某个互助团留下的公开资料 */
const getResourcesByCircle = async (slug: string): Promise<LibrarySummary[]> => {
  const payload = await getClient()
  const circle = await payload.find({
    collection: 'cohorts',
    // 与团主页同一口径：只认公开的团。
    // ⚠️ 已解散的团**照样公开**（历史成果不算数？——算数），只是主页上会有一句
    //    "现在没有组织新活动了"（2026-10-31 定稿，见 docs/设计规范.md §0.1）
    where: {
      and: [{ slug: { equals: slug } }, { isPublic: { equals: true } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = circle.docs?.[0]
  if (!doc) return []

  const res = await payload.find({
    collection: 'resources',
    where: { relatedCohort: { equals: doc.id } },
    sort: '-publishedAt',
    limit: 24,
    depth: 1,
    overrideAccess: true,
  })
  return (res.docs ?? []).map((doc: any) => ({
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    category: doc.category ?? undefined,
    type: doc.type ?? undefined,
    url: doc.url ?? null,
    cover: coverOf(doc),
    file: fileOf(doc.file),
    publishedAt: doc.publishedAt ?? undefined,
  }))
}

/** 互助团详情：团本身 + 它的成果 + 它留下的资料 */
export const getCircleBySlug = async (slug: string): Promise<CircleDetail | null> => {
  const payload = await getClient()
  const res = await payload.find({
    collection: 'cohorts',
    where: {
      and: [{ slug: { equals: slug } }, { isPublic: { equals: true } }],
    },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const doc = res.docs?.[0]
  if (!doc) return null

  const [outcomes, resources] = await Promise.all([
    getOutcomes(60, { circle: slug }),
    getResourcesByCircle(slug),
  ])

  const latest = outcomes[0]
  return {
    slug: doc.slug,
    name: doc.name,
    city: doc.region ?? undefined,
    regionShort: shortRegion(doc.location?.province, doc.location?.district) || doc.region || undefined,
    status: doc.status ?? 'active',
    theme: doc.theme ?? undefined,
    category: doc.category ?? undefined,
    description: doc.description ?? undefined,
    createdAt: doc.createdAt ?? undefined,
    leaderName: asDoc(doc.leader)?.name ?? undefined,
    outcomeCount: outcomes.length,
    people: outcomes.reduce((sum, o) => sum + (Number(o.attendeeCount) || 0), 0),
    latest: latest
      ? { slug: latest.slug, title: latest.title, date: latest.date, cover: latest.cover }
      : undefined,
    cover: coverOf(doc),
    team: doc.team ?? null,
    outcomes,
    resources,
  }
}

/** 资料库条目 */
export const getLibrary = async (limit = 48): Promise<LibrarySummary[]> => {
  const payload = await getClient()
  const res = await payload.find({
    collection: 'resources',
    where: {},
    sort: '-publishedAt',
    limit,
    depth: 1,
    overrideAccess: true,
  })
  return (res.docs ?? []).map((doc: any) => ({
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    category: doc.category ?? undefined,
    // 类型与外链必须带出来：列表页按「文档 / 视频」筛选、卡片判断播放还是下载都靠它
    type: doc.type ?? undefined,
    url: doc.url ?? null,
    cover: coverOf(doc),
    file: fileOf(doc.file),
    publishedAt: doc.publishedAt ?? undefined,
  }))
}

/** 单个资料库条目 */
export const getLibraryItemBySlug = async (slug: string): Promise<LibrarySummary | null> => {
  const payload = await getClient()
  const res = await payload.find({
    collection: 'resources',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const doc = res.docs?.[0]
  if (!doc) return null
  return {
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary ?? undefined,
    category: doc.category ?? undefined,
    type: doc.type ?? undefined,
    url: doc.url ?? null,
    cover: coverOf(doc),
    file: fileOf(doc.file),
    publishedAt: doc.publishedAt ?? undefined,
    body: doc.body,
  }
}

/** 公众站展示用的数字指标 */
export const getPublicStats = async () => {
  const payload = await getClient()
  const [circles, outcomes, resources, attendees] = await Promise.all([
    payload.count({
      collection: 'cohorts',
      // 首页的「N 个互助团」是**现状**：只算还在组织新活动的团；
      // 已解散的团页面照常公开，但不进这个数字（2026-10-31 第三十二轮）
      where: { and: [{ isPublic: { equals: true } }, { status: { equals: 'active' } }] },
      overrideAccess: true,
    }),
    payload.count({ collection: 'publications', where: publishedWhere(), overrideAccess: true }),
    payload.count({
      collection: 'resources',
      where: {},
      overrideAccess: true,
    }),
    payload.find({
      collection: 'publications',
      where: publishedWhere(),
      limit: 300,
      depth: 0,
      overrideAccess: true,
      select: { attendeeCount: true },
    }),
  ])
  return {
    circles: circles.totalDocs,
    outcomes: outcomes.totalDocs,
    resources: resources.totalDocs,
    // 一个团只有一个团长，人数看成果里的参与人次
    alumnae: (attendees.docs ?? []).reduce(
      (sum: number, doc: any) => sum + (Number(doc.attendeeCount) || 0),
      0,
    ),
  }
}
