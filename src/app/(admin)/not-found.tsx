import { NotFoundContent } from '@/components/site/NotFoundContent'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteHeader } from '@/components/site/SiteHeader'

/**
 * 工作台路由在**非工作台域**被访问（布局里 `notFound()`）时的 404。
 *
 * 这种情况访客是在公众域上，所以给公众站的页头页尾与中文 404 正文，
 * 不出现任何登录入口（docs/设计规范.md §0.1）。工作台域里的 404 见 (workspace)/not-found.tsx。
 */
export const metadata = {
  title: '页面不存在',
}

export default function AdminNotFound() {
  return (
    <>
      <SiteHeader />
      <main>
        <NotFoundContent />
      </main>
      <SiteFooter />
    </>
  )
}
