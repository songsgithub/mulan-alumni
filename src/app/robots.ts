import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

import { hostnameOf, isCmsHost, isWorkspaceHost } from '@/lib/host'

/**
 * 公众站只暴露展示内容；工作台域与 CMS 域整站不让搜索引擎收录。
 * 工作台页面在公众域本来就不存在（proxy 一律 404），这里只屏蔽接口与后台。
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const host = hostnameOf((await headers()).get('host'))
  if (isWorkspaceHost(host) || isCmsHost(host)) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin'] }],
    sitemap: `${base}/sitemap.xml`,
  }
}
