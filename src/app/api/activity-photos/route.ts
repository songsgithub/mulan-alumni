import type { Where } from 'payload'
import { NextResponse } from 'next/server'

import {
  ArchiveTooLargeError,
  activityDateKey,
  activityPhotos,
  buildPhotoEntries,
  safeNamePart,
} from '@/lib/activity-photos'
import { currentUser, isProjectTeam } from '@/lib/auth'
import { findForUser, ownCohortWhere } from '@/lib/console-data'
import { loadHomeScope, readHomeFilters } from '@/lib/home-scope'
import { hit } from '@/lib/rate-limit'
import { buildZip } from '@/lib/zip'

/**
 * 活动图片下载（工作台）。
 *
 * - `?plan=<活动标识>`：下载这一场活动的原图；
 * - 不带 plan：下载当前筛选范围内、有照片的全部活动（筛选参数与首页一致）。
 *
 * 权限与首页完全一致：团长只能下自己那个团的，项目组看不到草稿。
 * 文件名见 `lib/activity-photos.ts`：`20261125_杭州AI互助团_活动名（1）.jpg`。
 */

const PLAN_SLUG = /^[a-z0-9]{6,32}$/

/** 打包要把原图全部读进内存：同时最多打 2 个包，每个账号 10 分钟 20 次（与 PDF 打印同一套做法） */
const MAX_CONCURRENT = 2
let packing = 0

export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  if (!hit(`user:${user.id}`, { name: 'photo-zip', limit: 20, windowMs: 10 * 60_000 }).ok) {
    return NextResponse.json({ error: '下载太频繁，请稍后再试' }, { status: 429 })
  }
  if (packing >= MAX_CONCURRENT) {
    return NextResponse.json(
      { error: '正在打包别的图片，请稍后再试' },
      { status: 503, headers: { 'Retry-After': '5' } },
    )
  }
  packing += 1
  try {
    return await build(request, user)
  } finally {
    packing -= 1
  }
}

async function build(request: Request, user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {

  const url = new URL(request.url)
  const planSlug = url.searchParams.get('plan')

  let targets: { plan: any; report: any }[]
  let zipName: string

  if (planSlug) {
    if (!PLAN_SLUG.test(planSlug)) return NextResponse.json({ error: '活动地址不正确' }, { status: 400 })

    // 单场活动：与活动详情页一样按团收窄，草稿对项目组不可见
    const conds: Where[] = [{ slug: { equals: planSlug } }]
    const own = await ownCohortWhere(user)
    if (Object.keys(own).length) conds.push(own)
    if (isProjectTeam(user)) conds.push({ status: { not_equals: 'draft' } })

    const [plan] = await findForUser<any>(user, 'activity-plans', { and: conds }, { limit: 1 })
    if (!plan) return NextResponse.json({ error: '活动不存在' }, { status: 404 })

    const [report] = await findForUser<any>(user, 'activity-reports', { plan: { equals: plan.id } }, { limit: 1 })
    targets = report && activityPhotos(report).length ? [{ plan, report }] : []

    const date = activityDateKey(report?.actualAt || plan.plannedAt)
    const cohort = safeNamePart(plan.cohort?.name ?? '未归属互助团')
    const title = safeNamePart(plan.title || plan.theme || '未命名活动')
    zipName = `${date}_${cohort}_${title}.zip`
  } else {
    const params: Record<string, string[]> = {}
    for (const key of new Set(url.searchParams.keys())) params[key] = url.searchParams.getAll(key)

    const filters = readHomeFilters(params, new Date().getFullYear())
    const scope = await loadHomeScope(user, filters)
    targets = scope.plans
      .map((plan: any) => ({ plan, report: scope.reportByPlan.get(plan.id) }))
      .filter((t: { report: any }) => t.report && activityPhotos(t.report).length > 0)
    zipName = '活动图片.zip'
  }

  if (!targets.length) return NextResponse.json({ error: '这段范围内没有活动图片' }, { status: 404 })

  let entries
  try {
    entries = await buildPhotoEntries(targets)
  } catch (err) {
    if (err instanceof ArchiveTooLargeError) {
      return NextResponse.json({ error: err.message }, { status: 413 })
    }
    console.error('活动图片打包失败', err)
    return NextResponse.json({ error: '图片读取失败，请稍后重试' }, { status: 502 })
  }

  const zip = buildZip(entries)
  // 文件名含中文：ASCII 兜底 + RFC 5987 的 UTF-8 写法
  const disposition = `attachment; filename="activity-photos.zip"; filename*=UTF-8''${encodeURIComponent(zipName)}`
  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': disposition,
      'Cache-Control': 'private, no-store',
    },
  })
}
