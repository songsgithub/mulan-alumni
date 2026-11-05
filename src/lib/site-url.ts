/**
 * 公开站地址。
 *
 * 管理域与公众域是两个域名：管理域里想跳到公开站，必须用绝对地址，
 * 否则在 admin.localhost 上点 `/` 会被重定向回工作台。
 * 站点地址来自 NEXT_PUBLIC_SERVER_URL（见 .env.example）。
 */
export const publicSiteUrl = (): string => (process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/+$/, '')

/** 公开站某场活动的地址（与工作台活动详情同一个地址标识） */
export const publicActivityUrl = (slug: string): string => `${publicSiteUrl()}/activities/${slug}`

/** 公开站某个互助团主页的地址 */
export const publicCircleUrl = (slug: string): string => `${publicSiteUrl()}/circles/${slug}`

/**
 * 工作台域绝对地址。
 *
 * 密码重置链接要发给团长本人（微信 / 电话），必须是他能打开的完整地址——
 * 相对路径在微信里点开会变成「相对当前页面」的路径。
 * 地址来自 WORKSPACE_HOST（本地 connect.localhost）。
 */
export const workspaceSiteUrl = (): string => {
  const host = (process.env.WORKSPACE_HOST ?? 'connect.localhost').split(',')[0].trim()
  // 协议与端口跟公开站一致（生产是 https://www.xxx → https://connect.xxx）；
  // 不从请求头取主机——Host / X-Forwarded-Host 是客户端能伪造的
  try {
    const base = new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000')
    base.hostname = host
    return base.origin
  } catch {
    const port = process.env.PORT ? `:${process.env.PORT}` : ''
    return `http://${host}${port}`
  }
}
