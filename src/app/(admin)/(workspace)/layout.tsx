import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, Bell } from 'lucide-react'

import { SkipLink } from '@/components/SkipLink'
import { currentUser, isCohortLead, isProjectTeam } from '@/lib/auth'
import { isWorkspaceHost } from '@/lib/host'
import { publicSiteUrl } from '@/lib/site-url'
import { getClient } from '@/lib/payload'
import { BrandMark } from '@/components/console/BrandMark'
import { NotificationBell } from '@/components/console/NotificationBell'
import { WorkspaceNav } from '@/components/console/WorkspaceNav'
import { WorkspaceMenu } from '@/components/console/WorkspaceMenu'

// 工作台依赖登录态，不能被静态预渲染
export const dynamic = 'force-dynamic'

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // 不在工作台域 → 这个页面在这里不存在（中文 404），不是"未登录请去登录"
  const host = (await headers()).get('host')
  if (!isWorkspaceHost(host)) notFound()

  const user = await currentUser()
  if (!user) redirect('/login')

  const projectTeam = isProjectTeam(user)
  const lead = isCohortLead(user)

  // 通知：本人最近 10 条（右上角铃铛）
  const noticeClient = await getClient()
  const noticeQuery = await noticeClient
    .find({
      collection: 'notifications',
      where: { recipient: { equals: user.id } },
      limit: 10,
      sort: '-createdAt',
      depth: 0,
      user: user as any,
      overrideAccess: false,
    })
    .catch(() => ({ docs: [] }))
  const notices = (noticeQuery.docs ?? []).map((doc: any) => ({
    id: String(doc.id),
    title: doc.title,
    link: doc.link,
    read: Boolean(doc.read),
    createdAt: doc.createdAt,
  }))

  /**
   * 未读**总数**：铃铛角标要显示真实未读数，不能拿弹层里那 10 条的未读数顶上。
   * 未读超过 10 条时，角标会少显示——看着像"没有更多未读了"。
   */
  const noticeUnread = await noticeClient
    .count({
      collection: 'notifications',
      where: { and: [{ recipient: { equals: user.id } }, { read: { equals: false } }] },
      user: user as any,
      overrideAccess: false,
    })
    .catch(() => ({ totalDocs: 0 }))

  /**
   * 导航：**活动 / 互助团 / 经费 / 资源 / 设置**。
   *
   * 活动 = 工作台首屏（点左上角 logo 也是这里）：待办、统计、筛选与活动清单在同一页。
   *
   * 活动 = 一次从方案到发布的完整记录（方案 → 审批 → 反馈 → 报销 → 发布），
   * 每个环节都在活动详情页里，不再按数据表摊成一堆 tab
   * （见 docs/设计规范.md §4.5）。
   *
   * 「资源」是**项目组独占**的：上传与管理都在工作台做，团长与成员只去公众站看。
   * 所以导航项按角色给——不是"显示出来再禁用"，是根本不出现。
   *
   * `match` 是判定"当前在哪"用的路径前缀：互助团那几条的内部真实路径是
   * /network（proxy rewrite，URL 保持 /circles），两个都要匹配；
   * 活动页的真实路径是 /home（浏览器里的地址是 /），两个都匹配；活动详情 /activities 也算在这一项。
   */
  const nav = [
    { href: '/', label: '活动', icon: 'activities', match: ['/', '/home', '/activities'] },
    { href: '/circles', label: '互助团', icon: 'circles', match: ['/circles', '/network'] },
    // 经费：项目组看全部互助团，团长只看自己那个团——所以两项身份都看得到这一项
    { href: '/budget', label: '经费', icon: 'budget', match: ['/budget'] },
    ...(projectTeam
      ? [
          { href: '/resources', label: '资源', icon: 'assets', match: ['/resources', '/assets'] },
          { href: '/settings', label: '设置', icon: 'settings', match: ['/settings'] },
        ]
      : []),
  ]

  // 业务账号只有两种身份（见 AGENTS.md §6）；没有带团的账号也按团长显示
  const roleLabel = projectTeam ? '项目组' : '团长'

  return (
    <div className="min-h-dvh console-page">
      <SkipLink />
      {/* 顶栏：**桌面（≥1024px）一行 64px 常驻吸顶**；再窄一律走左侧抽屉。
          为什么不是 768px：768–1023px 之间，logo + 四个导航 + 公开站/退出
          合计约 750px，挤不进 704px 的内容宽（实测会挤爆）。
          窄屏顶栏只留 logo（短名）+ 汉堡按钮。 */}
      <header className="sticky top-0 z-40 border-b border-rule/70 bg-bg/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="container-page flex h-14 items-center gap-x-4 lg:h-[var(--workspace-header-h)] lg:gap-x-3 xl:gap-x-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 min-w-0 items-center gap-2.5 truncate font-display text-label leading-none font-semibold lg:text-brand-name lg:leading-none"
            >
              {/* 整条组合标（记号 +「数字木兰校友会」）。顶栏只写「工作台」——
                  标识本身已经带了站名，后面不再挂「校友会」。
                  尺寸：桌面 36px（组合标宽 267px，和导航一个量级、不压过导航），
                  1024–1279px 那段用 32px；<640px 用 24px。 */}
              <BrandMark size={20} className="sm:hidden" />
              <BrandMark size={30} className="hidden sm:inline-flex" />
              {/* 手机上横排放不下（组合标 207px + 「工作台」+ 铃铛 + 菜单），
                  所以窄屏只留标识，「工作台」两个字在抽屉标题里有。 */}
              <span className="hidden sm:inline">工作台</span>
            </Link>
          </div>

          <WorkspaceNav items={nav} className="hidden lg:flex" />

          {/* 桌面右上角：公开站 / 通知 / 当前用户 / 退出 */}
          <div className="ml-auto hidden items-center gap-1.5 text-small text-muted lg:flex">
            <a
              href={publicSiteUrl() || '/'}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-medium text-muted transition-all duration-300 hover:bg-accent-soft hover:text-accent"
            >
              公开站
              <ArrowUpRight aria-hidden className="size-4 shrink-0" />
            </a>
            <NotificationBell records={notices} unreadCount={noticeUnread.totalDocs ?? 0} />
            <Link
              href="/account"
              title="个人信息"
              className="inline-flex min-h-11 items-center rounded-full px-3 font-medium text-fg transition-all duration-300 hover:bg-accent-soft hover:text-accent"
            >
              {user.name ?? user.email}
            </Link>
            <Link
              href="/logout"
              className="inline-flex min-h-11 items-center rounded-full px-3 font-medium text-muted transition-all duration-300 hover:bg-accent-soft hover:text-accent"
            >
              退出
            </Link>
          </div>

          {/* 窄屏：通知（直接进通知页，带未读数）+ 汉堡抽屉。
              以前窄屏没有铃铛，手机上看不到有没有新通知。 */}
          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <Link
              href="/notifications"
              aria-label={noticeUnread.totalDocs ? `通知，${noticeUnread.totalDocs} 条未读` : '通知'}
              className="relative inline-flex size-11 items-center justify-center rounded-full text-fg transition-colors hover:bg-console-accent"
            >
              <Bell aria-hidden className="size-5" />
              {noticeUnread.totalDocs ? (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1 text-label leading-none font-bold text-white tabular-nums ring-2 ring-white"
                >
                  {noticeUnread.totalDocs > 99 ? '99+' : noticeUnread.totalDocs}
                </span>
              ) : null}
            </Link>
            <WorkspaceMenu
              items={nav}
              roleLabel={roleLabel}
              userName={user.name ?? user.email ?? ''}
              publicHref={publicSiteUrl() || '/'}
              accountHref="/account"
            />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="container-page py-5 outline-none md:py-8 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500">{children}</main>
    </div>
  )
}
