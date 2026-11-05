/**
 * 活动申请「版本追溯」专项验收（只能对**副本库**跑：会改一条活动的状态与版本）。
 *
 * 1. 纯函数：snapshotOf / diffSnapshots / planHistory 的口径；
 * 2. 页面：造一条"第 1 版被驳回 → 改了预算与人数 → 第 2 版待审核"的活动，
 *    项目组打开活动详情，处理面板提示「第 2 版」、文档里有逐项对比表；团长那边同样看得到版本记录。
 *
 * 用法：DATABASE_URI=<副本库> npx tsx --env-file-if-exists=.env scripts/verify-versions.ts
 * （dev 服务器也要连同一个副本库）
 */
import '../src/lib/seed-env'

import { chromium } from 'playwright'
import { getPayload } from 'payload'
import config from '@payload-config'

import { diffSnapshots, planHistory, snapshotOf } from '../src/lib/plan-versions'

if (!/mulan_verify/.test(process.env.DATABASE_URI ?? '')) {
  console.error('只能对副本库（mulan_verify）跑这个脚本')
  process.exit(1)
}

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass += 1
  else fail += 1
  console.log(`  ${ok ? '✅' : '❌'} ${name}${ok || !detail ? '' : ` — ${detail}`}`)
}

console.log('▌纯函数')
const v1 = snapshotOf({
  theme: 'AI 共学',
  kind: 'AI素养类',
  form: 'offline',
  plannedAt: '2026-11-10T00:00:00.000Z',
  location: '社区中心',
  participants: 15,
  budgetItems: [
    { category: '物料', item: '文具', description: '马克笔', amount: 100, note: '' },
    { category: '餐饮', item: '茶歇', description: '水果', amount: 300, note: '' },
  ],
})
const v2 = { ...v1, participants: 20, budgetItems: [v1.budgetItems[0], { ...v1.budgetItems[1], amount: 200 }], budgetTotal: 300 }
const changes = diffSnapshots(v1, v2)
check('人数变化被识别', changes.some((c) => c.field === '预计参与人数' && c.before === '15 人' && c.after === '20 人'))
check('预算明细金额变化被识别', changes.some((c) => c.field.includes('茶歇') && c.before.includes('300') && c.after.includes('200')))
check('预算合计变化被识别', changes.some((c) => c.field === '预算合计'))
check('没改的字段不出现', !changes.some((c) => c.field === '活动主题'))
const legacy = planHistory({ status: 'approved', submittedAt: '2026-10-01T00:00:00Z', reviews: [{ action: 'approved', at: '2026-10-02T00:00:00Z' }], theme: 'x' })
check('旧数据（无快照）补出第 1 版，审批记录归到第 1 版', legacy.length === 1 && legacy[0].reviews.length === 1)

console.log('▌页面')
const payload = await getPayload({ config })
const plan: any = (
  await payload.find({ collection: 'activity-plans', limit: 1, depth: 0, overrideAccess: true, sort: 'id' })
).docs[0]
const admin: any = (
  await payload.find({ collection: 'users', where: { email: { equals: 'admin@mulan.org' } }, limit: 1, overrideAccess: true })
).docs[0]
const now = Date.now()
const iso = (offsetMin: number) => new Date(now + offsetMin * 60_000).toISOString()
await payload.update({
  collection: 'activity-plans',
  id: plan.id,
  overrideAccess: true,
  data: {
    status: 'submitted',
    versions: [
      { no: 1, submittedAt: iso(-60), submitterName: '团长', snapshot: { ...snapshotOf(plan), participants: 12 } },
      { no: 2, submittedAt: iso(-5), submitterName: '团长', snapshot: { ...snapshotOf(plan), participants: 20 } },
    ],
    reviews: [{ reviewer: admin.id, reviewerName: admin.name, action: 'rejected', comment: '人数太少', at: iso(-30), version: 1 }],
  },
} as any)

const browser = await chromium.launch()
const page = await browser.newPage()
const login = async (email: string) => {
  await page.context().clearCookies()
  await page.goto('http://connect.localhost:3000/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', 'Mulan@2026')
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 })
}
await login('admin@mulan.org')
await page.goto(`http://connect.localhost:3000/activities/${plan.slug}`, { waitUntil: 'networkidle' })
const text = await page.locator('body').innerText()
check('处理面板提示「第 2 版申请」', text.includes('这是第 2 版申请'), text.slice(0, 80))
check('文档里有「版本与审核记录」', text.includes('版本与审核记录'))
check('逐项对比：预计参与人数 12 → 20', /预计参与人数\s*12 人\s*20 人/.test(text))
check('第 1 版的审核结论是「审核不通过」', text.includes('人数太少'))
await login('lead@mulan.org')
await page.goto(`http://connect.localhost:3000/activities/${plan.slug}`, { waitUntil: 'networkidle' })
const leadText = await page.locator('body').innerText()
check('团长也看得到版本记录', leadText.includes('第 2 版') && leadText.includes('第 1 版'))
await browser.close()

console.log(`\n通过 ${pass} · 失败 ${fail}`)
process.exit(fail ? 1 : 0)
