import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { isWorkspaceHost } from '@/lib/host'

/**
 * 登录 / 邀请注册页的外壳。
 *
 * 这两个页面**只存在于工作台域**：别的域访问直接中文 404（见 docs/设计规范.md §0.1 铁律）。
 * 不套工作台导航——未登录时导航里的"退出"没有意义。
 */
export const dynamic = 'force-dynamic'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const host = (await headers()).get('host')
  if (!isWorkspaceHost(host)) notFound()
  return <>{children}</>
}
