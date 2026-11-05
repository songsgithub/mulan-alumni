/**
 * 预取中国地图数据（省 / 市 / 区县三级边界）到 `data/geo-cache/`。
 *
 * 数据源：DataV.GeoAtlas（阿里云公开的行政区划边界，areas_v3 为最新一版区划）。
 *   - `100000_full.json` → 全国省级
 *   - `{省 adcode}_full.json` → 该省的地级市
 *   - `{市 adcode}_full.json` → 该市的区 / 县
 *
 * 为什么要预取：地图要在浏览器里逐级下钻，每次现拉会让首屏等待网络。
 * 预取后由 `/api/geo/[adcode]` 直接读本地缓存；没预取到的层级会在用户点开时
 * 由接口现拉并落盘。
 *
 * 用法：npx tsx --env-file-if-exists=.env scripts/fetch-geo.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const CACHE_DIR = path.join(process.cwd(), 'data', 'geo-cache')
const SOURCE = 'https://geo.datav.aliyun.com/areas_v3/bound'

/** 需要预取的层级：全国 + 各地互助团所在的省、市 */
const AD_CODES = [
  '100000',
  // 浙江 · 杭州
  '330000',
  '330100',
  // 北京 · 朝阳
  '110000',
  // 四川 · 成都
  '510000',
  '510100',
  // 广东 · 深圳
  '440000',
  '440300',
  // 陕西 · 西安
  '610000',
  '610100',
]

async function fetchOne(adcode: string) {
  const file = path.join(CACHE_DIR, `${adcode}.json`)
  const exists = await fs
    .stat(file)
    .then(() => true)
    .catch(() => false)
  if (exists) {
    console.log(`已存在，跳过：${adcode}`)
    return
  }

  const res = await fetch(`${SOURCE}/${adcode}_full.json`)
  if (!res.ok) {
    throw new Error(`拉取 ${adcode} 失败：HTTP ${res.status}`)
  }
  const text = await res.text()
  // 先写临时文件再改名，避免并发读到一个写了一半的 JSON
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, text, 'utf-8')
  await fs.rename(tmp, file)
  console.log(`已缓存 ${adcode}（${(text.length / 1024).toFixed(0)} KB）`)
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true })
  for (const adcode of AD_CODES) {
    await fetchOne(adcode)
  }
  console.log(`完成，缓存目录：${CACHE_DIR}`)
}

main().catch((err) => {
  console.error('预取地图数据失败：', err)
  process.exit(1)
})
