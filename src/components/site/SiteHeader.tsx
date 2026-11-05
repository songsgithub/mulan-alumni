import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

import { SiteLogo } from '@/components/site/SiteLogo'
import { SiteNav } from '@/components/site/SiteNav'
import { site } from '@/content/site'
import { workspaceSiteUrl } from '@/lib/site-url'

/**
 * 公开站顶栏（muse 结构）：标识 + 两行站名 · 胶囊导航 · 联系我们 · | · 工作台。
 * 毛玻璃底，滚动时内容从下面柔和地透过去。
 *
 * 「工作台」是通往工作台域（另一个域名）的入口，所以必须用绝对地址；
 * 新标签打开，不打断公众站正在看的内容。
 */
export function SiteHeader() {
  const workspaceHref = `${workspaceSiteUrl()}/login`

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-[4.25rem] max-w-[1680px] items-center justify-between gap-4 px-5 sm:px-8 xl:px-12">
        <SiteLogo wordmark={site.brand.wordmark} />
        <div className="flex items-center gap-2">
          <SiteNav
            items={site.nav.items}
            brand={{ wordmark: site.brand.wordmark }}
            workspace={{ href: workspaceHref, label: site.nav.workspace.label, title: site.nav.workspace.title }}
          />
          {/* 与站名同款的竖线：把「工作台」（另一个域名）与公众站导航分开 */}
          <span aria-hidden className="hidden h-6 w-px shrink-0 bg-fg/15 lg:block" />

          <a
            href={workspaceHref}
            target="_blank"
            rel="noopener noreferrer"
            title={site.nav.workspace.title}
            className="hidden min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[1rem] text-ink/75 transition-all duration-300 hover:bg-blush hover:text-magnolia lg:inline-flex"
          >
            {site.nav.workspace.label}
            <ArrowUpRight aria-hidden className="size-4 shrink-0" />
          </a>

          <Link
            href={site.nav.contact.href}
            className="hidden min-h-11 items-center rounded-full bg-magnolia px-5 text-[1rem] font-medium text-white shadow-button-magnolia transition-all duration-300 hover:-translate-y-0.5 hover:bg-accent-strong lg:ml-3 lg:inline-flex"
          >
            {site.nav.contact.label}
          </Link>
        </div>
      </div>
    </header>
  )
}
