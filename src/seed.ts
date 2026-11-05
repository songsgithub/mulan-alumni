import './lib/seed-env' // 必须最先执行：让 Payload 以 production 模式初始化，避免与迁移后的 schema 冲突

import { getPayload } from 'payload'
import config from '@payload-config'

import { deterministicCode } from './lib/code'
import { DEFAULT_EXPENSE_CATEGORIES } from './lib/budget'
import { pdfAttachment, solidPng, textAttachment } from './lib/demo-assets'
import { seedLibrary, seedShowcase } from './seed/showcase'
import { bulletList, editorState, heading, paragraph, text } from './lib/lexical'

/**
 * 演示数据：项目组账号、互助团、成员邀请、学习资源、精选发布、一条走完全流程的活动。
 * 运行：npm run seed
 */

const PROJECT_TEAM_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mulan.org'
const PROJECT_TEAM_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Mulan@2026'
const INVITE_CODE = process.env.SEED_INVITE_CODE ?? 'MULAN-8F3K2'
/** 团长邮箱 */
const LEAD_EMAIL = process.env.SEED_LEAD_EMAIL ?? 'lead@mulan.org'
/** 后台账号（运维 / 技术负责人）：Payload CMS 后台的唯一登录源，与业务账号分离 */
const OPS_EMAIL = process.env.SEED_OPS_EMAIL ?? 'ops@mulan.org'
const OPS_PASSWORD = process.env.SEED_OPS_PASSWORD ?? 'Mulan@2026'

type PayloadClient = Awaited<ReturnType<typeof getPayload>>

async function upsertUser(
  payload: PayloadClient,
  email: string,
  password: string,
  data: Record<string, unknown>,
) {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length) {
    return existing.docs[0]
  }
  return payload.create({
    collection: 'users',
    data: { email, password, ...data } as any,
    overrideAccess: true,
  })
}

