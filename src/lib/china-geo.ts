import fs from 'node:fs'
import path from 'node:path'

/**
 * 中国省级行政区划（官方数据）。
 *
 * 来源：天地图开发者中心「行政区划可视化」下载的 GeoJSON，
 * 审图号 **GS (2026) 4921号**，数据更新时间 2026 年 10 月，用途为地图可视化。
 * 文件位置：data/geo-www/cn-provinces.geojson（**原样保存，一个点都不改**）。
 *
 * 官方预览页的样式规则（见其前端 `static/js/10.147c5646.js`）：
 *   默认：实线、weight 1、蓝色；
 *   只有 5 个 gb 编码用虚线（dashArray 5,5、weight 2）——
 *   156980000 用蓝虚线，其余（156970000 等）用**白虚线**（白线压掉省界实线，形成虚线效果）。
 *
 * ⚠️ 下载的 GeoJSON 把「境界线」的 gb 字段清空了（服务端接口里是有的），
 * 所以这里按「段数 + 点数」的几何签名把这两个特殊要素认回来：
 *   (7 段, 22 点)  = 156980000 深圳/香港之间
 *   (1 段, 312 点) = 156970000 新疆西端帕米尔
 */
export interface BoundaryLine {
  /** 线段坐标 [lng, lat][] */
  coords: [number, number][]
  /** null = 实线；'white' = 白虚线（未定国界）；'blue' = 蓝虚线 */
  dash: 'white' | 'blue' | null
}

interface ChinaGeo {
  /** 省级面（FeatureCollection，仅 MultiPolygon） */
  regions: { type: 'FeatureCollection'; features: any[] }
  /** 境界线（官方 31 段，全部保留、坐标原样） */
  boundaryLines: BoundaryLine[]
  /** 审图号 */
  approvalNumber: string
}

const FILE = path.join(process.cwd(), 'data', 'geo-www', 'cn-provinces.geojson')
const APPROVAL_NUMBER = 'GS (2026) 4921号'

let cache: ChinaGeo | null = null

/** 与官方接口对应的特殊编码（下载文件里没有 gb，用几何签名认） */
const SPECIAL: Record<string, 'white' | 'blue'> = {
  '7x22': 'blue', // 156980000 深圳/香港
  '1x312': 'white', // 156970000 新疆西端（未定国界）
}

export const getChinaGeo = (): ChinaGeo => {
  if (cache) return cache
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  const features: any[] = raw?.features ?? []
  const regions = {
    type: 'FeatureCollection' as const,
    features: features.filter((f) => f?.geometry?.type === 'MultiPolygon'),
  }

  const boundaryLines: BoundaryLine[] = []
  for (const f of features) {
    if (f?.geometry?.type !== 'MultiLineString') continue
    const segs = (f.geometry.coordinates ?? []).filter(
      (l: unknown) => Array.isArray(l) && (l as unknown[]).length > 1,
    ) as [number, number][][]
    const key = `${segs.length}x${segs.reduce((n, l) => n + l.length, 0)}`
    const dash = SPECIAL[key] ?? null
    for (const line of segs) boundaryLines.push({ coords: line, dash })
  }

  cache = { regions, boundaryLines, approvalNumber: APPROVAL_NUMBER }
  return cache
}

/** 省名 → 简称（浙江 与 浙江省 之间互相找得到） */
export const shortProvinceName = (name: string): string =>
  name.replace(/(壮族|回族|维吾尔)?自治区$/, '').replace(/(省|市|特别行政区)$/, '')
