import type { Where } from 'payload'

import { getClient } from './payload'
import { isProjectTeam } from './auth'
import type { CurrentUser } from './auth'

/** Payload 生成的集合 slug 联合类型 */
export type CollectionSlug = 'users' | 'media' | 'invitation-links' | 'cohorts' | 'activity-plans' | 'activity-reports' | 'reimbursements' | 'payments' | 'resources' | 'publications' | 'finance-evidence'

/**
 * 工作台数据读取：显式带上当前用户并关闭 overrideAccess，
 * 让集合层的访问控制真正生效（普通成员看不到别团的方案与报销）。
 */
export const findForUser = async <T = any>(
  user: CurrentUser,
  collection: CollectionSlug,
  where: Where = {},
  extra: Record<string, unknown> = {},
): Promise<T[]> => {
  if (!user) return []
  const payload = await getClient()
  const res = await payload.find({
    collection: collection as any,
    where,
    user: user as any,
    overrideAccess: false,
    depth: 1,
    limit: 200,
    sort: '-createdAt',
    ...(extra as any),
  })
  return (res.docs ?? []) as unknown as T[]
}

// 金额格式化是纯函数，定义在 lib/format.ts（客户端组件不能从这个文件导入，会拖入 Payload）
export { yuan } from './format'

/**
 * 我担任团长的互助团：**一个团只有一个团长**。
 *
 * 团长只能为自己那个团提交方案与报销，项目组可见全部。
 * （公开页能看到所有公开互助团，但工作台的提交表单只能选自己那一支。）
 */
export const findOwnCohorts = async (user: CurrentUser): Promise<{ id: number; name: string }[]> => {
  if (isProjectTeam(user)) {
    const all = await findForUser<{ id: number; name: string }>(user, 'cohorts', {})
    return all.map((c) => ({ id: Number(c.id), name: c.name }))
  }

  const payload = await getClient()
  const res = await payload.find({
    collection: 'cohorts',
    where: { leader: { equals: user.id } },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs ?? []).map((doc: any) => ({ id: Number(doc.id), name: doc.name }))
}

/**
 * 内部数据的按团过滤条件：**团长只看得到自己那个团**，项目组看全部。
 *
 * ⚠️ 为什么不在页面里手写 `where`：
 * Payload 的**本地 API**（`payload.find({ overrideAccess: false })`）并不会真的按集合
 * access 拦查询（REST 走 403，本地调用照样返回数据），
 * 所以按团隔离必须显式写进查询条件里。
 */
export const ownCohortWhere = async (user: CurrentUser): Promise<Where> => {
  if (isProjectTeam(user)) return {}
  const ids = (await findOwnCohorts(user)).map((c) => c.id)
  // 没有带团时返回「什么都匹配不到」的条件——空的 in 列表在有的适配器里会被当成不限
  if (!ids.length) return { cohort: { equals: -1 } }
  return { cohort: { in: ids } }
}

/** 我担任团长的那个互助团（一个团只有一个团长） */
export const findMyCircle = async (
  user: CurrentUser,
): Promise<{
  id: number
  slug?: string
  name: string
  region?: string
  theme?: string
  description?: string
  category?: string
  leader?: { id: number; name: string; email?: string; phone?: string }
} | null> => {
  const payload = await getClient()

  const res = await payload.find({
    collection: 'cohorts',
    where: { leader: { equals: user.id } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })

  const cohort = (res.docs ?? [])[0] as any
  if (!cohort?.id) return null

  const leader =
    typeof cohort.leader === 'object' && cohort.leader
      ? {
          id: cohort.leader.id,
          name: cohort.leader.name ?? '',
          email: cohort.leader.email ?? '',
          phone: cohort.leader.phone ?? '',
        }
      : undefined

  return {
    id: cohort.id,
    slug: cohort.slug,
    name: cohort.name,
    region: cohort.region,
    theme: cohort.theme,
    description: cohort.description,
    category: cohort.category,
    leader,
  }
}
