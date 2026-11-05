'use server'

import { headers } from 'next/headers'

import { withLock } from '@/lib/lock'
import { getClient } from '@/lib/payload'
import { clientIp, hit } from '@/lib/rate-limit'

type ActionResult = { ok: boolean; message?: string }

/**
 * 凭重置链接设新密码（**不需要登录**）。
 *
 * 链接本身就是凭证：token 对得上、没过期、没被用过，才让改。
 * 改完立刻作废（`usedAt`），同一条链接不能改第二次。
 *
 * 密码规则与注册时一致（至少 8 位、字母 + 数字、最多 72 位）。
 */
export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const token = String(formData.get('token') ?? '').trim()
  // 不需要登录的入口：按 IP 限流，同一条链接的两次并发提交排队（防一条链接被用两次）
  const ip = clientIp(await headers())
  if (!hit(ip, { name: 'reset-password', limit: 10, windowMs: 10 * 60_000 }).ok) {
    return { ok: false, message: '操作太频繁，请稍后再试' }
  }
  return withLock(`reset:${token}`, () => resetPasswordImpl(formData, token))
}

async function resetPasswordImpl(formData: FormData, token: string): Promise<ActionResult> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (!token) return { ok: false, message: '链接不完整，请找项目组重新发一条' }
  if (password.length < 8) return { ok: false, message: '密码至少 8 位' }
  if (password.length > 72) return { ok: false, message: '密码最多 72 位' }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { ok: false, message: '密码要同时包含字母和数字' }
  }
  if (password !== confirm) return { ok: false, message: '两次输入的密码不一样' }

  const payload = await getClient()
  try {
    const res = await payload.find({
      collection: 'password-resets',
      where: { token: { equals: token } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const record: any = res.docs?.[0]
    if (!record) return { ok: false, message: '链接不存在或已失效，请找项目组重新发一条' }
    if (record.usedAt) {
      return { ok: false, message: '这条链接已经用过了，请找项目组重新发一条' }
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      return { ok: false, message: '链接已过期，请找项目组重新发一条' }
    }

    const userId =
      typeof record.user === 'object' && record.user ? record.user.id : record.user
    await payload.update({
      collection: 'users',
      id: userId,
      // 清空现有会话：改完密码，别人手里旧的登录态一并失效
      data: { password, sessions: [] } as never,
      overrideAccess: true,
    })

    // 用过即失效
    await payload.update({
      collection: 'password-resets',
      id: record.id,
      data: { usedAt: new Date().toISOString() },
      overrideAccess: true,
    })

    // 顺带把「连错多次」的锁定解开：忘了密码的人往往已经试到被锁了
    try {
      await (payload as any).unlock?.({ collection: 'users', id: userId })
    } catch {
      // 解锁失败不影响改密码本身
    }

    return { ok: true, message: '密码已改好，现在可以用新密码登录了' }
  } catch (err) {
    console.error('resetPassword failed', err)
    return { ok: false, message: '重置失败，请找项目组帮忙' }
  }
}
