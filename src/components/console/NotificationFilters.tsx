import { ClearFiltersButton } from '@/components/console/ClearFiltersButton'
import { ListToolbar } from '@/components/console/kit'
import { LinkTabs } from '@/components/console/LinkTabs'
import { UrlSearchField } from '@/components/console/UrlSearchField'
import { notificationHref, type NotificationFilterValue } from '@/lib/notification-filter'

const READ_OPTIONS: { value: NotificationFilterValue['read']; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'unread', label: '未读' },
  { value: 'read', label: '已读' },
]

/**
 * 通知筛选条：已读状态（单选 → 分页签）+ 标题关键字（写地址的搜索框）。
 *
 * 与资源页、经费页同一套列表工具条（`ListToolbar`）：左边分页签、右边搜索；
 * 单选用分页签、多选才用按钮——不再用一排实心按钮表示单选。
 * 条件写进 URL（`?read=unread&q=报销`），换条件时页码回到第 1 页。
 */
export function NotificationFilters({
  value,
  counts,
}: {
  value: NotificationFilterValue
  /** 各分页签后面的数量（与资源页「全部 9」同一写法） */
  counts?: Record<NotificationFilterValue['read'], number>
}) {
  const hasFilter = value.read !== 'all' || Boolean(value.q)
  return (
    <ListToolbar>
      <LinkTabs
        value={value.read}
        ariaLabel="已读状态"
        items={READ_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          count: counts?.[option.value],
          href: notificationHref({ ...value, read: option.value }, 1),
        }))}
      />
      <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
        <UrlSearchField
          value={value.q}
          baseHref={notificationHref({ ...value, q: '' }, 1)}
          placeholder="搜通知标题"
          ariaLabel="搜索通知标题"
          className="min-w-0 flex-1 sm:w-72 sm:flex-none"
        />
        {hasFilter ? <ClearFiltersButton href={notificationHref({ read: 'all', q: '' }, 1)} /> : null}
      </div>
    </ListToolbar>
  )
}
