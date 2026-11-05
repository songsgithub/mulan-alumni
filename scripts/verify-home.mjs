/**
 * 工作台首页「筛选在前、视图在后」的验收脚本（只读，不写库）。
 *
 * 用法：
 *   node scripts/verify-home.mjs
 *   # 需要先 npm run dev（公众域 localhost:3000 / 工作台域 connect.localhost:3000）
 *
 * 背景（2026-10-30 第二十七轮之二）：
 *   首页原来把筛选放左栏、列表放右栏，中间隔着一屏；这一轮把筛选与搜索提到
 *   视图切换（「活动 / 图片」）**前面**，两个视图共用同一套筛选与关键词。
 *   视图切换走地址（tab=activities / tab=images），不是客户端状态。
 *
 * 注意：脚本里的断言跟着**结构与规则**走，不写死整句文案、不写死数字 id。
 */
import { chromium } from 'playwright'

const WORKSPACE = 'http://connect.localhost:3000'
const SITE = 'http://localhost:3000'
const OUT = '/tmp/shots26'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 } })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 160))
})
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))

/* ---------------------------------------------------------- 登录工作台 */
await page.goto(`${WORKSPACE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', 'admin@mulan.org')
await page.fill('input[type="password"]', 'Mulan@2026')
await page.click('button[type="submit"]')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 })

/* --------------------------------------- ① 搜索框在视图切换控件之前 */
await page.goto(`${WORKSPACE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const order = await page.evaluate(() => {
  const search = document.querySelector('main input[aria-label="搜索活动"]')
  const switcher = document.querySelector('main [role="tab"]')
  if (!search || !switcher) return { ok: false, search: !!search, switcher: !!switcher }
  const s = search.getBoundingClientRect()
  const t = switcher.getBoundingClientRect()
  return { ok: s.top < t.top, searchTop: Math.round(s.top), switchTop: Math.round(t.top) }
})
check('① 搜索框排在视图切换控件之前', order.ok, JSON.stringify(order))

/* ---------------- ①b 页头不留「经费」入口（2026-10-30 用户要求） */
const headerLinks = await page.evaluate(() => {
  const h1 = document.querySelector('main h1')
  // 页头容器 = 标题块的上一级（标题块 → 标题行 → 整条页头）
  const scope = h1?.closest('div')?.parentElement?.parentElement
  const links = Array.from(scope?.querySelectorAll('a') ?? []).map((a) => ({
    text: (a.textContent ?? '').trim(),
    href: a.getAttribute('href') ?? '',
  }))
  const buttons = Array.from(scope?.querySelectorAll('button') ?? [])
    .map((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim())
    .filter(Boolean)
  return {
    budget: links.filter((l) => l.text === '经费' || l.href.startsWith('/budget')).length,
    labels: links.map((l) => l.text).filter(Boolean),
    buttons,
  }
})
check(
  '①b 页头没有「经费」按钮',
  headerLinks.budget === 0,
  `链接：${headerLinks.labels.join(' / ') || '无'}；按钮：${headerLinks.buttons.join(' / ') || '无'}`,
)

/* --------------------------------- ② 筛选控件不在视图切换那一格里 */
// ⚠️ 视图切换现在是 shadcn/ui 的 Tabs（role="tablist" / role="tab"），
//    不是 <a href="?tab=…">（2026-10-27 从 LinkTabs 迁过来时改的）。
//    断言要跟着结构走：查 role="tablist"，别查 a[href*=tab=]。
const outside = await page.evaluate(() => {
  const tablist = document.querySelector('main [role="tablist"]')
  const filters = document.querySelectorAll(
    'main select, main [role="search"], main [role="combobox"]',
  )
  const inside = [...filters].filter((el) => tablist && tablist.contains(el)).length
  return { tablist: !!tablist, filters: filters.length, inside }
})
check(
  '② 筛选控件在视图切换区之外（两个视图共用同一套筛选）',
  outside.tablist && outside.filters > 0 && outside.inside === 0,
  JSON.stringify(outside),
)

/* ------------------------------------------- ③ 搜索在「活动」视图生效 */
// 首页搜索框是 UrlSearchField：边打边筛（300ms 防抖写地址），没有「搜索」按钮
await page.getByLabel('搜索活动').fill('共学')
await page.waitForURL((u) => u.searchParams.get('q') === '共学', { timeout: 15000 })
await page.waitForTimeout(800)
const qUrl = new URL(page.url())
const activityRows = await page.locator('tbody tr').count()
check(
  '③ 搜索写进地址（q=…）',
  qUrl.searchParams.get('q') === '共学',
  page.url(),
)
check('③ 活动列表按关键词过滤后有结果', activityRows > 0, `${activityRows} 行`)

/* ------------------- ④ 切到「图片」视图：关键词与筛选条件都跟着走 */
// 视图切换是 LinkTabs（role=tab，选中后 router.push 写地址）
await page.getByRole('tab', { name: '图片' }).click()
await page.waitForURL((u) => u.searchParams.get('tab') === 'images', { timeout: 15000 })
await page.waitForTimeout(1200)
const imgUrl = new URL(page.url())
check(
  '④ 切到图片视图后关键词仍在地址里',
  imgUrl.searchParams.get('q') === '共学',
  page.url(),
)
const searchStillThere = await page.getByLabel('搜索活动').count()
check('④ 图片视图里搜索框仍在（前置筛选区）', searchStillThere === 1, `${searchStillThere} 个`)

/* --------------------------------- ⑤ 清空搜索 → 回到未搜索的图片列表 */
await page.locator('main [aria-label="清空搜索"]').first().click()
await page.waitForURL((u) => !u.searchParams.get('q'), { timeout: 15000 })
await page.waitForTimeout(800)
const cleared = new URL(page.url())
check(
  '⑤ 清除搜索后地址里不再有 q',
  !cleared.searchParams.get('q'),
  page.url(),
)

/* -------------------------------------------- ⑥ 窄屏不横向溢出 */
const mobile = await browser.newContext({
  viewport: { width: 360, height: 780 },
  isMobile: true,
  hasTouch: true,
})
const mp = await mobile.newPage()
await mp.goto(`${WORKSPACE}/login`, { waitUntil: 'networkidle' })
await mp.fill('input[type="email"]', 'admin@mulan.org')
await mp.fill('input[type="password"]', 'Mulan@2026')
await mp.click('button[type="submit"]')
await mp.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 })
await mp.goto(`${WORKSPACE}/`, { waitUntil: 'networkidle' })
await mp.waitForTimeout(1200)
const overflow = await mp.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
)
check('⑥ 360px 窄屏无横向溢出', overflow === 0, `溢出 ${overflow}px`)

