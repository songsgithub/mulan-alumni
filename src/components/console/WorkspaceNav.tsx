'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, FolderHeart, HeartHandshake, Settings2, Wallet, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/** 导航图标（仅窄屏抽屉用）：服务端布局只传键名，这里映射成图标 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  activities: ClipboardList,
  circles: HeartHandshake,
  assets: FolderHeart,
  settings: Settings2,
  budget: Wallet,
}

export interface WorkspaceNavItem {
  href: string
  label: string
  /** 图标键名（仅窄屏抽屉用），见 NAV_ICONS */
  icon?: keyof typeof NAV_ICONS | string
  /**
   * 判定"当前在哪"用的路径前缀。
   * 互助团这几条的内部真实路径是 /network（proxy rewrite，URL 仍是 /circles），
   * 两个都要匹配，否则在互助团页里导航不高亮。
   */
  match: string[]
}

/** 当前路径是否落在某一项上（桌面横排与抽屉共用同一套判定） */
export function isNavActive(pathname: string, item: WorkspaceNavItem) {
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * 工作台主导航（桌面横排）：纯文字胶囊，与公开站桌面导航同一套写法；
 * 图标只给窄屏抽屉用（`WorkspaceMenu`，与公开站抽屉一致）。
 */
export function WorkspaceNav({
  items,
  className,
}: {
  items: WorkspaceNavItem[]
  className?: string
}) {
  const pathname = usePathname() ?? ''

  return (
    <nav aria-label="工作台导航" className={cn('flex items-center gap-1', className)}>
      {items.map((item) => {
        const active = isNavActive(pathname, item)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full px-2.5 py-2 text-small whitespace-nowrap transition-all duration-300 ease-soft xl:px-4',
              active
                ? 'bg-fg font-medium text-inverse-fg shadow-nav-active'
                : 'text-fg/75 hover:bg-accent-soft hover:text-accent',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
