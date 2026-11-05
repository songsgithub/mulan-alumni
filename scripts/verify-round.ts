/**
 * 本轮验收：去名字化 + 官方英文类别名 + 重建库之后的全链路抽查。
 *
 * 用真实浏览器跑（Playwright / Chromium），覆盖三域、筛选、登录与业务链路。
 * 用法：npx tsx scripts/verify-round.ts
 *
 * 断言跟着文案走：正文里的中文以 `src/content/site.ts` 为准，
 * 这里只断言**结构与规则**（入口、内部术语、筛选参数、权限），不写死整句文案。
 */
import { chromium, type Page } from 'playwright'

const SITE = 'http://localhost:3000'
const WORK = 'http://connect.localhost:3000'
const CMS = 'http://admin.localhost:3000'

let pass = 0
let fail = 0
const failures: string[] = []

const check = (name: string, ok: boolean, detail = '') => {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const section = (title: string) => console.log(`\n▌${title}`)

/** 页面文本（去掉脚本与样式） */
const textOf = async (page: Page) =>
  (await page.evaluate(() => document.body?.innerText ?? '')).replace(/\s+/g, ' ')


const login = async (page: Page, email: string, password: string) => {
  await page.goto(`${WORK}/login`, { waitUntil: 'networkidle' })
  // ⚠️ 必须等 React 水合完成再点：否则原生表单提交，URL 停在 /login
  await page.waitForTimeout(1200)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  // ⚠️ 必须等"离开 /login"，等"域名是 connect.localhost"没用——本来就在这个域上
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 })
  await page.waitForLoadState('networkidle')
}

