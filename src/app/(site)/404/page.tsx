import { NotFoundContent } from '@/components/site/NotFoundContent'

/**
 * proxy 把公众域的管理路径重写到这里，状态码仍然是 404。
 *
 * 为什么要单独一页：管理路径不能"存在但拒绝"（会暴露路径），
 * 也不能给一段英文裸文本（访客看到的是死胡同）。
 * 重写 + 404 状态码 = 路径不存在，页面却是中文的、还给得出路。
 */
export const metadata = {
  title: '页面不存在',
}

export default function NotFoundRoute() {
  return <NotFoundContent />
}
