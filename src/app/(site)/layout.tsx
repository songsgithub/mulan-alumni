import { RootDocument, rootMetadata } from '@/components/RootDocument'
import { SkipLink } from '@/components/SkipLink'
import { BackTop } from '@/components/site/BackTop'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteHeader } from '@/components/site/SiteHeader'

export const metadata = rootMetadata

/**
 * 公开站根布局：复刻朋友平台 muse 的外壳（暖白点阵底 + 顶栏 + 蓝色页脚）。
 * 页头页脚不含任何登录 / 注册入口。
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootDocument>
      <div className="muse-page flex min-h-dvh flex-col">
        <SkipLink />
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
        <BackTop />
      </div>
    </RootDocument>
  )
}
