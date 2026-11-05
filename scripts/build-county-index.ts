/**
 * 构建全国县区划索引：抓取 DataV 的省 → 市 → 区县三级边界，
 * 把全国所有**县级**单位（县 / 自治县 / 县级市 / 市辖区）汇成一张表。
 *
 * 用途：模拟"全国真实盘"的互助团网络时，要按真实行政区划落位
 * （数字木兰项目本来就落在中西部欠发达县域）。
 *
 * 产物：data/geo-cache/counties.json
 *   [{ adcode, name, level, province, provinceCode, city, cityCode }]
 *
 * 用法：npx tsx --env-file-if-exists=.env scripts/build-county-index.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const CACHE_DIR = path.join(process.cwd(), 'data', 'geo-cache')
const SOURCE = 'https://geo.datav.aliyun.com/areas_v3/bound'

interface Feature {
  properties: { adcode: number; name: string; level: string; childrenNum: number }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchGeo(adcode: string): Promise<{ features: Feature[] }> {
  const file = path.join(CACHE_DIR, `${adcode}.json`)
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'))
  } catch {
    // 没有缓存就现拉
  }
  const res = await fetch(`${SOURCE}/${adcode}_full.json`)
  if (!res.ok) throw new Error(`拉取 ${adcode} 失败：HTTP ${res.status}`)
  const text = await res.text()
  await fs.mkdir(CACHE_DIR, { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, text, 'utf-8')
  await fs.rename(tmp, file)
  return JSON.parse(text)
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true })

  const provinces = await fetchGeo('100000')
  const list: any[] = []

  for (const province of provinces.features) {
    const p = province.properties
    if (p.level !== 'province') continue
    // 台湾省等在 DataV 没有下级文件，直接跳过
    let cities: { features: Feature[] }
    try {
      cities = await fetchGeo(String(p.adcode))
    } catch {
      continue
    }

    for (const city of cities.features) {
      const c = city.properties
      // 直辖市 / 省的 children 本身就是区县（level = district）
      if (c.level === 'district') {
        list.push({
          adcode: String(c.adcode),
          name: c.name,
          level: c.level,
          province: p.name,
          provinceCode: String(p.adcode),
          city: p.name,
          cityCode: String(p.adcode),
        })
        continue
      }
      if (c.level !== 'city') continue

      // 省直管县级市（如济源市）在 DataV 没有下级文件，404 直接跳过
      let districts: { features: Feature[] }
      try {
        districts = await fetchGeo(String(c.adcode))
      } catch {
        continue
      }
      for (const district of districts.features) {
        const d = district.properties
        if (d.level !== 'district') continue
        list.push({
          adcode: String(d.adcode),
          name: d.name,
          level: d.level,
          province: p.name,
          provinceCode: String(p.adcode),
          city: c.name,
          cityCode: String(c.adcode),
        })
      }
      await sleep(30)
    }
    await sleep(50)
    console.log(`${p.name} 完成，累计 ${list.length} 个县级单位`)
  }

  const out = path.join(CACHE_DIR, 'counties.json')
  await fs.writeFile(out, JSON.stringify(list, null, 0), 'utf-8')
  console.log(`全国县级单位共 ${list.length} 个 → ${out}`)
}

main().catch((err) => {
  console.error('构建县区划索引失败：', err)
  process.exit(1)
})
