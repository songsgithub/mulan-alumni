import { NotFoundContent } from '@/components/site/NotFoundContent'

/** 公众站页面里 `notFound()`（成果 / 互助团 / 资源不存在）：页头页脚由 (site) 布局给 */
export const metadata = {
  title: '页面不存在',
}

export default function SiteNotFound() {
  return <NotFoundContent />
}
