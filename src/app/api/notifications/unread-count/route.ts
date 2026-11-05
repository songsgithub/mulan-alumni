import { NextResponse } from 'next/server'

import { currentUser } from '@/lib/auth'
import { getClient } from '@/lib/payload'
import { hit } from '@/lib/rate-limit'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * 工作台铃铛的未读数（轻量轮询用）。
 *
 * 只做一次计数、只返回一个数字，不带通知内容；列表仍由页面渲染时带出。
 * 按登录人计数，并且走集合的读取权限（只能数自己的通知）。
 */
export async function GET() {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录' }, { status: 401, headers: NO_STORE })
  }
  // 铃铛按分钟级轮询：每账号每分钟 30 次足够，再多就是在刷接口
  if (!hit(`user:${user.id}`, { name: 'unread-count', limit: 30, windowMs: 60_000 }).ok) {
    return NextResponse.json({ message: '请求太频繁' }, { status: 429, headers: NO_STORE })
  }
  const payload = await getClient()
  const { totalDocs } = await payload.count({
    collection: 'notifications',
    where: { and: [{ recipient: { equals: user.id } }, { read: { equals: false } }] },
    user: user as any,
    overrideAccess: false,
  })
  return NextResponse.json({ count: totalDocs }, { headers: NO_STORE })
}
