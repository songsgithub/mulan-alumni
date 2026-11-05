import type { Access, Where } from 'payload'

/**
 * 业务角色只有两种：**团长**（发起与维护活动）与**项目组**（审批、核定、发布）。
 * 运营账号（`ops-users`）不在这套体系里——它是 CMS 后台的账号，不是业务角色。
 *
 * ⚠️ 内部业务数据的**写入**一律走服务端动作（actions.ts），集合 REST 写入只给 `opsOnly`；
 * 这里只剩读取口径与少量判定函数，不要再往回加"团长可写"之类的集合级写权限。
 */
export type Role = 'cohortLead' | 'projectTeam'

interface SessionUser {
  id: number | string
  roles?: Role[]
  collection?: string
}

/**
 * 停用的业务账号：登录被 beforeLogin 拦下，但**已经签发的会话**仍会带着 token 访问 REST。
 * 所以访问控制里一律把停用账号当成"没有任何角色、不属于任何团"。
 */
const isDisabled = (user: unknown): boolean =>
  Boolean(user && typeof user === 'object' && (user as { status?: string }).status === 'disabled')

/** 已登录且未停用 */
const isActiveUser = (user: unknown): boolean => Boolean(user) && !isDisabled(user)

/** 取用户角色列表（Payload 用户集合上自定义 roles 字段）；停用账号没有角色 */
const userRoles = (user: unknown): Role[] => {
  if (!user || typeof user !== 'object') return []
  if (isDisabled(user)) return []
  const roles = (user as SessionUser).roles
  return Array.isArray(roles) ? (roles as Role[]) : []
}

const hasRole = (user: unknown, role: Role): boolean => userRoles(user).includes(role)

/** 项目组：治理层，拥有审批 / 报销 / 付款 / 发布权限 */
export const isProjectTeam = (user: unknown): boolean => hasRole(user, 'projectTeam')

/**
 * 后台账号（`ops-users` 集合）：Payload CMS 后台的唯一登录源。
 *
 * Payload 会在登录后的 user 对象上带上 `collection`，据此即可判定身份。
 * 后台账号**不是**业务账号：进不了工作台，只在 CMS 域里作为全局管理员存在。
 */
export const isOps = (user: unknown): boolean => {
  if (!user || typeof user !== 'object') return false
  const collection = (user as { collection?: string }).collection
  return collection === 'ops-users'
}

/**
 * 管理权限：项目组 **或** 后台账号。
 *
 * 用于集合级与字段级的"管理类"判定（可见全部、可写全部）。
 * 业务语义（谁能发起活动、谁是团长）仍然只看业务角色，不看后台账号。
 */
export const isManager = (user: unknown): boolean => isProjectTeam(user) || isOps(user)

/** 团长：可提交活动方案、组织实施、提交报销 */
export const isCohortLead = (user: unknown): boolean => hasRole(user, 'cohortLead')

/**
 * 取该用户**担任团长**的互助团 ID（一个团只有一个团长）。
 *
 * 用来按团隔离内部数据：团长只看得到、只改得动自己那个团。
 */
export const cohortIdsOf = async (user: unknown, req: any): Promise<(number | string)[]> => {
  if (!user || isDisabled(user)) return []
  const uid = (user as SessionUser).id
  if (!uid) return []
  try {
    const res = await req.payload.find({
      collection: 'cohorts',
      where: { leader: { equals: uid } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    return (res.docs ?? []).map((doc: any) => doc.id).filter(Boolean)
  } catch {
    return []
  }
}

/** 登录用户可读：项目组看全部，团长看自己团的 */
export const internalRead: Access = async (args) => {
  const { user } = args.req
  if (!user) return false
  if (isManager(user)) return true
  const ids = await cohortIdsOf(user, args.req)
  if (!ids.length) return false
  return { cohort: { in: ids } }
}

/**
 * 活动方案读取：与 `internalRead` 同口径，但**项目组看不到团长还没提交的草稿**——
 * 工作台页面本来就不给项目组看草稿（统计也不计入），REST 读取与页面保持一致。
 * 后台账号（CMS 运维）仍可见全部，用来修数据。
 */
export const planRead: Access = async (args) => {
  const { user } = args.req
  if (!user) return false
  if (isOps(user)) return true
  if (isProjectTeam(user)) {
    const submitted: Where = { status: { not_equals: 'draft' } }
    return submitted
  }
  const ids = await cohortIdsOf(user, args.req)
  if (!ids.length) return false
  const own: Where = { cohort: { in: ids } }
  return own
}

/**
 * 仅后台账号（CMS 运维）。
 *
 * **内部业务数据的 REST / GraphQL 写入一律只给后台账号**：
 * 工作台的每一次写入都走服务端动作（`actions.ts`），那里逐条校验角色、归属与状态机；
 * 而 Payload 的 `/api/<集合>/<id>` 是另一条口子——团长直接 PATCH 就能绕过全部校验
 * （比如把自己的方案改成「已通过」、改别团的报销金额），项目组也能绕过「指定审核人」。
 * 关掉这条口子，服务端动作（本地 API，默认不走集合访问控制）不受影响。
 */
export const opsOnly: Access = ({ req: { user } }) => isOps(user)

/** 项目组、后台账号，或本人 */
export const selfOrProjectTeam: Access = ({ req: { user } }) => {
  if (!isActiveUser(user)) return false
  if (isManager(user)) return true
  return { id: { equals: (user as SessionUser).id } }
}

/**
 * 互助团读取：公开可见的团（isPublic 且在运行中）+ 自己所在的团。
 * 项目组看全部。
 */
export const cohortsRead: Access = async (args) => {
  const { user } = args.req
  if (isManager(user)) return true
  // 未登录（或账号已停用）：只看公众站展示的团
  if (!isActiveUser(user)) {
    const publicClause: Where = {
      and: [{ isPublic: { equals: true } }, { status: { equals: 'active' } }],
    }
    return publicClause
  }
  // 已登录：全部在运转的团都可见——工作台的"互助团网络"要给完整的一张图，
  // 团名与所在地不是敏感信息；`isPublic` 只决定**公众站**是否展示。
  const allRunning: Where = { status: { in: ['active', 'closed'] } }
  return allRunning
}

/**
 * 公开内容集合读取（学习资源 / 经验帖 / 合作机会）：
 * 未登录用户只看到公开部分，登录后可见全部。
 */
export const publicContentRead =
  (publicWhere: Where): Access =>
  ({ req: { user } }) => {
    if (isActiveUser(user)) return true
    return publicWhere
  }

/** 公开成果读取：只有管理者能看到未到发布时间的条目，团长与公众一样只看已发布的 */
export const publicationsRead: Access = ({ req: { user } }) => {
  if (isManager(user)) return true
  return { publishedAt: { less_than_equal: new Date().toISOString() } }
}
