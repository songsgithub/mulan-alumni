/**
 * 活动材料 PDF 的公文规范验收（GB/T 9704-2012）。
 *
 * 验的是**打印出来的 PDF**本身，不是 CSS 声明——
 * CSS 写了不代表浏览器真按它渲染（字体加载失败时 Chromium 会静默降级，
 * 中文落成 Type3 位图字体，肉眼几乎看不出，但文本不可选、放大发虚）。
 *
 * 用法（需先 npm run dev）：
 *   npx tsx --env-file-if-exists=.env scripts/verify-gongwen.ts
 *
 * 判定项：
 *   ① 页面尺寸 A4（210×297mm）
 *   ② 版心尺寸 176mm × 225mm（页边距 上37 下35 左17 右17）
 *   ③ 嵌入字体为真字体（Type0），无 Type3 位图兜底
 *   ④ 字号层级：标题 22pt / 正文 16pt / 表格 14pt
 *   ⑤ 字体族：正文仿宋、一级标题黑体、二级标题楷体、标题宋体加粗
 *   ⑥ 每页行数接近规范的 22 行
 *   ⑦ 页码存在且格式为「— N —」
 *
 * 另外还跑 scripts/verify-pagination.py（排版质量）：
 *   ⑧ 总页数、单页空白率、表格短内容断行
 */
import { chromium, type Page } from 'playwright'
import { writeFileSync } from 'node:fs'

const WORK = 'http://connect.localhost:3000'
const SLUG = process.env.VERIFY_PLAN_SLUG || '6ah36xvn9s3pj4'

let failures = 0
const check = (ok: boolean, label: string, detail = '') => {
  console.log(ok ? `  ✓ ${label}` : `  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

const login = async (page: Page, email: string, password: string) => {
  await page.goto(`${WORK}/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 })
  await page.waitForLoadState('networkidle')
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })
await ctx.route('**://fonts.g**', (r) => r.abort())
const page = await ctx.newPage()

await login(page, 'admin@mulan.org', 'Mulan@2026')

// 下载打印出来的 PDF（打印路由是 Chromium 渲染的产物，这才是验收对象）
const dl = page.waitForEvent('download', { timeout: 120000 })
await page.goto(`${WORK}/activities/${SLUG}/print/pdf`, { waitUntil: 'commit' }).catch(() => {})
const download = await dl
const pdfPath = await download.path()
if (!pdfPath) {
  console.log('  ✗ PDF 下载失败')
  failures += 1
} else {
  const buf = await (await import('node:fs')).promises.readFile(pdfPath)
  writeFileSync('tmp/gongwen.pdf', buf)
  check(buf.slice(0, 5).toString() === '%PDF-', `PDF 已生成（${(buf.length / 1024 / 1024).toFixed(1)} MB）`)
}

await browser.close()

// ---- 用 PyMuPDF 验 PDF 本身 ----
// ⚠️ 必须验**打印出来的 PDF**，而不是 CSS 声明：
// 字体加载失败时 Chromium 不报错，只是静默换兜底字体，
// 中文在 PDF 里落成 Type3 位图路径——只看 CSS 是验不出来的。
try {
  const { execFileSync } = await import('node:child_process')
  const out = execFileSync('python3', ['scripts/verify-gongwen.py', 'tmp/gongwen.pdf'], { encoding: 'utf-8' })
  console.log(out.trimEnd())
  const m = out.match(/FAILED=(\d+)/)
  if (m) failures += Number(m[1])
} catch (e: any) {
  // python3 或 PyMuPDF 不可用时，不能当作通过
  console.log('  ✗ 公文规范核验没跑起来（需要 python3 + PyMuPDF）')
  console.log(`    ${String(e?.message ?? e).split('\n')[0]}`)
  failures += 1
}

// ---- 排版质量：分页空白与表格断行 ----
// 规范合规 ≠ 排版好看。上一版规范全绿，但页边距一放开、
// 表格一断行，整份材料「像不像正式文件」就变了，这两项要单独验。
try {
  const { execFileSync } = await import('node:child_process')
  const out = execFileSync('python3', ['scripts/verify-pagination.py', 'tmp/gongwen.pdf'], { encoding: 'utf-8' })
  console.log(out.trimEnd())
  const m = out.match(/FAILED=(\d+)/)
  if (m) failures += Number(m[1])
} catch (e: any) {
  console.log('  ✗ 排版质量核验没跑起来（需要 python3 + PyMuPDF）')
  console.log(`    ${String(e?.message ?? e).split('\n')[0]}`)
  failures += 1
}

console.log('')
if (failures) {
  console.log(`✗ ${failures} 项未通过`)
  process.exit(1)
}
console.log('✓ 全部通过')
