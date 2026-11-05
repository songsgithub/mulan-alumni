'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, BookOpen, Briefcase, Flower2, LayoutGrid, List, Menu, Sprout, type LucideIcon } from 'lucide-react'

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { site } from '@/content/site'
import { cn } from '@/lib/utils'

interface SiteNavItem {
  href: string
  label: string
  icon?: string
}

/** 工作台入口（另一个域名，新标签打开） */
interface SiteNavWorkspace {
  href: string
  label: string
  title?: string
}

const ICONS: Record<string, LucideIcon> = {
  home: Sprout,
  circles: LayoutGrid,
  activities: List,
  resources: BookOpen,
  about: Flower2,
}

/**
 * 公开站导航（muse 的顶部导航）：桌面横排，当前项蓝底白字；
 * 窄屏收进左侧抽屉（muse 原版是一排小图标，5 个入口时点不准，改成抽屉）。
 */
export function SiteNav({
  items,
  brand,
  workspace,
}: {
  items: readonly SiteNavItem[]
  brand: { wordmark: string }
  workspace?: SiteNavWorkspace
}) {
  const pathname = usePathname() ?? ''
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`))

  // 点的就是当前这一页时不会发生路由跳转，也就不会滚动——补一手回顶部
  const scrollTopIfActive = (active: boolean) => {
    if (!active) return
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  return (
    <>
      <nav aria-label="主导航" className="hidden items-center gap-1 lg:flex">
        {items.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => scrollTopIfActive(active)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full px-4 text-[1rem] whitespace-nowrap transition-all duration-300',
                active ? 'bg-ink text-white shadow-nav-active' : 'text-ink/75 hover:bg-blush hover:text-magnolia',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <Sheet>
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label="打开菜单"
              className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-white text-ink lg:hidden"
            >
              <Menu className="size-5" />
            </button>
          }
        />
        <SheetContent side="left" className="w-[82%] max-w-sm p-0">
          <SheetHeader className="pr-14">
            <SheetTitle className="font-display text-ink">{brand.wordmark}</SheetTitle>
            <SheetDescription className="sr-only">导航</SheetDescription>
          </SheetHeader>
          <nav aria-label="主导航" className="px-3">
            <ul className="space-y-1">
              {items.map((item) => {
                const active = isActive(item.href)
                const Icon = ICONS[item.icon ?? ''] ?? Sprout
                return (
                  <li key={item.href}>
                    <SheetClose
                      nativeButton={false}
                      render={
                        <Link
                          href={item.href}
                          onClick={() => scrollTopIfActive(active)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-12 items-center gap-3 rounded-full px-4 text-[1.0625rem] transition-colors',
                            active ? 'bg-ink text-white' : 'text-ink hover:bg-blush hover:text-magnolia',
                          )}
                        />
                      }
                    >
                      <Icon aria-hidden className="size-5" />
                      {item.label}
                    </SheetClose>
                  </li>
                )
              })}
              <li>
                <SheetClose
                  nativeButton={false}
                  render={
                    <Link
                      href={site.nav.contact.href}
                      className="mt-3 flex min-h-12 items-center justify-center rounded-full bg-magnolia px-4 text-[1.0625rem] font-medium text-white"
                    />
                  }
                >
                  {site.nav.contact.label}
                </SheetClose>
              </li>
              {workspace ? (
                <li>
                  <span aria-hidden className="mt-3 block h-px w-full bg-rule" />
                  <a
                    href={workspace.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={workspace.title}
                    className="mt-3 flex min-h-12 items-center gap-3 rounded-full px-4 text-[1.0625rem] text-ink/75 transition-colors hover:bg-blush hover:text-magnolia"
                  >
                    <Briefcase aria-hidden className="size-5" />
                    {workspace.label}
                    <ArrowUpRight aria-hidden className="ml-auto size-4" />
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
