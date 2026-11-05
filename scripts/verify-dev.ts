/**
 * 开发服务器自愈验收（npm run dev 的行为验收）。
 *
 * 验四件事：
 *   ① 正常状态：三个域都能开；
 *   ② 热更新生效：改服务端组件的文案 → 刷新 → 新文案在；
 *   ③ 崩了能自愈：kill -9 掉 next dev → 守护实例自动拉起 → 页面恢复；
 *   ④ 崩过之后热更新**仍然**生效（最难的一条：Turbopack 的持久缓存过期会让
 *      改代码不生效，重启时必须把缓存清掉）。
 *
 * 用法（需要先 `npm run dev`）：
 *   npx tsx --env-file-if-exists=.env scripts/verify-dev.ts
 *
 * ⚠️ 会临时改动 src/components/site/SiteFooter.tsx 的一行文案（探针），跑完自动还原。
 */
import { chromium, type Page } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

/** 探针文件：页脚在**每个**公众站页面上都渲染，改这里的文案最稳 */
const FILE = 'src/components/site/SiteFooter.tsx'
const ANCHOR = '数字木兰校友会'
const PUBLIC = 'http://localhost:3000'
const WORKSPACE = 'http://connect.localhost:3000'
const CMS = 'http://admin.localhost:3000'
/** 探针：改完文案 → 等热更新 → 页面出现新标记 */
const MARK = '【热更新探针】'

const log = (...a: unknown[]) => console.log(...a)

let failures = 0
const check = (ok: boolean, label: string, detail = '') => {
  if (ok) {
    log(`  ✓ ${label}`)
  } else {
    failures += 1
    log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/**
 * 打开页面并返回正文。
 *
 * ⚠️ 用 page.goto 而不是 page.request.get：
 *   `*.localhost` 按 RFC 6761 由**浏览器**解析成 127.0.0.1，但 Node 的 DNS 不认，
 *   page.request.get('http://admin.localhost:3000/...') 会直接 ENOTFOUND。
 *
 * ⚠️ 读 body 而不是 main：探针改的是**页脚**，而页脚是 `<main>` 的兄弟节点
 *   （见 src/app/(site)/layout.tsx），读 main 永远看不到页脚的文案。
 */
async function readBody(page: Page, url: string, timeout = 60000): Promise<string> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
  await page.waitForTimeout(1500)
  return await page.locator('body').innerText()
}

/**
 * 热更新探针：改一行文案 → 等 Turbopack 重编译 → 看新标记在不在 → 还原。
 *
 * ⚠️ 轮询而不是「固定等 12 秒再看一次」：
 *   改完源码到重编译完成之间有个窗口，请求可能撞上一次 500（Payload 在热更新时
 *   会重建 collections 与 import map，见 payload/dist/index.js 的 reload()）。
 *   那是开发态的瞬时现象，不是热更新失败——所以要**重试**到标记出现为止。
 */
async function probeHotReload(page: Page): Promise<boolean> {
  const src = readFileSync(FILE, 'utf-8')
  if (!src.includes(ANCHOR)) {
    log(`  ! 探针文件里找不到锚点「${ANCHOR}」`)
    return false
  }
  writeFileSync(FILE, src.replace(ANCHOR, `${ANCHOR}${MARK}`))
  try {
    for (let attempt = 1; attempt <= 10; attempt++) {
      await new Promise((r) => setTimeout(r, 3000))
      try {
        const text = await readBody(page, `${PUBLIC}/`)
        if (text.includes(MARK)) return true
      } catch {
        // 重编译窗口内的瞬时失败：继续等
      }
    }
    return false
  } finally {
    writeFileSync(FILE, src)
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
// 演示库用的是外网字体，测试环境取不到，直接拦掉免得等超时
await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort())
await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort())
const page = await ctx.newPage()

log('① 三个域是否可用：')
for (const [url, label] of [
  [`${PUBLIC}/`, '公众域 /'],
  [`${PUBLIC}/circles`, '公众域 /circles'],
  [`${PUBLIC}/resources`, '公众域 /resources'],
  [`${WORKSPACE}/login`, '工作台域 /login'],
  [`${CMS}/admin/login`, 'CMS 域 /admin/login'],
] as const) {
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    check((res?.status() ?? 0) < 400, `${label} → ${res?.status()}`)
  } catch (e) {
    check(false, `${label} 打不开`, String(e).slice(0, 90))
  }
}

log('② 公众域不该开接口（/api/health 应 404）：')
{
  const res = await page.goto(`${PUBLIC}/api/health`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  check(res?.status() === 404, `公众域 /api/health → ${res?.status()}（应为 404）`)
}

log('③ 正常状态下热更新是否生效：')
check(await probeHotReload(page), '改页脚文案 → 刷新 → 新文案在')

log('④ 崩了能不能自愈（kill -9 next dev）：')
{
  const { execSync } = await import('node:child_process')
  execSync(
    `for p in $(ls /proc | grep -E '^[0-9]+$'); do cmd=$(tr '\\0' ' ' < /proc/$p/cmdline 2>/dev/null); case "$cmd" in *"next dev"*|*"next-server"*) case "$cmd" in *"grep"*|*"for p in"*) ;; *) kill -9 "$p" 2>/dev/null;; esac;; esac; done`,
    { shell: '/bin/bash' },
  )
  log('  已 kill -9，等守护实例拉起…')
  let recovered = false
  for (let attempt = 1; attempt <= 12; attempt++) {
    await new Promise((r) => setTimeout(r, 5000))
    try {
      const res = await page.goto(`${PUBLIC}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      if ((res?.status() ?? 0) < 400) {
        recovered = true
        break
      }
    } catch {
      // 还没起来：继续等
    }
  }
  check(recovered, 'next dev 被杀 → 守护实例拉起 → 页面恢复')
}

log('⑤ 崩过之后热更新是否仍然生效：')
check(await probeHotReload(page), '重启后再改文案 → 刷新 → 新文案在')

await browser.close()
log('')
if (failures) {
  log(`✗ ${failures} 项未通过`)
  process.exit(1)
}
log('✓ 全部通过')
