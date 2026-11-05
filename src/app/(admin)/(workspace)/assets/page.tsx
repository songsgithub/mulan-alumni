import { redirect } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import type { Where } from 'payload'

import { ResourceBrowser, type ResourceRow } from '@/components/console/ResourceBrowser'
import { ResourceUploadDialog } from '@/components/console/ResourceUploadDialog'
import { PageHeader } from '@/components/console/PageHeader'
import { PageHelp } from '@/components/console/PageHelp'
import { isProjectTeam, requireUser } from '@/lib/auth'
import { getClient } from '@/lib/payload'
import { FILE_KIND_LABEL } from '@/lib/labels'
import { readResourceType } from '@/lib/resource-filter'
import { publicSiteUrl } from '@/lib/site-url'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const metadata = { title: '资源' }

const PAGE_SIZE = 20

/**
 * 资源：**项目组独占**。
 *
 * 页面正事是**清单**（表格 + 类型分页签）；上传收在右上角的弹窗里。
 * 传完即公开，公众站 `/resources` 能看、能下载、能播。
 * 团长与成员没有这一摊事——导航里也不出现「资源」，直接访问会回工作台首页。
 *
 * 表格是**服务端分页**：类型分页签与页码都在地址里（`?type=doc&page=2`），
 * 前端只拿当前这一页——资源会一直攒，不能一次全拉回来。
 */
export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const user = await requireUser()
  if (!isProjectTeam(user)) redirect('/')

  const payload = await getClient()
  const type = readResourceType(sp.type)
  const requested = Math.max(1, Number.parseInt(String(sp.page ?? '1'), 10) || 1)
  const where: Where = type === 'all' ? {} : { type: { equals: type } }

  const res = await payload.find({
    collection: 'resources',
    where,
    limit: PAGE_SIZE,
    page: requested,
    sort: '-createdAt',
    depth: 1,
    user: user as any,
    overrideAccess: false,
  })

  const total = res.totalDocs ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requested, totalPages)
  // 页码超出范围（换了类型后还停在第 5 页）→ 拉回最后一页
  const docs =
    page === requested
      ? (res.docs ?? [])
      : (
          await payload.find({
            collection: 'resources',
            where,
            limit: PAGE_SIZE,
            page,
            sort: '-createdAt',
            depth: 1,
            user: user as any,
            overrideAccess: false,
          })
        ).docs ?? []

  // 分页签上的三个数字：各数一次（资源量不大，三次计数很便宜）
  const countFor = async (w: Where) =>
    (await payload.count({ collection: 'resources', where: w, user: user as any, overrideAccess: false }))
      .totalDocs
  const counts = {
    all: await countFor({}),
    doc: await countFor({ type: { equals: 'doc' } }),
    video: await countFor({ type: { equals: 'video' } }),
  }

  const publicHref = publicSiteUrl() || '/'

  const rows: ResourceRow[] = (docs as any[]).map((r) => ({
    id: r.id,
    slug: r.slug ?? null,
    title: r.title,
    summary: r.summary ?? null,
    category: r.category ?? null,
    type: r.type ?? 'doc',
    fileName: r.file?.filename ?? null,
    fileSize: r.file?.filesize ?? null,
    fileKind: r.file?.mimeType ? (FILE_KIND_LABEL[r.file.mimeType] ?? null) : null,
    url: r.url ?? null,
    publishedAt: r.publishedAt ?? null,
  }))

  return (
    <div>
      <PageHeader
        title="资源"
        help={
          <PageHelp title="资源">
            <p>
              传完即公开：公众站的资料库里能看到、能下载、能播。
              团长与成员只去公众站看，这里是项目组独占的。
            </p>
            <p>每一行都能改、能删——资源是公开内容，删了公众站上立刻就没有了。</p>
          </PageHelp>
        }
        actions={
          <>
            <ResourceUploadDialog />
            <Button variant="outline" render={<a href={`${publicHref}/resources`} target="_blank" rel="noreferrer" />}>
                公开站资源页
                <ArrowUpRight aria-hidden className="size-4 shrink-0 opacity-60" />
            </Button>
          </>
        }
      />

      <Card className="mt-8 gap-0 py-0">
        <ResourceBrowser
          rows={rows}
          counts={counts}
          activeType={type}
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          publicHref={publicHref}
        />
      </Card>
    </div>
  )
}
