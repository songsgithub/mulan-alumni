import { formatPlace } from '@/lib/format'
import { getClient } from '@/lib/payload'

/**
 * 按 token 查一条**邀请链接**（服务端专用）。
 *
 * 规则只有一条：**过期即自动失效**。
 * 不存在 / 已撤销 / 已使用 / 已过期 —— 对外**一律同一句话**：
 * 「链接不存在或已失效」，不解释是哪一种。
 *
 * 页面（首屏渲染）与注册接口都走这里，规则只写一遍。
 */

export interface InviteInfo {
  purpose: 'create-cohort' | 'transfer-lead'
  email: string | null
  cohortName: string | null
  cohortCategory: string | null
  cohortPlace: string | null
  cohortCreatedAt: string | null
  expiresAt: string | null
}

export const INVITE_INVALID_MESSAGE = '链接不存在或已失效'

/** 有效期：自创建起 7×24 小时 */
export const INVITE_VALID_MS = 7 * 24 * 60 * 60 * 1000

export const lookupInvitation = async (
  token: string,
): Promise<{ ok: true; data: InviteInfo } | { ok: false }> => {
  if (!/^[A-Za-z0-9-]{4,32}$/.test(token)) return { ok: false }

  const payload = await getClient()
  const links = await payload.find({
    collection: 'invitation-links',
    where: { token: { equals: token } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const link = links.docs[0] as any
  if (!link) return { ok: false }
  if (link.status === 'revoked' || link.status === 'used') return { ok: false }

  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
    // 过期即失效：顺手把状态改成"已过期"，让后台看到的是真的
    await payload.update({
      collection: 'invitation-links',
      id: link.id,
      data: { status: 'expired' },
      overrideAccess: true,
    })
    return { ok: false }
  }

  const cohort = link.cohort as any
  return {
    ok: true,
    data: {
      purpose: link.purpose,
      email: link.email ?? null,
      cohortName: cohort?.name ?? null,
      cohortCategory: cohort?.category ?? null,
      cohortPlace: cohort?.location
        ? formatPlace(cohort.location.province, cohort.location.city, cohort.location.district)
        : (cohort?.region ?? null),
      cohortCreatedAt: cohort?.createdAt ?? null,
      expiresAt: link.expiresAt ?? null,
    },
  }
}
