/**
 * 验收后还原演示态：把邀请链接恢复为可用，删掉验收新注册的账号，
 * 并把验收期间新建 / 换过团长的互助团还原（新建的删掉，被接管的还回上一任团长）。
 * 运行：npx tsx --env-file-if-exists=.env scripts/restore-demo.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { INVITE_VALID_MS } from '../src/lib/invitation'

const CODE = process.env.SEED_INVITE_CODE ?? 'MULAN-8F3K2'
/** 验收时用来注册的邮箱（可多个，逗号分隔） */
const TEST_EMAILS = (process.env.TEST_EMAILS ?? 'new.sister@mulan.org,transfer.test@mulan.org')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const payload = await getPayload({ config })

// 1. 收集验收注册的账号（先记下 id——后面还原团的时候要用）
const testUserIds = new Set<number | string>()
const users = await payload.find({
  collection: 'users',
  where: { email: { in: TEST_EMAILS } },
  limit: 50,
  overrideAccess: true,
})
for (const u of users.docs as any[]) {
  testUserIds.add(u.id)
}
const newleaderUsers = await payload.find({
  collection: 'users',
  where: { email: { contains: 'newleader' } },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})
for (const u of newleaderUsers.docs as any[]) {
  testUserIds.add(u.id)
}

// 2. 邀请链接恢复为可用
//
// ⚠️ 2026-11-04：原来只把 `status` 改回 active、**没重置 `expiresAt`**——
//    演示邀请码的有效期只有 7 天，过期后 `lookupInvitation` 会把它置成 `expired`，
//    于是「还原演示态」还原不回来：/join 一直显示「链接不存在或已失效」，
//    验收脚本的「建团页」两条会一直失败。
//    现在**同时重置有效期**（从现在起再给 7 天，与种子脚本同一口径）。
const invites = await payload.find({
  collection: 'invitation-links',
  where: { token: { equals: CODE } },
  limit: 1,
  overrideAccess: true,
})
for (const inv of invites.docs) {
  const expiresAt = new Date(Date.now() + INVITE_VALID_MS).toISOString()
  await payload.update({
    collection: 'invitation-links',
    id: inv.id,
    data: {
      status: 'active',
      usedBy: null,
      usedAt: null,
      expiresAt,
    },
    overrideAccess: true,
  })
  console.log('邀请链接已恢复可用：', CODE, '（有效期重置到', expiresAt, '）')
}

// 3. 清掉验收过程产生的临时记录（方案 / 反馈 / 报销 / 付款 / 精选发布）
// 3. 清验收期间产生的活动闭环记录
//
// ⚠️ 不能按每个集合的文案关键词各删各的：反馈的 summary 里未必带"验收"字样
// （勾选框脚本写的是"…完成了一次完整闭环回归…"），方案一删就会撞
// SQLITE_CONSTRAINT_NOTNULL（activity_reports.plan_id 外键不级联）。
// 所以先按**方案 ID**把依赖收齐，再按外键顺序删。
const testPlanRows = await payload.find({
  collection: 'activity-plans',
  where: { title: { contains: '验收' } },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})
const legacyPlanRows = await payload.find({
  collection: 'activity-plans',
  where: { title: { like: '%acceptance%' } },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})
const componentPlanRows = await payload.find({
  collection: 'activity-plans',
  where: { title: { contains: '组件库回归' } },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})
const gatePlanRows = await payload.find({
  collection: 'activity-plans',
  where: { title: { contains: '闸门验证' } },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})
// sop-check.js 造的活动：标题「SOP 要素核对 <时间戳>」
const sopPlanRows = await payload.find({
  collection: 'activity-plans',
  where: { title: { contains: 'SOP 要素核对' } },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})
const testPlanIds = [
  ...testPlanRows.docs,
  ...legacyPlanRows.docs,
  ...componentPlanRows.docs,
  ...gatePlanRows.docs,
  ...sopPlanRows.docs,
].map((p: any) => p.id)