/** 退出：等登出请求真正完成、被送回登录页再继续（否则下一次登录会被已登录状态弹走） */
const logout = async (page: Page) => {
  await page.goto(`${WORK}/logout`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL((url) => url.pathname.startsWith('/login'), { timeout: 20000 })
}

const run = async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log('  [页面异常]', page.url(), err.message.split('\n')[0]))

  // 公众站的**内容**断言（首页结构、详情页、资源、关于）：公众站改版后需单独更新，
  // VERIFY_SKIP_PUBLIC_CONTENT=1 时跳过，只验工作台；公众域的**边界**断言始终执行
  const forbidden = ['团长', '项目组', '报销', '经费标准', '审批', '闭环', 'SOP', '核减']
  if (process.env.VERIFY_SKIP_PUBLIC_CONTENT !== '1') {
  // ---------------------------------------------------------------- 公众域
  section('公众域（localhost）')
  await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  const home = await textOf(page)
  check('首页正常返回', home.length > 200)
  check('首页不出现「登录」入口', !home.includes('登录'))
  // 「加入我们」是**合作联系入口**（指向 /contact，规范 §0.2 允许），
  // 不是登录 / 注册入口。所以这里查的是「有没有指向登录注册路由的链接」，
  // 以及正文里有没有"注册""申请加入"这类真入口文案。
  // ⚠️ 唯一例外（2026-10-31 用户要求）：顶栏「工作台」入口指向**工作台域**且新标签打开，
  //    见 docs/设计规范.md §0.1 的例外说明——它不计入登录 / 注册入口。
  const authEntryLinks = await page
    .locator('a[href$="/login"], a[href$="/join"], a[href$="/register"], a[href$="/signup"]')
    .evaluateAll((els) =>
      els.filter((el) => {
        const href = el.getAttribute('href') ?? ''
        return !(el.getAttribute('target') === '_blank' && /^https?:\/\/connect\./.test(href))
      }).length,
    )
  check(
    '首页不出现「注册 / 加入 / 申请」入口',
    authEntryLinks === 0 && !/注册|申请加入/.test(home.replace(/不用注册/g, '')),
    authEntryLinks > 0 ? `找到 ${authEntryLinks} 个登录 / 注册链接` : '首页出现了疑似入口文案',
  )
  // 顶栏「工作台」入口：在「加入我们」右侧，指向工作台域并新标签打开
  const wsEntry = page.locator('header a[target="_blank"]').filter({ hasText: '工作台' })
  check('顶栏有「工作台」入口', (await wsEntry.count()) === 1, `找到 ${await wsEntry.count()} 个`)
  const wsHref = (await wsEntry.first().getAttribute('href').catch(() => '')) ?? ''
  check('「工作台」指向工作台域登录页', /^https?:\/\/connect\.[^/]+\/login$/.test(wsHref), wsHref)
  // 第十九轮起公开站复刻 muse：首页 = Banner + 数字 + 最新活动（快速筛选）+ 互助团风采；
  // 「关于互助团」页按 SOP 介绍互助团怎么办，所以不再检查「内部术语」
  check('首页有中文主标题', /[\u4e00-\u9fa5]/.test((await page.locator('main h1').first().innerText().catch(() => '')) ?? ''))
  check('首页有数字指标', /\d/.test(home) && home.includes('人次参与'))
  check('首页有「最新活动」与「互助团风采」', home.includes('最新活动') && home.includes('互助团风采'))
  const homeCards = await page.locator('main a[href^="/activities/"]').count()
  check('首页列出活动卡片', homeCards >= 3, `找到 ${homeCards} 张`)
  for (const href of ['/circles', '/activities', '/resources', '/about']) {
    const n = await page.locator(`header a[href="${href}"]`).count()
    check(`导航有入口 ${href}`, n > 0, `找到 ${n} 个`)
  }

  section('公众站：活动列表')
  await page.goto(`${SITE}/activities`, { waitUntil: 'networkidle' })
  const listText = await textOf(page)
  // 改版后这一页叫「所有活动」（原来叫「活动列表」）
  check(
    '活动列表页可打开',
    listText.includes('所有活动') || listText.includes('活动列表'),
    listText.slice(0, 40),
  )
  const outcomeHrefs = await page.locator('main a[href^="/activities/"]').evaluateAll((els) =>
    Array.from(new Set(els.map((el) => el.getAttribute('href') ?? ''))),
  )
  check('列出活动', outcomeHrefs.length >= 1, `实际 ${outcomeHrefs.length} 条`)
  // 网址里那一段是不透明随机串（14 位小写字母数字）；页面上显示的仍是中文
  check(
    '活动网址都用随机串做标识',
    outcomeHrefs.length > 0 && outcomeHrefs.every((h) => /^\/activities\/[a-z0-9]{14}$/.test(h)),
    outcomeHrefs.find((h) => !/^\/activities\/[a-z0-9]{14}$/.test(h)) ?? '',
  )
  await page.goto(`${SITE}/activities?project=go-mulan`, { waitUntil: 'networkidle' })
  const filtered = await page.locator('main a[href^="/activities/"]').count()
  check('按公益项目筛选生效', filtered > 0 && filtered < outcomeHrefs.length + 1, `${outcomeHrefs.length} → ${filtered}`)
  // 关键词**不能写死**：库里有什么词就搜什么词
  // （写死的"简历"早就不在成果里了，那样只会误报"搜索坏了"）。
  const sampleTitle = (await page.locator('main a[href^="/activities/"]').first().innerText())
    .split('\n')[0]
    .slice(0, 2)
  await page.goto(`${SITE}/activities?q=${encodeURIComponent(sampleTitle)}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check(
    '关键词搜索生效',
    (await page.locator('main input[type="search"], main input[name="q"]').count()) > 0 &&
      (await page.locator('main a[href^="/activities/"]').count()) > 0,
    `关键词「${sampleTitle}」搜不到`,
  )

  await page.goto(`${SITE}/circles`, { waitUntil: 'networkidle' })
  const circleHref = await page.locator('main a[href^="/circles/"]').first().getAttribute('href').catch(() => null)
  check('互助团风采里的团可点进去（随机标识）', Boolean(circleHref && /^\/circles\/[a-z0-9]{14}$/.test(circleHref)), `实际 ${circleHref}`)

  section('公众站详情页')
  if (outcomeHrefs[0]) {
    await page.goto(`${SITE}${outcomeHrefs[0]}`, { waitUntil: 'networkidle' })
    const t = await textOf(page)
    // 改版后详情页的返回链接叫「返回所有活动」（原来叫「返回活动列表」）
    check(
      '活动详情页可打开',
      t.length > 100 && /返回(所有)?活动|回到所有活动/.test(t),
      t.slice(0, 40),
    )
    check('活动详情页显示中文标题', /[\u4e00-\u9fa5]/.test(await page.locator('main h1').first().innerText()))
    const brokenImg = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main img')).filter((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth === 0).length,
    )
    check('活动详情页的图片都能加载', brokenImg === 0, `${brokenImg} 张加载失败`)
  }

  if (circleHref) {
    await page.goto(`${SITE}${circleHref}`, { waitUntil: 'networkidle' })
    const t = await textOf(page)
    check('互助团详情页可打开', t.length > 100)
    check('互助团详情页显示中文团名', /互助团/.test(t), t.slice(0, 60))
    // 改版后这一段叫「活动动态」（原来叫「本队活动动态」）
    check('互助团详情页有活动时间轴', t.includes('活动动态'), t.slice(0, 40))
  }

  await page.goto(`${SITE}/circles`, { waitUntil: 'domcontentloaded' })
  const circles = await textOf(page)
  check('互助团风采可打开', circles.includes('互助团风采'))

  await page.goto(`${SITE}/resources`, { waitUntil: 'domcontentloaded' })
  check('资料库可打开', (await textOf(page)).length > 80)
  const resLink = await page.locator('a[href^="/resources/"]').first().getAttribute('href')
  if (resLink) {
    const seg = resLink.split('/').pop() ?? ''
    check('资料网址用随机串做标识', /^[a-z0-9]{14}$/.test(seg), `实际 /resources/${seg}`)
    await page.goto(`${SITE}${resLink}`, { waitUntil: 'domcontentloaded' })
    check('资料详情页可打开', (await textOf(page)).length > 80)
  } else {
    check('资料详情页链接存在', false, '资料库页没有 /resources/ 链接')
  }

  // 资源页：分类筛选 + PDF 内嵌预览 + 视频播放器
  await page.goto(`${SITE}/resources`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const resPage = await textOf(page)
  check('资源页有分类筛选', resPage.includes('全部') && resPage.includes('品牌 VI'), resPage.slice(0, 80))
  const allCards = await page.locator('article').count()
  await page.goto(`${SITE}/resources?category=vi`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  const viCards = await page.locator('article').count()
  check('按「品牌 VI」筛选生效', viCards > 0 && viCards < allCards, `${allCards} → ${viCards}`)

  const viHref = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href^="/resources/"]')).find((el) =>
      el.textContent?.includes('品牌 VI'),
    )
    return a ? (a as HTMLAnchorElement).getAttribute('href') : null
  })
  if (viHref) {
    await page.goto(`${SITE}${viHref}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    check('品牌 VI 详情页能直接翻 PDF', (await page.locator('iframe').count()) > 0)
  } else {
    check('找到品牌 VI 资源', false, '资源页没有品牌 VI 卡片')
  }

  await page.goto(`${SITE}/resources`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  const videoHref = await page.evaluate(() => {
    // 按**形态角标**（封面右上角的「▶ 视频」）找视频资源——
    // 标题里带"视频"字样的文档（例：测试视频.pdf）不算。
    const cards = Array.from(document.querySelectorAll('a[href^="/resources/"]'))
    const hit = cards.find((el) =>
      Array.from(el.querySelectorAll('span')).some((s) => s.textContent?.trim() === '视频'),
    )
    return hit ? hit.getAttribute('href') : null
  })
  if (videoHref) {
    await page.goto(`${SITE}${videoHref}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    // 视频有两种形态：**站内文件**（有 <video> 播放器）与**外链**（给"在外部打开"，
    // 比如 B 站页面地址本来就塞不进 <video>）。两种都算"能看"。
    const hasPlayer = (await page.locator('video').count()) > 0
    const hasExternal = (await page.locator('main a:has-text("在外部打开")').count()) > 0
    check(
      '视频资源能看（站内播放器或明确的外链出口）',
      hasPlayer || hasExternal,
      '既没有播放器，也没有外链出口',
    )
  } else {
    check('找到视频资源', false, '资源页没有视频卡片')
  }
  check('资源卡片说明能干什么', /(在线播放|在线阅读|可以下载|查看详情)/.test(resPage), resPage.slice(0, 120))

  await page.goto(`${SITE}/about`, { waitUntil: 'domcontentloaded' })
  const about = await textOf(page)
  check('关于页可打开', about.length > 80)
  // 2026-11-02 第三十四轮：关于页按 docs/SOP/about&contactpages.docx 重做，
  // 内容是「关于数字木兰校友会 / 互助团 / 收获 / 项目组支持 / 落地路径」。
  check(
    '关于页讲清校友会与互助团',
    // 页头两行：小字「关于」+ 大标题「数字木兰校友会」
    // （textOf 把换行压成空格，两段不能直接拼起来查）
    about.includes('关于') &&
      about.includes('数字木兰校友会') &&
      about.includes('互助团') &&
      about.includes('自主成长') &&
      about.includes('落地路径'),
    about.slice(0, 60),
  )
  // 落地路径流程图：六个环节 + 两条回路的文字都在
  check(
    '关于页有互助团落地路径',
    ['成立互助小组', '申请活动预算', '开展互助活动', '申请报销'].every((w) => about.includes(w)),
    about.slice(0, 60),
  )

  await page.goto(`${SITE}/contact`, { waitUntil: 'domcontentloaded' })
  const contact = await textOf(page)
  check('联系我们页可打开', contact.length > 80)
  check('联系我们页有联系表单', (await page.locator('main form').count()) > 0)
  // 页头两行：小字「联系我们」+ 大标题「成为数字木兰的同行伙伴」
  check(
    '联系我们页页头是「联系我们」+「成为数字木兰的同行伙伴」',
    contact.includes('联系我们') && contact.includes('成为数字木兰的同行伙伴'),
    contact.slice(0, 60),
  )
  // docx 的表单字段都在
  check(
    '联系我们页有 docx 的表单字段',
    ['您的姓名', '联系方式', '所属机构', '您的职位', '您希望如何参与'].every((w) => contact.includes(w)),
    contact.slice(0, 60),
  )
  // 2026-11-03：联系人显示姓名与邮箱，不显示电话
  check(
    '联系我们页联系人有姓名与邮箱、无电话',
    contact.includes('聂自强') &&
      contact.includes('ziqiang.nzq@antgroup.com') &&
      !contact.includes('18200274921') &&
      !contact.includes('tel:'),
  )
  check('联系我们页无内部术语', !forbidden.some((w) => contact.includes(w)), forbidden.filter((w) => contact.includes(w)).join('、'))
  const contactAuthLinks = await page
    .locator('a[href$="/login"]')
    .evaluateAll((els) =>
      els.filter((el) => {
        const href = el.getAttribute('href') ?? ''
        return !(el.getAttribute('target') === '_blank' && /^https?:\/\/connect\./.test(href))
      }).length,
    )
  check('合作页不出现登录入口', !contact.includes('登录') && contactAuthLinks === 0)
  }

  section('公众域的边界')
  const resp = await page.goto(`${SITE}/admin`, { waitUntil: 'domcontentloaded' })
  check('公众域访问 /admin 返回 404', resp?.status() === 404, `实际 ${resp?.status()}`)
  const notFound = await textOf(page)
  check('404 页面是中文', /未找到|不存在|页面/.test(notFound), notFound.slice(0, 40))
  check('404 页面没有裸英文 Not Found', !notFound.includes('Not Found'))

  // 工作台页面、内部真实路径、旧的 /outcomes 在公众域一律 404（/activities 是公众站自己的活动页）
  for (const p of ['/home', '/login', '/join', '/logout', '/budget', '/settings', '/outcomes', '/site-activities']) {
    const r = await page.goto(`${SITE}${p}`, { waitUntil: 'domcontentloaded' })
    check(`公众域访问 ${p} 返回 404`, r?.status() === 404, `实际 ${r?.status()}`)
  }
  const acts = await page.goto(`${SITE}/activities`, { waitUntil: 'domcontentloaded' })
  check('公众域 /activities 是活动列表（200）', acts?.status() === 200, `实际 ${acts?.status()}`)
  // 工作台域：内部真实路径与公开站页面都不对外
  for (const p of ['/home', '/network', '/assets', '/about']) {
    const r = await page.goto(`${WORK}${p}`, { waitUntil: 'domcontentloaded' })
    check(`工作台域访问 ${p} 返回 404`, r?.status() === 404, `实际 ${r?.status()}`)
  }

  // ---------------------------------------------------------------- 工作台
  section('工作台（connect.localhost）')
  const anon = await page.goto(`${WORK}/`, { waitUntil: 'domcontentloaded' })
  check('未登录访问工作台被拦到登录页', page.url().includes('/login'), page.url())

  // 项目组登录
  await login(page, 'admin@mulan.org', 'Mulan@2026')
  const ws = await textOf(page)
  check('项目组登录成功并进工作台首页', page.url().replace(/\/$/, '').endsWith(':3000'), page.url())
  check('工作台首页有统计数字', /\d/.test(ws))
  // 年份筛选是自研下拉（不是原生 select），按可见文案判断
  check('工作台首页有年份筛选', ws.includes('年份') && /\d{4}\s*年/.test(ws), '没看到年份筛选')
  check('工作台首页默认统计当年', ws.includes(`${new Date().getFullYear()} 年`), '年份筛选不是当年')

  section('工作台：类别筛选')
  await page.goto(`${WORK}/circles`, { waitUntil: 'domcontentloaded' })
  const catLinks = await page.locator('a[href*="project="]').count()
  check('互助团页有类别筛选', catLinks > 0, `找到 ${catLinks} 个`)
  const enNames = ['GO Mulan', 'A-Idol', 'Homestay Manager', 'Wind Rider']
  const circlesPage = await textOf(page)
  const enHit = enNames.filter((n) => circlesPage.includes(n))
  check('类别只显示中文（无英文）', enHit.length === 0, `仍出现：${enHit.join('、')}`)
  const cnNames = ['加油木兰', 'AI豆计划', '民宿管家']
  check(
    '四个类别中文名都在',
    cnNames.every((n) => circlesPage.includes(n)),
    cnNames.filter((n) => !circlesPage.includes(n)).join('、'),
  )

  await page.goto(`${WORK}/circles?project=go-mulan`, { waitUntil: 'domcontentloaded' })
  check('类别筛选参数生效（页面正常）', (await textOf(page)).length > 80)

  section('工作台：互助团页面的信息层级')
  await page.goto(`${WORK}/circles`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const netPage = await textOf(page)
  check('标题是「互助团（数量）」', /互助团（\d+）/.test(netPage), netPage.slice(0, 40))
  check('没有「共 N 个互助团」统计行', !/共 \d+ 个互助团/.test(netPage))
  check('没有「更多（全部互助团）」链接', !netPage.includes('更多（全部互助团）'))
  check('没有地图说明文字', !netPage.includes('标数字的地方'))
  check('右侧列表没有「显示更多」分页', !netPage.includes('显示更多'))
  check('底部有「全部互助团」入口', netPage.includes('全部互助团'))
  // 「一次列出全部」要对着**实际团数**判，不能写死一个阈值：
  // 全国网络是 17 + 15 + 22 = 54 个真实落点的团（scripts/seed-network.ts），
  // 早年按几百个团写死的 >100 早过时了——那样只会逼着人去造数据。
  // 现在比的是：列表里的行数 == 标题里写的团数（一个都不能少，也不能多）。
  const listedRows = await page.locator('[data-circle-row]').count()
  const titleCount = Number(netPage.match(/互助团（(\d+)）/)?.[1] ?? 0)
  check(
    '右侧列表一次列出全部互助团',
    titleCount > 0 && listedRows === titleCount,
    `列了 ${listedRows} 行，标题写着 ${titleCount} 个`,
  )

  // 地图：「返回上一级」出现时不能把地图顶下去（预留按钮高度）
  const mapTop = () =>
    page.evaluate(() => {
      const el = document.querySelector('.map-canvas') as HTMLElement | null
      const rect = el?.getBoundingClientRect()
      return rect ? Math.round(rect.top) : null
    })
  const topBefore = await mapTop()
  // 点列表里的一行 → 地图下钻到那个区县。
  // 用 data-circle-row 选「行」本身，不要点几何中心（中心可能落在「查看 →」链接上，
  // 那样会跳走，不会下钻）。
  await page.locator('[data-circle-row]').first().click()
  await page.waitForTimeout(2500)
  const topAfter = await mapTop()
  check(
    '地图下钻时布局不跳（按钮高度已预留）',
    topBefore !== null && topAfter !== null && topBefore === topAfter,
    `下钻前 ${topBefore} → 下钻后 ${topAfter}`,
  )
  check('下钻后出现「返回上一级」', (await textOf(page)).includes('返回上一级'))

  await page.goto(`${WORK}/circles/all`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const allPage = await textOf(page)
  check('全部页标题带数量', /全部互助团（\d+）/.test(allPage), allPage.slice(0, 40))
  check('全部页没有「共 N 个」', !/共 \d+ 个/.test(allPage))
  check('全部页无英文类别名', !enNames.some((n) => allPage.includes(n)))

  section('工作台：互助团详情页')
  let circleHref: string | null = null
  await page.goto(`${WORK}/circles`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // 列表页与详情页的标题位置必须一致（徽标不能把标题顶偏）
  const listTitleTop = await page.evaluate(
    () => Math.round((document.querySelector('h1') as HTMLElement).getBoundingClientRect().top),
  )
  circleHref = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href^="/circles/"]')).find((el) =>
      /^\/circles\/[a-z0-9]{14}$/.test((el as HTMLAnchorElement).getAttribute('href') ?? ''),
    )
    return a ? (a as HTMLAnchorElement).getAttribute('href') : null
  })
  check('互助团详情链接存在', Boolean(circleHref))
  if (circleHref) {
    await page.goto(`${WORK}${circleHref}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const detailTitleTop = await page.evaluate(
      () => Math.round((document.querySelector('h1') as HTMLElement).getBoundingClientRect().top),
    )
    check(
      '详情页标题间距与列表页一致',
      listTitleTop === detailTitleTop,
      `列表 ${listTitleTop}px / 详情 ${detailTitleTop}px`,
    )
    const detail = await textOf(page)
    check('团信息只有创建时间（无成立时间）', detail.includes('创建时间') && !detail.includes('成立时间'))
    // 所在地：省 · 市 · 区（县）；直辖市省=市，只两级
    const placeRow = await page.evaluate(() => {
      const dts = Array.from(document.querySelectorAll('dl > div > dt'))
      // 口径：字段名是「所在地域」（2026-10-31 第三十二轮术语统一，「所在地」→「所在地域」）
      const hit = dts.find((d) => d.textContent?.trim() === '所在地域')
      return hit?.nextElementSibling?.textContent?.trim() ?? ''
    })
    const placeParts = placeRow.split(' · ').filter(Boolean)
    check('所在地域是省市区（直辖市两级）', placeParts.length >= 2, placeRow)
    check('所在地不重复（直辖市省=市只显示一次）', !/(.+?) · \1 ·/.test(placeRow), placeRow)
    check('有【关于】段落', detail.includes('关于'))
    // 运行状态（第三十五轮）：切换开关收在页头的「编辑资料」弹窗里，
    // 详情页本身只显示状态文字——所以这两项要进弹窗里看。
    await page.getByRole('button', { name: /编辑资料/ }).click()
    await page.waitForTimeout(800)
    const profileDialog = page.locator('[data-slot="dialog-content"]').first()
    const dialogText = await profileDialog.innerText().catch(() => '')
    // 展开「运行状态」下拉，看它到底有哪两态
    await profileDialog.locator('[data-slot="select-trigger"]').first().click()
    await page.waitForTimeout(500)
    const statusOptions = await page.locator('[role="option"]').allInnerTexts()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    check(
      '状态是运行中 / 解散两态',
      statusOptions.includes('运行中') && statusOptions.includes('解散'),
      statusOptions.join('、'),
    )
    check(
      '切换开关紧跟在「状态」后面',
      /运行状态[\s\S]{0,8}运行中/.test(dialogText),
      dialogText.slice(Math.max(0, dialogText.indexOf('运行状态')), dialogText.indexOf('运行状态') + 40),
    )
    check('没有单独的「状态管理」块', !detail.includes('状态管理'))
    check('团长转移没有文字描述', !detail.includes('团长因个人原因'))
    check('团长转移是一行（没有有效期选择）', !detail.includes('有效期 3 天') && detail.includes('复制转移链接'))
    check('没有有效期文案', !detail.includes('有效期') && !detail.includes('至 20'))
    // 行顺序：按卡片分组——团信息卡第一行是状态，团长卡第一行是团长转移
    const cardRows = await page.evaluate(() =>
      Array.from(document.querySelectorAll('dl')).map(
        (dl) => Array.from(dl.querySelectorAll(':scope > div > dt')).map((d) => d.textContent?.trim() ?? ''),
      ),
    )
    check('团信息卡第一行是状态', cardRows[0]?.[0] === '状态', (cardRows[0] ?? []).join(' → '))
    check(
      '团长卡第一行是团长转移、后面跟着姓名',
      cardRows[1]?.[0] === '团长转移' && cardRows[1]?.[1] === '姓名',
      (cardRows[1] ?? []).join(' → '),
    )
    // 卡片里的每一行都该是同一套节奏：标签左、值右、各自带一条分隔线
    const rowRhythm = await page.evaluate(() => {
      const dts = Array.from(document.querySelectorAll('dl dt'))
      return dts.map((dt) => {
        const row = dt.parentElement as HTMLElement
        return {
          标签: dt.textContent?.trim() ?? '',
          有下划线: Boolean(row.className.includes('border-b')),
          同一行: row.className.includes('justify-between'),
        }
      })
    })
    check(
      '卡片每一行都是同一套节奏（标签左值右 + 分隔线）',
      rowRhythm.length > 0 && rowRhythm.every((r) => r.有下划线 && r.同一行),
      JSON.stringify(rowRhythm.filter((r) => !r.有下划线 || !r.同一行)),
    )
    check('团信息卡不重复列团名与类别', !/团名 /.test(detail) && !/类别 /.test(detail))
    check('类别无英文', !['GO Mulan', 'A-Idol', 'Homestay Manager', 'Wind Rider'].some((x) => detail.includes(x)))
    check('活动标题带数量', /活动（\d+）/.test(detail), detail.slice(0, 60))
    check('活动区不再重复「N 次活动」', !detail.includes('次活动'))
    check('团长卡没有所在地 / 项目类别', !detail.includes('项目类别'))
  }

  section('工作台：邀请注册页')
  const enNames2 = ['GO Mulan', 'A-Idol', 'Homestay Manager', 'Wind Rider']
  // 建团：问所在地域与项目类别（字段名是「所在地域」，见 2026-10-31 第三十二轮术语统一）
  await page.goto(`${WORK}/join?token=MULAN-8F3K2`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const createJoin = await textOf(page)
  check('建团页有所在地域与项目类别', createJoin.includes('所在地域') && createJoin.includes('项目类别'))
  check('注册页无英文类别名', !enNames2.some((x) => createJoin.includes(x)))
  check('建团页说明「接下来会发生什么」', createJoin.includes('接下来会发生什么'))

  // 团长转移：只问人，不问团的事
  let transferToken = ''
  if (circleHref) {
    await page.goto(`${WORK}${circleHref}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    await page.locator('button:has-text("复制转移链接")').click()
    await page.waitForTimeout(2000)
    const link = String(await page.evaluate(() => navigator.clipboard.readText().catch(() => '')))
    // ⚠️ 剪贴板读不到时（无头环境偶发返回空串）**不能**直接 `new URL(link)`：
    // 空串会抛 ERR_INVALID_URL，把这行之后三十多项检查全带崩（2026-11-04 崩过两次）。
    // 读不到就当没拿到 token，交给下面那条断言报错即可。
    transferToken = link ? (new URL(link).searchParams.get('token') ?? '') : ''
  }
  check('能拿到团长转移链接', Boolean(transferToken), transferToken)
  if (transferToken) {
    await page.goto(`${WORK}/join?token=${transferToken}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    const transferJoin = await textOf(page)
    check('转移页不问所在地', !transferJoin.includes('省 / 自治区 / 直辖市'))
    check('转移页不问项目类别', !transferJoin.includes('项目类别\n'))
    check('转移页展示要接管的团', transferJoin.includes('你要接管的团'))
    check(
      '「你要接管的团」后面带项目类别',
      transferJoin.includes('你要接管的团 · '),
      transferJoin.slice(0, 60),
    )
    check('转移页无英文类别名', !enNames2.some((x) => transferJoin.includes(x)))
    // 有效期：截止时间 + 剩余时间（每秒走一格）
    check('显示有效期截止时间', transferJoin.includes('有效期至'), transferJoin.slice(0, 80))
    check('显示剩余时间', transferJoin.includes('剩余 '), transferJoin.slice(0, 80))
    const remainLocator = page.locator('text=/剩余/').first()
    const remain1 = await remainLocator.innerText()
    await page.waitForTimeout(1600)
    const remain2 = await remainLocator.innerText()
    check('剩余时间每秒在走', remain1 !== remain2, `${remain1} → ${remain2}`)
  }
  // 失效链接：给一张专门的卡片
  await page.goto(`${WORK}/join?token=NOT-A-REAL-TOKEN`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const deadJoin = (await textOf(page)).trim()
  check('失效链接只提示一句话', deadJoin === '链接不存在或已失效', deadJoin.slice(0, 40))

  section('工作台：资源页')
  await page.goto(`${WORK}/resources`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const assetsPage = await textOf(page)
  check('资源页没有废话描述', !assetsPage.includes('不用登录就能看'), assetsPage.slice(0, 60))
  check('资源页的类型只有文档 / 视频', /文档/.test(assetsPage) && /视频/.test(assetsPage))
  check('资源清单用表格呈现', (await page.locator('table tbody tr').count()) > 0)
  check(
    '上传收在弹窗里（页面本身没有长表单）',
    (await page.locator('input[type="file"]').count()) === 0,
  )
  // 清单是表格：每行"类型"列只能是 文档 / 视频
  const typeBadges = await page.evaluate(() =>
    Array.from(document.querySelectorAll('tbody tr')).map(
      (tr) => tr.querySelectorAll('td')[2]?.textContent?.trim() ?? '',
    ),
  )
  check(
    '资源列表的类型徽标只有文档 / 视频',
    typeBadges.length > 0 && typeBadges.every((t) => t === '文档' || t === '视频'),
    typeBadges.join('、'),
  )

  section('工作台：权限边界')
  // 旧的「我的互助团」页已丢弃：那条路由没有了（未上线，不留兼容跳转）
  const mineResp = await page.goto(`${WORK}/circles/mine`, { waitUntil: 'domcontentloaded' })
  check('旧的「我的互助团」页已丢弃（404）', mineResp?.status() === 404, `实际 ${mineResp?.status()}`)
  await page.goto(`${WORK}/resources`, { waitUntil: 'domcontentloaded' })
  const assets = await textOf(page)
  check('项目组能看到资源页', assets.length > 80)
  const createBtn = await page.locator('a[href*="/activities/new"], button:has-text("发起活动")').count()
  check('项目组没有「发起活动」入口', createBtn === 0, `找到 ${createBtn} 个`)

  // 退出，换团长（活动列表已并入工作台首页）
  await logout(page)
  await login(page, 'lead@mulan.org', 'Mulan@2026')
  await page.goto(`${WORK}/`, { waitUntil: 'domcontentloaded' })
  const leadCreate = await page.locator('a:has-text("发起活动"), button:has-text("发起活动")').count()
  check('团长能看到「发起活动」入口', leadCreate > 0, `找到 ${leadCreate} 个`)
  const leadAssets = await page.goto(`${WORK}/resources`, { waitUntil: 'domcontentloaded' })
  check('团长访问 /resources 被挡回首页', !page.url().includes('/resources'), page.url())
  check('团长看不到资源页内容', !/上传资源/.test(await textOf(page)))

  // 团长点「我的互助团」→ 进的是**团详情页**（和别的团一样），不是单独的旧页
  await page.goto(`${WORK}/circles`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const mineHref = await page
    .locator('a:has-text("我的互助团")')
    .first()
    .getAttribute('href')
    .catch(() => null)
  check(
    '「我的互助团」指向团详情页',
    Boolean(mineHref && /^\/circles\/[a-z0-9]{14}$/.test(mineHref)),
    `实际 ${mineHref}`,
  )
  if (mineHref) {
    await page.goto(`${WORK}${mineHref}`, { waitUntil: 'domcontentloaded' })
    const minePage = await textOf(page)
    check('团详情页有「团信息」与「团长」两块', minePage.includes('团信息') && minePage.includes('团长'))
    check('团详情页有活动区', /活动（\d+）/.test(minePage))
  }

  section('工作台：活动链路的网址')
  await page.goto(`${WORK}/`, { waitUntil: 'networkidle' })
  const actHref = await page.locator('a[href^="/activities/"]').first().getAttribute('href')
  if (actHref) {
    const seg = actHref.split('/').pop() ?? ''
    check('活动网址用随机串做标识', /^[a-z0-9]{14}$/.test(seg), `实际 ${actHref}`)
  } else {
    check('活动列表有详情链接', false, '活动列表页没有 /activities/ 链接')
  }

  section('工作台：活动链路（团长发起）')
  // 只清理**本次运行、由这个团长**新建的草稿：按创建时间 + 发起人圈定，
  // 别的团（团长看不到的）草稿一条都不碰
  const runStartedAt = new Date(Date.now() - 1000).toISOString()
  const leadId: string = await page.evaluate(async () => {
    const me = await fetch('/api/users/me').then((r) => r.json())
    return String(me?.user?.id ?? '')
  })
  await page.goto(`${WORK}/`, { waitUntil: 'domcontentloaded' })
  await page.locator('a:has-text("发起活动"), button:has-text("发起活动")').first().click()
  await page.waitForURL(/\/activities\/[a-z0-9]{14}/, { timeout: 20000 })
  const actUrl = page.url()
  check('发起活动直接落到活动详情页', /\/activities\/[a-z0-9]{14}/.test(actUrl), actUrl)
  const actText = await textOf(page)
  check('活动页有「一 活动申请」区', /活动申请/.test(actText))
  check('活动页不含「基金会付款」环节', !/基金会付款/.test(actText))

  // 业务账号不能经 REST 直接改 / 删内部数据（写入只走服务端动作，REST 只给后台账号）
  const restWrite = await page.evaluate(async (url) => {
    const id = url.split('/').pop()
    const list = await fetch(`/api/activity-plans?where[slug][equals]=${id}&depth=0`).then((r) => r.json())
    const planId = list?.docs?.[0]?.id
    const patch = await fetch(`/api/activity-plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    return patch.status
  }, actUrl)
  check('团长不能经 REST 把自己的方案改成「已通过」', restWrite === 403, `实际 ${restWrite}`)

  // ---------------------------------------------------------------- CMS 域
  // 清理：验收会建空草稿，把本次运行新增的**全部**删掉，别把演示态弄脏。
  // 内部数据的 REST 删除只开给后台账号，所以在 CMS 域用 ops 账号删。
  await logout(page)
  await page.goto(`${CMS}/admin/login`, { waitUntil: 'domcontentloaded' })
  const cleaned = await page.evaluate(
    async ({ since, proposer }) => {
      await fetch('/api/ops-users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ops@mulan.org', password: 'Mulan@2026' }),
      })
      const q = new URLSearchParams({
        'where[and][0][status][equals]': 'draft',
        'where[and][1][createdAt][greater_than_equal]': since,
        'where[and][2][proposer][equals]': proposer,
        limit: '100',
        depth: '0',
      })
      const list = await fetch(`/api/activity-plans?${q}`).then((r) => r.json())
      const fresh = list?.docs ?? []
      for (const doc of fresh) {
        await fetch(`/api/activity-plans/${doc.id}`, { method: 'DELETE' })
      }
      await fetch('/api/ops-users/logout', { method: 'POST' })
      return fresh.length
    },
    { since: runStartedAt, proposer: leadId },
  )
  check('验收产生的空草稿已清理', cleaned >= 1, `清掉 ${cleaned} 条`)
  check('一次点击只建一条空草稿（没有双建）', cleaned === 1, `本次建了 ${cleaned} 条`)

  section('CMS 域（admin.localhost）')
  await page.goto(`${CMS}/admin`, { waitUntil: 'domcontentloaded' })
  // CMS 后台是客户端渲染：等登录框真的出现（dev server 重启后首次编译可能超过 1.5 秒）
  await page
    .locator('input[name="email"], input[type="password"]')
    .first()
    .waitFor({ state: 'attached', timeout: 20000 })
    .catch(() => undefined)
  const cmsInputs = await page.locator('input[name="email"], input[type="password"]').count()
  check('CMS 后台登录页可打开', cmsInputs > 0, `找到 ${cmsInputs} 个登录输入框`)
  const cms = await textOf(page)
  check('CMS 后台没有登出按钮', !/登出|Logout|Sign out/i.test(cms))

  // 业务账号进不去 CMS
  //
  // ⚠️ 这条断言 2026-11-04 之前是**形同虚设**的：CMS 后台是客户端渲染，
  // 首次编译慢的时候登录框还没渲染出来，`emailInput` 为 0 → 整条被 `if` 跳过，
  // 于是「通过 N」里根本没有它（修好之前是 137 项，现在是 138 项）。
  // 现在改成：等登录框（最多 20 秒），等不到就算失败，不许静默跳过。
  //
  // 另外断言口径也要跟实际对：Payload 后台 UI 是**英文**的（项目没配 i18n），
  // 业务账号登录失败显示的是 "The email or password provided is incorrect."，
  // 原来的正则只认中文「无权 / 错误 / 登录」，所以一旦这条真的执行就会判失败。
  // 现在的判据 = ① 还停在登录页（没进后台）② 页面确实报了错。
  await page.goto(`${CMS}/admin/login`, { waitUntil: 'domcontentloaded' })
  await page
    .locator('input[name="email"]')
    .first()
    .waitFor({ state: 'attached', timeout: 20000 })
    .catch(() => undefined)
  const emailInput = await page.locator('input[name="email"]').count()
  if (emailInput) {
    await page.fill('input[name="email"]', 'admin@mulan.org')
    await page.fill('input[name="password"]', 'Mulan@2026')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2500)
    const after = await textOf(page)
    const stillLogin = /\/admin\/login/.test(page.url())
    const hasError = /无权|not allowed|错误|incorrect|invalid/i.test(after)
    check('项目组账号进不去 CMS 后台', stillLogin && hasError, `${page.url()} | ${after.slice(0, 60)}`)
  } else {
    check('项目组账号进不去 CMS 后台', false, 'CMS 登录框没渲染出来，这条没法验')
  }

  await browser.close()

  console.log(`\n${'─'.repeat(52)}`)
  console.log(`通过 ${pass} · 失败 ${fail}`)
  if (failures.length) {
    console.log('\n失败项：')
    failures.forEach((f) => console.log(`  · ${f}`))
  }
  process.exit(fail ? 1 : 0)
}

run().catch((err) => {
  console.error('验收脚本异常：', err)
  process.exit(1)
})
