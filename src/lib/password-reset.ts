import { maskEmail } from '@/lib/format'
import { getClient } from '@/lib/payload'

/**
 * 密码重置链接的状态（**服务端查**，首屏就是最终状态，
 * 不会先闪一下表单再变成"链接已失效"）。
 */
type PasswordResetStatus = 'ok' | 'missing' | 'used' | 'expired'

interface PasswordResetInfo {
  status: PasswordResetStatus
  /** 账号邮箱（只显示一部分，避免链接流出去就把邮箱也带出去） */
  emailHint?: string
}

/**
 * 查一条重置链接还能不能用。
 *
 * 链接本身就是凭证，所以查得越少越好：这里只回「能不能用」和一个邮箱提示，
 * 不回 token 之外的东西。
 */
export async function lookupPasswordReset(token: string): Promise<PasswordResetInfo> {
  if (!token) return { status: 'missing' }
  try {
    const payload = await getClient()
    const res = await payload.find({
      collection: 'password-resets',
      where: { token: { equals: token } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    const record: any = res.docs?.[0]
    if (!record) return { status: 'missing' }
    if (record.usedAt) return { status: 'used' }
    if (new Date(record.expiresAt).getTime() < Date.now()) return { status: 'expired' }
    const email = typeof record.user === 'object' && record.user ? record.user.email : undefined
    return {
      status: 'ok',
      emailHint: email ? maskEmail(email) : undefined,
    }
  } catch (err) {
    console.error('lookupPasswordReset failed', err)
    return { status: 'missing' }
  }
}


