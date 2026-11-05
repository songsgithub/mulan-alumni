import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

import { getClient } from './payload'
import type { Role } from '@/access'

export interface CurrentUser {
  id: number | string
  name?: string
  email?: string
  roles: Role[]
  /**
   * 固定是 users。
   * ⚠️ 不能省：集合的访问控制靠 user.collection 区分业务账号与后台账号
   * （Notifications 的 update 规则还要求它等于 users，不带上就会「未读标不掉」）。
   */
  collection: 'users'
}

/** 取当前登录用户（服务端组件用） */
export const currentUser = async (): Promise<CurrentUser | null> => {
  try {
    const payload = await getClient()
    const headers = await nextHeaders()
    const result = await payload.auth({ headers })
    const user = result?.user as any
    if (!user) return null
    // 停用账号即使还握着旧会话也当未登录处理；后台账号（ops-users）不是业务账号
    if (user.status === 'disabled') return null
    if (user.collection && user.collection !== 'users') return null
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: (user.roles ?? []) as Role[],
      collection: 'users',
    }
  } catch {
    return null
  }
}

/**
 * 工作台页面取当前用户：**没有登录态就直接去登录页**。
 *
 * ⚠️ 为什么不能写 `const user = (await currentUser())!`：
 * Next.js 的 layout 与 page 是**并行渲染**的——layout 里的 `redirect('/login')`
 * 拦不住 page 自己解引用 `user.id`，会话失效时页面会直接抛
 * "Cannot read properties of null (reading 'id')"，变成 500。
 * （比如验收脚本删掉了这个账号，浏览器还带着旧 cookie。）
 */
export const requireUser = async (): Promise<CurrentUser> => {
  const user = await currentUser()
  if (!user) redirect('/login')
  return user
}

export const isProjectTeam = (user: CurrentUser | null) =>
  Boolean(user?.roles?.includes('projectTeam'))

export const isCohortLead = (user: CurrentUser | null) =>
  Boolean(user?.roles?.includes('cohortLead'))