if (testPlanIds.length) {
  // 外键顺序：付款 → 报销 → 反馈 → 精选 → 方案
  const testReimbursements = await payload.find({
    collection: 'reimbursements',
    where: { plan: { in: testPlanIds } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  const reimbursementIds = testReimbursements.docs.map((r: any) => r.id)
  if (reimbursementIds.length) {
    const testPayments = await payload.find({
      collection: 'payments',
      where: { reimbursement: { in: reimbursementIds } },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    for (const payment of testPayments.docs as any[]) {
      await payload.delete({ collection: 'payments', id: payment.id, overrideAccess: true })
    }
    console.log(`已清理 payments 中 ${testPayments.docs.length} 条验收记录`)
  }
  for (const id of reimbursementIds) {
    await payload.delete({ collection: 'reimbursements', id, overrideAccess: true })
  }
  if (reimbursementIds.length) {
    console.log(`已清理 reimbursements 中 ${reimbursementIds.length} 条验收记录`)
  }

  const testReports = await payload.find({
    collection: 'activity-reports',
    where: { plan: { in: testPlanIds } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  for (const report of testReports.docs as any[]) {
    await payload.delete({ collection: 'activity-reports', id: report.id, overrideAccess: true })
  }
  if (testReports.docs.length) {
    console.log(`已清理 activity-reports 中 ${testReports.docs.length} 条验收记录`)
  }

  const testPublications = await payload.find({
    collection: 'publications',
    where: { relatedPlan: { in: testPlanIds } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  for (const pub of testPublications.docs as any[]) {
    await payload.delete({ collection: 'publications', id: pub.id, overrideAccess: true })
  }
  if (testPublications.docs.length) {
    console.log(`已清理 publications 中 ${testPublications.docs.length} 条验收记录`)
  }

  for (const id of testPlanIds) {
    await payload.delete({ collection: 'activity-plans', id, overrideAccess: true })
  }
  console.log(`已清理 activity-plans 中 ${testPlanIds.length} 条验收记录`)
}

// 4. 清掉"提名 → 发布"产生的精选，并把反馈恢复成待发布状态
const nominated = await payload.find({
  collection: 'publications',
  where: { slug: { contains: '-report-' } },
  limit: 50,
  depth: 1,
  overrideAccess: true,
})
for (const pub of nominated.docs as any[]) {
  const reportId = pub.relatedReport?.id ?? pub.relatedReport
  await payload.delete({ collection: 'publications', id: pub.id, overrideAccess: true })
  if (reportId) {
    await payload.update({
      collection: 'activity-reports',
      id: reportId,
      data: { publishedAs: null, recommendedForPublish: true },
      overrideAccess: true,
    })
  }
  console.log(`已清理提名发布的精选：${pub.slug}`)
}

// 5. 删掉已废弃的别名账号（系统未上线，不留兼容别名）
const aliasUsers = await payload.find({
  collection: 'users',
  where: { email: { equals: 'leader@mulan.org' } },
  limit: 10,
  depth: 0,
  overrideAccess: true,
})
for (const user of aliasUsers.docs as any[]) {
  await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
  console.log('已清理别名账号：leader@mulan.org')
}

// 6. 清掉验收过程新建 / 换过团长的互助团
//
// ⚠️ 别再按 slug 前缀猜了：地址标识已经改成不透明随机串（14 位），
// 靠 slug 认不出哪些是验收建的。改看**团长是谁**——
// 团长是验收账号的团，要么是验收时新建的（删掉），
// 要么是验收时被人接管的（把团长还给上一任）。
const allCohorts = await payload.find({
  collection: 'cohorts',
  limit: 1000,
  depth: 1,
  overrideAccess: true,
})
for (const cohort of allCohorts.docs as any[]) {
  const leaderId =
    typeof cohort.leader === 'object' && cohort.leader ? cohort.leader.id : cohort.leader
  if (!testUserIds.has(leaderId)) continue

  const terms = (cohort.leaderTerms ?? []) as any[]
  const sorted = [...terms].sort(
    (a, b) => new Date(a.from).getTime() - new Date(b.from).getTime(),
  )
  const previous = sorted.filter((t: any) => t.to).slice(-1)[0]
  const previousLeaderId =
    typeof previous?.user === 'object' && previous?.user ? previous.user.id : previous?.user

  if (previousLeaderId) {
    // 接管来的团：把团长还给上一任，重新打开他的任期，删掉验收账号的任期
    await payload.update({
      collection: 'cohorts',
      id: cohort.id,
      data: {
        leader: previousLeaderId,
        leaderTerms: sorted
          .filter((t: any) => {
            const uid = typeof t.user === 'object' && t.user ? t.user.id : t.user
            return uid !== leaderId
          })
          .map((t: any) => ({
            user: typeof t.user === 'object' && t.user ? t.user.id : t.user,
            from: t.from,
            to: t.to ?? null,
          })),
      } as any,
      overrideAccess: true,
    })
    console.log(`已把团长还给上一任：${cohort.name}`)
  } else {
    // 验收时新建的团：整个删掉
    await payload.delete({ collection: 'cohorts', id: cohort.id, overrideAccess: true })
    console.log(`已清理验收互助团：${cohort.name}`)
  }
}

// 6.1 清掉验收期间注册出来的账号
//
// ⚠️ 必须**先删任期行、再删账号**：Payload 删账号时会去解除关系，
// 而 `cohorts_leader_terms.user_id` 是 NOT NULL —— 解除关系等于把它置空，
// 直接触发 NOT NULL 约束，删不掉。
// 这类"删关系行"的活儿 Payload 干不了，用数据库连接池直连 SQL 绕过它的钩子。
const pool = (payload.db as any).pool
for (const userId of testUserIds) {
  await pool.query('delete from cohorts_leader_terms where user_id = $1', [userId])
}

for (const userId of testUserIds) {
  await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
  console.log('已清理验收账号：', userId)
}

// 6.2 清掉调试残留（标题含"调试"或"越权测试"）与验收期间生成的邀请链接
const debugPlans = await payload.find({
  collection: 'activity-plans',
  where: {
    or: [
      { title: { contains: '调试' } },
      { title: { contains: '越权测试' } },
      { title: { contains: '团长起草测试' } },
      { title: { contains: '团长草稿测试' } },
      { title: { contains: '测试活动' } },
      { title: { contains: '未命名活动' } },
    ],
  },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})
for (const plan of debugPlans.docs as any[]) {
  await payload.delete({ collection: 'activity-plans', id: plan.id, overrideAccess: true })
  console.log(`已清理调试活动：${plan.title}`)
}

// 验收脚本在「一次点击只建一条空草稿」那项里会复制一份种子活动当草稿
// （标题是「AI 工具共学工作坊（第 4 期）」），它自己是清不掉的——
// restore-demo 的关键词里没有它。种子那条是「第 3 期」且状态是 implemented，
// 所以这里按「标题前缀 + 状态是草稿」来认，不会误删种子数据。
const draftCopies = await payload.find({
  collection: 'activity-plans',
  where: {
    and: [
      { title: { contains: 'AI 工具共学工作坊（第' } },
      { status: { equals: 'draft' } },
    ],
  },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})
for (const plan of draftCopies.docs as any[]) {
  await payload.delete({ collection: 'activity-plans', id: plan.id, overrideAccess: true })
  console.log(`已清理验收草稿副本：${plan.title}`)
}

const testLinks = await payload.find({
  collection: 'invitation-links',
  where: { token: { not_equals: CODE } },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})
for (const link of testLinks.docs as any[]) {
  await payload.delete({ collection: 'invitation-links', id: link.id, overrideAccess: true })
  console.log(`已清理测试邀请链接：${link.token}`)
}

// 7. 核对团长任期（一个团一个团长，任期区间要连续）
const cohorts = await payload.find({ collection: 'cohorts', limit: 500, depth: 0, overrideAccess: true })
for (const c of cohorts.docs as any[]) {
  const terms = c.leaderTerms ?? []
  const open = terms.filter((t: any) => !t.to).length
  if (open !== 1) console.log(`⚠️ 团「${c.name}」在任团长数 = ${open}（应为 1）`)
}

process.exit(0)
