import { chromium } from 'playwright'
const DIR = 'docs/验收截图'
const main = async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 } })
  const p = await ctx.newPage()

  // 公众站首页
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${DIR}/r14-01-公众站首页.png` })

  // 公众站互助团详情（中文团名 + 随机网址）
  const circleHref = await p.locator('a[href^="/circles/"]').first().getAttribute('href')
  await p.goto(`http://localhost:3000${circleHref}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${DIR}/r14-02-公众站互助团详情.png` })

  // 公众站资料详情（中文标题 + 随机网址）
  await p.goto('http://localhost:3000/resources', { waitUntil: 'networkidle' })
  const resHref = await p.locator('a[href^="/resources/"]').first().getAttribute('href')
  await p.goto(`http://localhost:3000${resHref}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${DIR}/r14-03-公众站资料详情.png` })

  // 工作台：登录 → 首页统计
  await p.goto('http://connect.localhost:3000/login', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  await p.fill('input[type="email"]', 'admin@mulan.org')
  await p.fill('input[type="password"]', 'Mulan@2026')
  await p.click('button[type="submit"]')
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${DIR}/r14-04-工作台首页统计.png` })

  // 工作台：活动详情（中文活动名 + 地址标识）
  await p.goto('http://connect.localhost:3000/activities', { waitUntil: 'networkidle' })
  const actHref = await p.locator('a[href^="/activities/"]').first().getAttribute('href')
  await p.goto(`http://connect.localhost:3000${actHref}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${DIR}/r14-05-工作台活动详情.png` })

  // 工作台：互助团（地图 + 类别筛选 + 右侧全部列表）
  await p.goto('http://connect.localhost:3000/circles', { waitUntil: 'networkidle' })
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${DIR}/r14-07-工作台互助团.png` })

  // 工作台：互助团详情
  await p.goto('http://connect.localhost:3000/circles', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  const wsCircleHref = await p.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href^="/circles/"]')).find((el) =>
      /^\/circles\/[a-z0-9]{14}$/.test((el as HTMLAnchorElement).getAttribute('href') ?? ''),
    )
    return a ? (a as HTMLAnchorElement).getAttribute('href') : null
  })
  if (wsCircleHref) {
    await p.goto(`http://connect.localhost:3000${wsCircleHref}`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(1500)
    await p.screenshot({ path: `${DIR}/r14-10-工作台团详情.png` })
  }

  // 工作台：全部互助团名录
  await p.goto('http://connect.localhost:3000/circles/all', { waitUntil: 'networkidle' })
  await p.waitForTimeout(2000)
  await p.screenshot({ path: `${DIR}/r14-08-工作台全部互助团.png` })

  await b.close()
  console.log('截图完成')
}
main()
