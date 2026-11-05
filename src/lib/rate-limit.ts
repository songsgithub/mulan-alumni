/**
 * 进程内的固定窗口限流（按「IP + 规则」计数）。
 *
 * 用在 proxy 里挡暴力破解与刷接口：登录、邀请注册、邀请链接查询、联系表单。
 * 账号层另有 Payload 的 maxLoginAttempts（连错 8 次锁 10 分钟），这里是 IP 层的第二道。
 *
 * ⚠️ 只在单进程内有效；多实例部署时请在反向代理（Nginx / 网关）上再配一层。
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
let lastSweep = 0

export interface RateRule {
  /** 规则名，参与计数键 */
  name: string
  /** 窗口内允许的次数 */
  limit: number
  /** 窗口长度（毫秒） */
  windowMs: number
}

interface RateResult {
  ok: boolean
  /** 距离窗口重置还有多少秒 */
  retryAfter: number
}

export function hit(key: string, rule: RateRule, now = Date.now()): RateResult {
  // 顺手清理过期桶，避免 Map 无限增长
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
    lastSweep = now
  }
  const id = `${rule.name}:${key}`
  const bucket = buckets.get(id)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + rule.windowMs })
    return { ok: true, retryAfter: 0 }
  }
  bucket.count += 1
  return {
    ok: bucket.count <= rule.limit,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  }
}

/**
 * 取客户端 IP。
 *
 * ⚠️ `X-Forwarded-For` 的**第一个**值是客户端自己能填的——每次换一个就能绕过限流。
 * 规则：
 * - 反向代理（Nginx）会写 `X-Real-IP`，优先信它；
 * - 否则取 `X-Forwarded-For` 的**倒数第 TRUSTED_PROXY_HOPS 个**（默认 1：最后一跳代理写入的那个）；
 * - 都没有就归为同一个桶（本地直连）。
 */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const trusted = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1)
    const pick = hops[Math.max(0, hops.length - trusted)]
    if (pick) return pick
  }
  return 'local'
}
