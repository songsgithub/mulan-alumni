import type { MetadataRoute } from 'next'

import { getCircles, getLibrary, getOutcomes } from '@/lib/public-data'

// 按请求生成（否则构建时定死，新发布的活动进不了站点地图；构建机也不一定连得上数据库）
export const dynamic = 'force-dynamic'

/**
 * 公众站站点地图：成果、互助团、资料库、关于。
 * 管理端路径不进站点地图。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const [outcomes, library, circles] = await Promise.all([
    getOutcomes(200),
    getLibrary(200),
    getCircles(24),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/activities`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/circles`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/resources`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.4 },
  ]

  const outcomeRoutes: MetadataRoute.Sitemap = outcomes.map((outcome) => ({
    url: `${base}/activities/${outcome.slug}`,
    lastModified: outcome.date ? new Date(outcome.date) : undefined,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const libraryRoutes: MetadataRoute.Sitemap = library.map((item) => ({
    url: `${base}/resources/${item.slug}`,
    lastModified: item.publishedAt ? new Date(item.publishedAt) : undefined,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  const circleRoutes: MetadataRoute.Sitemap = circles.map((circle) => ({
    url: `${base}/circles/${circle.slug}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [...staticRoutes, ...outcomeRoutes, ...circleRoutes, ...libraryRoutes]
}
