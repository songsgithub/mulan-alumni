import { RootDocument, rootMetadata } from '@/components/RootDocument'
import { NotFoundContent } from '@/components/site/NotFoundContent'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteHeader } from '@/components/site/SiteHeader'

/**
 * 全站 404（路径根本不存在时）。
 *
 * 应用有多个根布局（(site) / (admin) / (payload)），没有一个能包住"不存在的路径"，
 * 所以用 Next 的 `global-not-found`：它跳过布局，自己渲染 `<html>`。
 * 全站简体中文，不能出现英文 `Not Found` 裸文本，也不出现登录 / 注册入口。
 */
export const metadata = {
  ...rootMetadata,
  title: '页面不存在 · 数字木兰',
}

export default function GlobalNotFound() {
  return (
    <RootDocument>
      <div className="muse-page flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex-1">
          <NotFoundContent />
        </main>
        <SiteFooter />
      </div>
    </RootDocument>
  )
}
