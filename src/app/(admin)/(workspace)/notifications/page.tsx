import { NotificationFilters } from '@/components/console/NotificationFilters'
import { NotificationTable } from '@/components/console/NotificationTable'
import { EmptyState } from '@/components/console/EmptyState'
import { Pager } from '@/components/console/Pager'
import { PageHeader } from '@/components/console/PageHeader'
import { PageHelp } from '@/components/console/PageHelp'
import { Card } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { getClient } from '@/lib/payload'
import { notificationHref, notificationWhere, readNotificationFilters } from '@/lib/notification-filter'

export const metadata = { title: '通知' }

const PAGE_SIZE = 20

/**
 * 全部通知（右上角铃铛 → 全部通知）。
 *
 * **一张表**（标题 / 时间 / 状态），与资源页同一套表格版式；
 * **服务端分页 + 服务端筛选**：条件与页码都写进 URL
 * （`?read=unread&q=报销&page=2`），地址可分享、刷新不丢条件。
 *
 * 为什么不让前端一次拉全部：通知会一直攒下去（审批、核定、联系表单…），
 * 一把梭拉回来的话，页面会越拉越长，筛选也没法做。
 *
 * **点一条即读掉一条**（未读 → 已读）：交互在 `NotificationTable` 里，
 * 服务端动作 `markNotificationsRead`。合作类留言没有跳转链接，
 * 点标题就停在原地把未读消掉——以前这一页根本没法单条处理。
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const user = await requireUser()
  const payload = await getClient()

  const filters = readNotificationFilters(sp)
  const requested = Math.max(1, Number.parseInt(String(sp.page ?? '1'), 10) || 1)
  const where = notificationWhere(user.id, filters)

  const res = await payload.find({
    collection: 'notifications',
    where,
    limit: PAGE_SIZE,
    page: requested,
    sort: '-createdAt',
    depth: 0,
    user: user as any,
    overrideAccess: false,
  })

  const total = res.totalDocs ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requested, totalPages)
  // 页码超出范围（比如筛选条件变窄后还停在第 5 页）→ 拉回最后一页
  const docs =
    page === requested
      ? (res.docs ?? [])
      : (
          await payload.find({
            collection: 'notifications',
            where,
            limit: PAGE_SIZE,
            page,
            sort: '-createdAt',
            depth: 0,
            user: user as any,
            overrideAccess: false,
          })
        ).docs ?? []

  const { totalDocs: unreadCount } = await payload.count({
    collection: 'notifications',
    where: { and: [{ recipient: { equals: user.id } }, { read: { equals: false } }] },
    user: user as any,
    overrideAccess: false,
  })
  const { totalDocs: allCount } = await payload.count({
    collection: 'notifications',
    where: { recipient: { equals: user.id } },
    user: user as any,
    overrideAccess: false,
  })

  const hrefFor = (n: number) => notificationHref(filters, n)

  return (
    <div>
      <PageHeader
        title="通知"
        help={
          <PageHelp title="通知">
            <p>活动审批、报销核定与联系表单的留言都会落到这里。</p>
            <p>右上角铃铛是同一批通知的未读提醒。</p>
            <p>
              <strong className="font-medium text-fg">点一条标题就算读过了</strong>
              ：有跳转地址的会标已读并打开对应页面，合作留言没有地址，就停在原地把未读消掉。
              也可以点右侧的「标为已读」。
            </p>
            <p>按「已读 / 未读」筛，或用关键词搜标题。</p>
          </PageHelp>
        }
      />

      <Card className="mt-8 gap-0 py-0">
        <NotificationFilters value={filters} counts={{ all: allCount, unread: unreadCount, read: allCount - unreadCount }} />

        {docs.length ? (
          <div className="px-3">
            <NotificationTable
              rows={(docs as any[]).map((doc) => ({
                id: String(doc.id),
                title: String(doc.title ?? ''),
                link: doc.link ?? null,
                read: Boolean(doc.read),
                createdAt: doc.createdAt ?? null,
              }))}
              query={filters.q}
            />
          </div>
        ) : (
          <EmptyState
            compact
            title={filters.read !== 'all' || filters.q ? '没有符合条件的通知' : '还没有通知'}
            hint={
              filters.read !== 'all' || filters.q
                ? '换个关键词，或把筛选条件清掉再看看。'
                : '活动审批、报销核定与联系表单的留言都会出现在这里。'
            }
          />
        )}

        <div className="px-6 pb-5">
          <Pager
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            hrefFor={hrefFor}
          />
        </div>
      </Card>
    </div>
  )
}
