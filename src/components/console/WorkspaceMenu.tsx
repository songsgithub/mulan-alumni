'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import { NAV_ICONS, isNavActive, type WorkspaceNavItem } from './WorkspaceNav'

const LINK_CLASS =
  'inline-flex min-h-12 items-center rounded-full px-4 text-body font-medium text-fg transition-colors hover:bg-accent-soft/50'

/**
 * 工作台的窄屏菜单（汉堡按钮 + 左侧抽屉）。
 *
 * 手机上把「活动 / 互助团 / 经费 / 资源 / 设置」硬塞进一行既点不准也挤，
 * 所以 `md` 以下一律收进抽屉；桌面端这一排不出现（见 `WorkspaceNav`）。
 *
 * 抽屉里除了导航，还放「公开站」与「退出」——窄屏顶栏只留 logo 与这个按钮，
 * 这两样东西不能没地方去。
 */
export function WorkspaceMenu({
  items,
  roleLabel,
  userName,
  publicHref,
  accountHref,
}: {
  items: WorkspaceNavItem[]
  roleLabel: string
  userName: string
  publicHref: string
  /** 个人信息页（顶栏桌面版点名字进的那页，抽屉里也放一个入口） */
  accountHref?: string
}) {
  const pathname = usePathname() ?? ''

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="打开菜单" className="-mr-2">
            <Menu className="size-5" />
          </Button>
        }
      />

      <SheetContent side="left" className="w-[82%] max-w-sm p-0">
        <SheetHeader className="pr-14">
          <SheetTitle className="text-brand-name">工作台</SheetTitle>
          <SheetDescription>
            {roleLabel} · {userName}
          </SheetDescription>
        </SheetHeader>

        <nav aria-label="工作台导航" className="px-3">
          <ul className="space-y-1">
            {items.map((item) => {
              const active = isNavActive(pathname, item)
              const Icon = item.icon ? NAV_ICONS[item.icon] : null
              return (
                <li key={item.href}>
                  <SheetClose
                    nativeButton={false}
                    render={
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-12 items-center gap-3 rounded-full px-4 text-body font-medium transition-colors',
                          active ? 'bg-accent-soft font-semibold text-accent' : 'text-fg hover:bg-accent-soft hover:text-accent',
                        )}
                      />
                    }
                  >
                    {Icon ? <Icon aria-hidden className="size-5" /> : null}
                    {item.label}
                  </SheetClose>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="px-3">
          <SheetClose nativeButton={false} render={<Link href="/notifications" className={LINK_CLASS} />}>
            通知
          </SheetClose>
        </div>

        <SheetFooter>
          {accountHref ? (
            <SheetClose nativeButton={false} render={<Link href={accountHref} className={LINK_CLASS} />}>
              个人信息
            </SheetClose>
          ) : null}
          <a href={publicHref} target="_blank" rel="noreferrer noopener" className={LINK_CLASS}>
            公开站
            <ArrowUpRight aria-hidden className="ml-auto size-4 shrink-0" />
          </a>
          <SheetClose nativeButton={false} render={<Link href="/logout" className={LINK_CLASS} />}>退出</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