/* ------------------- ⑦ 公众域「联系我们」页：渲染 + 无内部术语 + 不写库 */
const sitePage = await ctx.newPage()
const siteErrors = []
sitePage.on('console', (m) => {
  if (m.type() === 'error') siteErrors.push(m.text().slice(0, 160))
})
sitePage.on('pageerror', (e) => siteErrors.push(String(e).slice(0, 160)))
await sitePage.goto(`${SITE}/contact`, { waitUntil: 'networkidle' })
await sitePage.waitForTimeout(800)
const contactHasForm = await sitePage.locator('form input[name="name"]').count()
check('⑦ 联系我们页有联系表单', contactHasForm > 0)
const bodyText = await sitePage.locator('body').innerText()
// ⚠️ 「工作台」是**允许**出现在公众站的（2026-10-31 用户明确要求）：
//    公众站顶栏有一条竖线，竖线后是「工作台」入口（新标签打开工作台域的登录页），
//    是公众域**唯一**允许的登录指向（AGENTS.md §3 的「唯一例外」）。
//    所以这里不能把它当成内部术语——要查的是页**正文**（main）里有没有，
//    不是页头导航里有没有。
const mainText = await sitePage.locator('main').innerText()
const banned = ['报销', '审批', '经费', '工作台', '项目组', '团长']
const hits = banned.filter((w) => mainText.includes(w))
check('⑦ 联系我们页正文没有内部术语', hits.length === 0, hits.join('、') || '干净')
await sitePage.screenshot({ path: `${OUT}/f-04-contact.png`, fullPage: true })

/* ---------------------------------------------- ⑧ 接口参数校验（不写库） */
const bad = await sitePage.evaluate(async () => {
  const r = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '', contact: '', message: '' }),
  })
  return { status: r.status, body: await r.json() }
})
check(
  '⑧ 联系接口拒绝空表单（不落通知）',
  bad.status === 400 && bad.body?.ok === false,
  JSON.stringify(bad),
)
// 2026-11-03：所属机构 / 您的职位改为必填，接口层同样要拒
const missingOrg = await sitePage.evaluate(async () => {
  const r = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '测试',
      contact: 'test@example.com',
      organization: '',
      position: '',
      participation: '想参加',
    }),
  })
  return { status: r.status, body: await r.json() }
})
check(
  '⑧ 联系接口拒绝缺机构 / 职位的表单',
  missingOrg.status === 400 && missingOrg.body?.ok === false,
  JSON.stringify(missingOrg),
)

/* ------------------------------------------------------- 汇总 */
console.log('\n--- 控制台错误 ---')
console.log(errors.length ? [...new Set(errors)].slice(0, 5).join('\n') : '工作台：无')
console.log(siteErrors.length ? [...new Set(siteErrors)].slice(0, 5).join('\n') : '公众站：无')

const failed = results.filter((r) => !r.ok)
console.log(`\n结果：${results.length - failed.length} 通过 / ${failed.length} 失败`)
await browser.close()
process.exit(failed.length ? 1 : 0)
