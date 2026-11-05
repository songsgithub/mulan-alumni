import fs from 'node:fs/promises'
import path from 'node:path'

import { NextResponse } from 'next/server'

import { clientIp, hit } from '@/lib/rate-limit'

/**
 * 地图边界数据代理。
 *
 * - 优先读本地缓存 `data/geo-cache/{adcode}.json`（预取脚本写在这里）；
 * - 没有就现拉 DataV.GeoAtlas 并落盘，下次直接命中；
 * - adcode 必须是 6 位数字（防目录穿越）。
 *
 * 只给工作台域用：公众站不展示地图。
 */
const CACHE_DIR = path.join(process.cwd(), 'data', 'geo-cache')
const SOURCE = 'https://geo.datav.aliyun.com/areas_v3/bound'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ adcode: string }> },
) {
  const { adcode } = await params

  if (!/^\d{6}$/.test(adcode)) {
    return NextResponse.json({ error: 'adcode 不合法' }, { status: 400 })
  }

  const file = path.join(CACHE_DIR, `${adcode}.json`)

  try {
    const cached = await fs.readFile(file, 'utf-8')
    return new NextResponse(cached, {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
    })
  } catch {
    // 没缓存 → 现拉
  }

  // 缓存没命中才会外拉 + 落盘：按 IP 限流，防有人遍历 adcode 刷流量、写满磁盘
  if (!hit(clientIp(request.headers), { name: 'geo-miss', limit: 40, windowMs: 10 * 60_000 }).ok) {
    return NextResponse.json({ error: '请求太频繁，请稍后再试' }, { status: 429 })
  }
  try {
    const res = await fetch(`${SOURCE}/${adcode}_full.json`, { next: { revalidate: 86400 } })
    if (!res.ok) {
      return NextResponse.json({ error: `地图数据不可用（HTTP ${res.status}）` }, { status: 502 })
    }
    const text = await res.text()
    // 只缓存真正的 GeoJSON：上游偶尔会回 200 的错误页 / 超大响应，落盘后就永远是坏的
    let parsed: { type?: string } | null = null
    try {
      parsed = text.length <= 20 * 1024 * 1024 ? JSON.parse(text) : null
    } catch {
      parsed = null
    }
    if (!parsed || parsed.type !== 'FeatureCollection') {
      return NextResponse.json({ error: '地图数据不可用' }, { status: 502 })
    }

    await fs.mkdir(CACHE_DIR, { recursive: true })
    const tmp = `${file}.tmp`
    await fs.writeFile(tmp, text, 'utf-8')
    await fs.rename(tmp, file)

    return new NextResponse(text, {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (err) {
    console.error('拉取地图数据失败', adcode, err)
    return NextResponse.json({ error: '地图数据拉取失败' }, { status: 502 })
  }
}