/** 后台账号（ops-users 集合）：只给运维，与业务账号不同表 */
async function upsertOpsUser(
  payload: PayloadClient,
  email: string,
  password: string,
  data: Record<string, unknown>,
) {
  const existing = await payload.find({
    collection: 'ops-users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length) return existing.docs[0]
  return payload.create({
    collection: 'ops-users',
    data: { email, password, ...data } as any,
    overrideAccess: true,
  })
}

/** 上传公共媒体（封面 / 活动照片 / 学习资料附件） */
async function uploadMedia(
  payload: PayloadClient,
  filename: string,
  data: Buffer,
  mimeType: string,
  alt: string,
) {
  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length) return existing.docs[0]

  return payload.create({
    collection: 'media',
    data: { filename, alt, visibility: 'public' } as any,
    file: { data, mimetype: mimeType, name: filename, size: data.length },
    overrideAccess: true,
  })
}

/** 上传财务凭证（发票 / 收据） */
async function uploadEvidence(
  payload: PayloadClient,
  filename: string,
  data: Buffer,
  cohortId: number | string,
  kind = 'receipt',
  mimetype = 'application/pdf',
) {
  const existing = await payload.find({
    collection: 'finance-evidence',
    where: { filename: { equals: filename } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length) return existing.docs[0]

  return payload.create({
    collection: 'finance-evidence',
    data: { filename, kind, cohort: cohortId } as any,
    file: { data, mimetype, name: filename, size: data.length },
    overrideAccess: true,
  })
}

export async function seed() {
  const payload = await getPayload({ config })

  console.log('→ 创建项目组账号')
  const admin = await upsertUser(payload, PROJECT_TEAM_EMAIL, PROJECT_TEAM_PASSWORD, {
    name: '项目组',
    roles: ['projectTeam'],
    program: 'other',
    region: {
      province: '浙江省',
      provinceCode: '330000',
      city: '杭州市',
      cityCode: '330100',
      district: '西湖区',
      districtCode: '330106',
    },
  })

  console.log('→ 创建后台账号（仅运维可登录 CMS 后台）')
  await upsertOpsUser(payload, OPS_EMAIL, OPS_PASSWORD, {
    name: '系统运维',
    note: '负责数据维护与线上问题处理；不承担业务审批。',
  })

  // 活动设置：预算上限 500 元、预计人数不少于 1 人；两个审核负责人都设为演示项目组账号
  // 费用类别清单：写入内置兜底清单（2026-11-01 第三十六轮从代码常量下沉到这里）
  console.log('→ 写入活动设置（预算上限 / 人数下限 / 审核负责人 / 费用类别）')
  await payload.updateGlobal({
    slug: 'activity-settings' as any,
    data: {
      budgetMax: 500,
      participantsMin: 1,
      planReviewer: admin.id,
      reimbursementReviewer: admin.id,
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
        category: cat.name,
        items: cat.items.map((item) => ({ item: item.name })),
      })),
    } as any,
    overrideAccess: true,
  })

  console.log('→ 创建团长账号')
  const lead = await upsertUser(payload, LEAD_EMAIL, 'Mulan@2026', {
    name: '林晓',
    roles: ['cohortLead'],
    program: 'a-idol',
    region: {
      province: '贵州省',
      provinceCode: '520000',
      city: '铜仁市',
      cityCode: '520600',
      district: '万山区',
      districtCode: '520603',
    },
    bio: 'AI 豆计划受益人，在万山做数字标注与运营。',
  })

  console.log('→ 创建互助团')
  // 网址里的那一段：不透明随机串。与 seed-network 的键一致（real-a-idol-520603-0），
  // 这样两个种子脚本指向同一个「万山」团，不会各建一个。
  const cohortSlug = deterministicCode('real-a-idol-520603-0')
  const existingCohort = await payload.find({
    collection: 'cohorts',
    where: { slug: { equals: cohortSlug } },
    limit: 1,
    overrideAccess: true,
  })
  const cohort =
    existingCohort.docs[0] ??
    (await payload.create({
      collection: 'cohorts',
      data: {
        name: '万山AI豆计划互助团',
        slug: cohortSlug,
        region: '贵州 · 铜仁',
        category: 'a-idol',
        location: {
          province: '贵州省',
          provinceCode: '520000',
          city: '铜仁市',
          cityCode: '520600',
          district: '万山区',
          districtCode: '520603',
        },
        theme: '在家门口做数字新职业',
        tags: [{ tag: 'AI 工具' }, { tag: '就业' }],
        leader: lead.id,
        status: 'active',
        isPublic: true,
        description: '万山区的姐妹一起在做AI豆计划。在家门口做数字新职业。',
      } as any,
      overrideAccess: true,
    }))

  console.log('→ 写入团长与任期')
  await payload.update({
    collection: 'cohorts',
    id: cohort.id,
    data: {
      leader: lead.id,
      leaderTerms: [{ user: lead.id, from: '2025-11-01T00:00:00.000Z', to: null }],
    } as any,
    overrideAccess: true,
  })

  console.log('→ 创建邀请链接')
  const inviteExists = await payload.find({
    collection: 'invitation-links',
    where: { token: { equals: INVITE_CODE } },
    limit: 1,
    overrideAccess: true,
  })
  const inviteData = {
    token: INVITE_CODE,
    purpose: 'create-cohort',
    email: 'new.sister@mulan.org',
    invitedBy: admin.id,
    // 自创建起 7×24 小时
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    note: '演示邀请链接',
  }
  if (!inviteExists.docs.length) {
    await payload.create({
      collection: 'invitation-links',
      data: inviteData as any,
      overrideAccess: true,
    })
  } else {
    // 已存在就刷成建团链接（旧的 join-cohort 用途已经没有了）
    await payload.update({
      collection: 'invitation-links',
      id: inviteExists.docs[0].id,
      data: inviteData as any,
      overrideAccess: true,
    })
  }

  console.log('→ 创建一条走完流程的活动（方案 → 反馈 → 报销 → 付款）')
  // 网址里的那一段：不透明随机串
  const planSlug = deterministicCode('activity:AI 工具共学工作坊（第 3 期）')
  const plans = await payload.find({
    collection: 'activity-plans',
    where: { slug: { equals: planSlug } },
    limit: 1,
    overrideAccess: true,
  })
  let plan = plans.docs[0]
  if (!plan) {
    plan = await payload.create({
      collection: 'activity-plans',
      data: {
        title: 'AI 工具共学工作坊（第 3 期）',
        slug: planSlug,
        cohort: cohort.id,
        proposer: lead.id,
        form: 'offline',
        theme: 'AI 工具共学工作坊（第 3 期）',
        plannedAt: new Date('2026-09-20').toISOString(),
        location: '万山 · 社区活动中心',
        participants: 18,
        // 《经费预算明细表》：一级类别以类目树为准（见 src/lib/budget.ts）；
        // 明细是**一整句手动写**的（第四十六轮：「费用项目 + 数量与规格」合并成一列）
        budgetItems: [
          { category: '活动场地与布置', item: '社区活动中心场地租赁 2 小时', description: '', amount: 240, note: '场地 2 小时' },
          { category: '活动物料与耗材', item: '横幅、桌牌与简历打印', description: '', amount: 140, note: '' },
          { category: '交通与差旅', item: '参与者往返地铁与公交', description: '', amount: 100, note: '参与者交通补助' },
        ],
        status: 'approved',
        applicantName: lead.name ?? '',
        submittedAt: new Date('2026-09-05').toISOString(),
        approvedAt: new Date('2026-09-07').toISOString(),
        reviews: [
          {
            reviewer: admin.id,
            reviewerName: admin.name ?? '',
            action: 'approved',
            comment: '交通补助（100 元）已核对参与者名单与票据规则，同意按 480 元执行。',
            at: new Date('2026-09-07').toISOString(),
          },
        ],
      } as any,
      overrideAccess: true,
    })
  }

  console.log('→ 上传活动照片与签到表')
  const photo1 = await uploadMedia(
    payload,
    'ai-workshop-3-group.jpg',
    solidPng(960, 640, [196, 120, 88]),
    'image/jpeg',
    '第 3 期工作坊全员合照',
  )
  const photo2 = await uploadMedia(
    payload,
    'ai-workshop-3-interaction.jpg',
    solidPng(960, 640, [212, 155, 120]),
    'image/jpeg',
    '第 3 期工作坊现场互动',
  )
  const photo3 = await uploadMedia(
    payload,
    'ai-workshop-3-workshop.jpg',
    solidPng(960, 640, [150, 130, 120]),
    'image/jpeg',
    '第 3 期工作坊小组共创现场',
  )
  // SOP 反馈表第八项：资金使用照片证明
  const spendingProof = await uploadMedia(
    payload,
    'ai-workshop-3-materials.jpg',
    solidPng(960, 640, [168, 146, 132]),
    'image/jpeg',
    '第 3 期工作坊物料与票据照片',
  )
  const signupSheet = await uploadMedia(
    payload,
    'ai-workshop-3-signup-sheet.txt',
    textAttachment('数字木兰校友会互助团活动签到表（第 3 期）', [
      '序号  姓名    工作单位        职位      签到',
      '1     林晓    万山某数字标注公司  运营专员  ✓',
      '2     周雨    万山某民宿      管家      ✓',
      '3     陈曦    万山某标注基地      标注员    ✓',
      '4     苏楠    万山某标注基地      标注员    ✓',
      '5     何佳    万山某民宿      管家      ✓',
    ]),
    'text/plain',
    '第 3 期工作坊签到表',
  )

  const reports = await payload.find({
    collection: 'activity-reports',
    where: { plan: { equals: plan.id } },
    limit: 1,
    overrideAccess: true,
  })
  let report = reports.docs[0]
  if (!report) {
    report = await payload.create({
      collection: 'activity-reports',
      data: {
        plan: plan.id,
        cohort: cohort.id,
        submittedBy: lead.id,
        theme: 'AI 工具共学工作坊（第 3 期）',
        location: '万山 · 社区活动中心',
        actualAt: new Date('2026-09-20').toISOString(),
        // 《活动反馈表》开展时间：YYYY年MM月DD日 HH:mm-HH:mm
        actualStart: '14:00',
        actualEnd: '16:00',
        // 实际参与人数 = 签到表里签到的人数（与下方 attendees 对齐）
        actualParticipants: 21,
        submittedAt: new Date('2026-09-23').toISOString(),
        summary:
          '21 位姐妹参与，完成了 3 个行业场景的 AI 工作流共创，15 人当场完成简历更新。',
        // 《活动反馈表》活动感受（字数不限）
        highlights:
          '用"真实业务样本 + 现场结对"的形式效果最好，建议固定成每期流程。\n第一次把 AI 用在民宿日常文案上，现场就做出了可以用的版本。',
        // 《经费支出明细表》：明细项 / 金额 / 凭证 / 备注（凭证在下方 reimbursement 环节上传后回填）
        expenseItems: [],
        attendees: [
          { name: '林晓', organization: '万山某数字标注公司', position: '运营专员', signed: true },
          { name: '周雨', organization: '万山某民宿', position: '管家', signed: true },
          // 其余签到人员（演示用，共 21 人签到，与实际参与人数一致）
          ...Array.from({ length: 19 }, (_, i) => ({
            name: `演示参与者 ${String(i + 1).padStart(2, '0')}`,
            organization: '',
            position: '',
            signed: true,
          })),
        ],
        photos: [photo1.id, photo2.id, photo3.id],
        status: 'accepted',
        // 团长提名：这条反馈值得公开给更多人看，项目组在「精选发布」里一键转成果
        recommendedNote: '工作坊流程跑通了，21 位姐妹的真实案例，可以给别的团照着做。',
      } as any,
      overrideAccess: true,
      user: admin as any,
    })
  } else {
    // 已存在则只校准提名状态（不覆盖团里改过的正文）
    // 但 SOP 新增的要素（时段 / 物料清单 / 资金证明照片）为空时补上，
    // 已有内容一律不动——团里改过的东西不能被种子覆盖。
    const backfill: Record<string, unknown> = {
      recommendedNote: '工作坊流程跑通了，21 位姐妹的真实案例，可以给别的团照着做。',
    }
    if (!report.actualStart) backfill.actualStart = '14:00'
    if (!report.actualEnd) backfill.actualEnd = '16:00'
    await payload.update({
      collection: 'activity-reports',
      id: report.id,
      data: backfill as never,
      overrideAccess: true,
      user: admin as any,
    })
  }

  console.log('→ 上传报销凭证')
  // 票据只接受 PDF 或图片：演示数据生成 PDF 凭证
  const venueReceipt = await uploadEvidence(
    payload,
    'receipt-venue-20260920.pdf',
    pdfAttachment('Receipt (demo) - Venue', [
      'Category: Venue rental',
      'Amount: CNY 240.00',
      'Note: 2 hours, public welfare space',
      'Date: 2026-09-21',
      'Demo voucher for local acceptance only.',
    ]),
    cohort.id,
  )
  const materialsReceipt = await uploadEvidence(
    payload,
    'receipt-materials-20260920.pdf',
    pdfAttachment('Receipt (demo) - Materials', [
      'Category: Materials and printing',
      'Amount: CNY 140.00',
      'Note: banner, name cards, CV printing',
      'Date: 2026-09-21',
      'Demo voucher for local acceptance only.',
    ]),
    cohort.id,
  )
  const transportReceipt = await uploadEvidence(
    payload,
    'receipt-transport-20260920.pdf',
    pdfAttachment('Receipt (demo) - Transport', [
      'Category: Local public transport',
      'Amount: CNY 100.00',
      'Note: participant travel subsidy',
      'Date: 2026-09-21',
      'Demo voucher for local acceptance only.',
    ]),
    cohort.id,
    'paymentScreenshot',
  )

  // 《经费支出明细表》：反馈里的每一笔都带凭证；报销明细直接从这里带过去
  // 明细是一整句手动写的话（第四十六轮）
  const expenseRows = [
    { kind: 'venue', category: '活动场地与布置', item: '社区活动中心场地租赁 2 小时', description: '', amount: 240, receipt: venueReceipt, note: '场地 2 小时' },
    { kind: 'materials', category: '活动物料与耗材', item: '横幅、桌牌与简历打印', description: '', amount: 140, receipt: materialsReceipt, note: '' },
    { kind: 'transport', category: '交通与差旅', item: '参与者往返地铁与公交', description: '', amount: 92, receipt: transportReceipt, note: '参与者往返，实际 100，预留 8 未用' },
  ]
  if (!(report.expenseItems ?? []).length) {
    await payload.update({
      collection: 'activity-reports',
      id: report.id,
      data: {
        expenseItems: expenseRows.map((row) => ({
          category: row.category,
          item: row.item,
          description: row.description,
          amount: row.amount,
          receipt: row.receipt.id,
          receiptName: row.receipt.filename ?? '',
          note: row.note,
        })),
      } as never,
      overrideAccess: true,
      user: admin as any,
    })
  }

  const reims = await payload.find({
    collection: 'reimbursements',
    where: { plan: { equals: plan.id } },
    limit: 1,
    overrideAccess: true,
  })
  if (!reims.docs.length) {
    await payload.create({
      collection: 'reimbursements',
      data: {
        report: report.id,
        plan: plan.id,
        cohort: cohort.id,
        applicant: lead.id,
        // 明细与凭证随《经费支出明细表》带过来；金额以合计为准
        items: expenseRows.map((row) => ({
          category: row.category,
          item: row.item,
          description: row.description,
          amount: row.amount,
          receiptType: row.kind === 'transport' ? 'paymentScreenshot' : 'receipt',
          receipt: row.receipt.id,
          receiptName: row.receipt.filename ?? '',
          note: row.note,
        })),
        total: 472,
        approvedAmount: 472,
        status: 'approved',
        approver: admin.id,
        approvedAt: new Date('2026-09-25').toISOString(),
        reviews: [
          {
            reviewer: admin.id,
            reviewerName: admin.name ?? '',
            action: 'approved',
            comment: '凭证齐全，金额与支出明细一致，同意报销。',
            at: new Date('2026-09-25').toISOString(),
          },
        ],
      } as any,
      overrideAccess: true,
    })
  }

  // 站内通知：团长收到的审批结果（右上角铃铛，点开跳到活动页）
  const noticeTitle = `您申请的「${plan.title}」活动审核通过，可准备启动。`
  const notices = await payload.find({
    collection: 'notifications',
    where: { and: [{ recipient: { equals: lead.id } }, { title: { equals: noticeTitle } }] },
    limit: 1,
    overrideAccess: true,
  })
  if (!notices.docs.length) {
    await payload.create({
      collection: 'notifications',
      data: {
        recipient: lead.id,
        title: noticeTitle,
        link: `/activities/${plan.slug}`,
        read: false,
      } as any,
      overrideAccess: true,
    })
  }

  // 付款登记：演示数据要走完方案 → 反馈 → 报销 → 付款，
  // 否则活动详情页的步骤条会出现「⑤ 未登记、⑥ 已发布」这种倒挂。
  const reimbursement = reims.docs[0] ?? (await payload.find({
    collection: 'reimbursements',
    where: { plan: { equals: plan.id } },
    limit: 1,
    overrideAccess: true,
  })).docs[0]
  if (reimbursement) {
    const pays = await payload.find({
      collection: 'payments',
      where: { reimbursement: { equals: reimbursement.id } },
      limit: 1,
      overrideAccess: true,
    })
    if (!pays.docs.length) {
      await payload.create({
        collection: 'payments',
        data: {
          reimbursement: reimbursement.id,
          payee: '万山AI豆计划互助团',
          amount: 472,
          method: 'bank',
          status: 'paid',
          scheduledAt: new Date('2026-09-27').toISOString(),
          paidAt: new Date('2026-09-28').toISOString(),
          externalRef: 'CWF-20260928-0031',
          operator: admin.id,
          note: '按核定金额 472 元拨付，已到账。',
        } as any,
        overrideAccess: true,
        user: admin as any,
      })
    }
  }

  console.log('→ 写入公开站资料库')
  await seedLibrary(payload, admin.id)

  // 旧的 5 个虚构演示团（杭州 / 北京 / 成都 / 深圳 / 西安）已从网络里移除：
  // 真实落点由 scripts/seed-network.ts 建立。需要那批演示故事时显式打开这个开关。
  if (process.env.MULAN_SEED_SHOWCASE === '1') {
    console.log('→ 写入早期演示团与演示成果（MULAN_SEED_SHOWCASE=1）')
    await seedShowcase(payload, admin.id, { planId: plan.id, reportId: report.id })
  }


  console.log('')
  console.log('✅ 演示数据已就绪')
  console.log(`   项目组后台：${PROJECT_TEAM_EMAIL} / ${PROJECT_TEAM_PASSWORD}`)
  console.log(`   团长账号  ：${LEAD_EMAIL} / Mulan@2026`)
  console.log(`   邀请链接  ：${INVITE_CODE}（在 /join?token= 页注册新成员）`)
  console.log('   后台账号  ：ops@mulan.org / Mulan@2026（仅 CMS 后台，业务账号进不去）')
}

/**
 * 执行种子。
 *
 * `payload migrate` 刚结束时 SQLite 可能还没释放文件锁，首跑会报 SQLITE_ERROR；
 * 这里对这类错误自动重试几次，避免"迁移完紧接着 seed 必须手动再跑一次"。
 */
const runSeed = async (attempt = 1): Promise<void> => {
  try {
    await seed()
  } catch (err) {
    const message = String((err as Error)?.message ?? err)
    const isLockIssue = /SQLITE|locked|busy/i.test(message)
    if (isLockIssue && attempt < 4) {
      console.warn(`  数据库文件还被占用，${attempt} 秒后重试（第 ${attempt} 次）…`)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      return runSeed(attempt + 1)
    }
    throw err
  }
}

runSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('种子数据失败：', err)
    process.exit(1)
  })
