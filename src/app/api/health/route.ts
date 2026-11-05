import { NextResponse } from 'next/server'

import { getClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

/**
 * 健康检查（给 Docker healthcheck / 负载均衡 / 监控用）：应用起来了、数据库连得上，才算健康。
 * 只回 ok / 失败，不带任何版本、表名、连接串之类的内部信息。
 */
export async function GET() {
  try {
    const payload = await getClient()
    await (payload.db as any).pool.query('select 1')
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
