'use server'

import { randomInt } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { RECEIPT_MIME_TYPES } from '@/collections/FinanceEvidence'
import { uniqueCode } from '@/lib/code'
import { expenseDetailText, getExpenseCategories, type BudgetCategoryDef } from '@/lib/budget'
import { formatDateCN, formatPlace, parseActualTime, parseCNDate } from '@/lib/format'
import { activityKind, ACTIVITY_KINDS } from '@/lib/activity-kind'
import { getClient } from '@/lib/payload'
import { workspaceSiteUrl } from '@/lib/site-url'
import { currentUser } from '@/lib/auth'
import { findOwnCohorts } from '@/lib/console-data'
import {
  UploadTypeError,
  allFiles,
  filesByPosition,
  isFile,
  firstFile,
  uploadFinanceEvidence,
  uploadMedia,
} from '@/lib/upload'
import { getActivityRules } from '@/lib/activity-rules'
import { INVITE_VALID_MS } from '@/lib/invitation'
import { withLock } from '@/lib/lock'
import { planVersions, snapshotOf } from '@/lib/plan-versions'
import { reimbursementSnapshotOf } from '@/lib/reimbursement-versions'

type ActionResult = { ok: boolean; message?: string; data?: Record<string, string> }

/**
 * 站内通知：发给收件人一条，右上角铃铛立刻能看到。
 * 创建只发生在服务端动作里（审批 / 核定），不开放任何客户端创建口。
 */
const notify = async (
  payload: any,
  data: { recipient: string | number; title: string; link?: string | null },
) => {
  try {
    await payload.create({
      collection: 'notifications',
      data: { ...data, read: false },
      overrideAccess: true,
    })
  } catch (err) {
    // 通知失败不阻断主流程
    console.error('notify failed', err)
  }
}

/** 票据只接受 PDF 或常见图片（服务端兜底，前端 accept 只是提示；不收 SVG） */
const isReceiptFile = (file: File) => RECEIPT_MIME_TYPES.includes(file.type)

/** 活动照片：常见位图、单张不超过 20MB（Server Action 的请求体上限也是 20MB） */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const PHOTO_MAX_BYTES = 20 * 1024 * 1024
const photoProblem = (files: File[]): string | null => {
  if (files.some((file) => !PHOTO_TYPES.includes(file.type))) return '活动照片只接受 JPG / PNG / WebP / HEIC'
  if (files.some((file) => file.size > PHOTO_MAX_BYTES)) return '单张照片不能超过 20MB'
  return null
}

/** 上传失败时给出能看懂的原因（文件类型不对），其余归为通用失败 */
const uploadFailureMessage = (err: unknown, fallback: string) => {
  if (err instanceof UploadTypeError) return err.message
  // 上传集合按文件内容认类型（lib/file-sniff.ts）抛出的 400：把原因告诉用户
  const status = (err as { status?: number } | null)?.status
  const message = err instanceof Error ? err.message : ''
  if (status === 400 && message.includes('类型不受支持')) return message
  return fallback
}

/**
 * 开展日期不能早于计划活动日期（同一天可以，之后也可以）。
 * 只比日历日，不比时分——计划时间本身只有日期。返回 null 表示通过。
 */
const actualBeforePlanned = (plannedAt: unknown, actualAt: string): string | null => {
  if (!plannedAt) return null
  const planned = new Date(String(plannedAt))
  if (Number.isNaN(planned.getTime())) return null
  const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (dayOf(new Date(actualAt)) >= dayOf(planned)) return null
  return `开展时间不能早于计划活动时间（${formatDateCN(planned)}）`
}

/**
 * 把收件人的通知标记成已读（铃铛里点开即读 / 通知页单条标已读）。
 *
 * 逐条兜错：**一条失败不拖垮整批**。
 * 集合的 update 权限只放行「还没读」的记录，已经读过的再标一次会被挡回来——
 * 那是正常的（本来就没必要标），不该让整批「全部已读」失败。
 */
export async function markNotificationsRead(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, message: '请先登录' }
  const payload = await getClient()
  const ids = formData
    .getAll('id')
    .map((v) => String(v ?? ''))
    .filter(Boolean)
  let failed = 0
  for (const id of ids) {
    try {
      await payload.update({
        collection: 'notifications',
        id,
        data: { read: true },
        user: user as any,
        overrideAccess: false,
      })
    } catch (err) {
      failed += 1
      console.error('markNotificationsRead failed', err)
    }
  }
  if (failed && failed === ids.length) return { ok: false, message: '操作失败' }
  return { ok: true }
}

/**
 * 把**本人全部**未读通知标记成已读（铃铛里的「全部已读」）。
 *
 * 为什么不在前端把已加载的 id 传回来：铃铛只带最近 10 条，
 * 未读超过 10 条时「全部已读」只清了 10 条，角标却还是真实总数——对不上。
 * 所以这条动作在服务端按「收件人 = 我 且 未读」全量处理。
 */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, message: '请先登录' }
  const payload = await getClient()
  try {
    const unread = await payload.find({
      collection: 'notifications',
      where: {
        and: [{ recipient: { equals: user.id } }, { read: { equals: false } }],
      },
      limit: 500,
      depth: 0,
      user: user as any,
      overrideAccess: false,
    })
    let failed = 0
    for (const doc of unread.docs as any[]) {
      try {
        await payload.update({
          collection: 'notifications',
          id: doc.id,
          data: { read: true },
          user: user as any,
          overrideAccess: false,
        })
      } catch (err) {
        failed += 1
        console.error('markAllNotificationsRead failed', err)
      }
    }
    if (failed && failed === unread.docs.length) return { ok: false, message: '操作失败' }
    return { ok: true, data: { count: String(unread.docs.length - failed) } }
  } catch (err) {
    console.error('markAllNotificationsRead failed', err)
    return { ok: false, message: '操作失败' }
  }
}

/**
 * 团长只能为自己所在的互助团提交方案与报销；项目组不受限。
 * （前端表单已经只列自己那一支，这里做服务端兜底。）
 */
/**
 * 能不能动这个团：**必须是这个团的团长**（一个团只有一个团长）。
 * 项目组不受限（他们是审批方，不是团的负责人）。
 */
const canActForCohort = async (user: Awaited<ReturnType<typeof currentUser>>, cohortId: unknown) => {
  if (!user) return false
  if (user.roles?.includes('projectTeam')) return true
  const id = resolveId(cohortId)
  if (!id) return false
  const payload = await getClient()
  const res = await payload.find({
    collection: 'cohorts',
    where: { and: [{ id: { equals: id } }, { leader: { equals: user.id } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs ?? []).length > 0
}

const reportStatusLabel: Record<string, string> = {
  accepted: '已采纳',
  revision_required: '需补充',
}

/** 同一互助团同时存在的草稿上限（不含驳回后正在修改的活动） */
const MAX_DRAFT_PLANS = 3

/**
 * 发起活动：**建一条空草稿，直接进活动详情页**。
 *
 * 发起与进度是同一页——点一下就有一条自己的活动，
 * 在活动详情页的「① 活动方案」里填内容、保存、再点「提交活动申请」交项目组审批。
 * （原来要先在一个单独的"发起活动"表单页填完、存草稿、再跳到进度页，多绕一圈。）
 */
export async function createActivity(): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, message: '请先登录' }
  if (!user.roles?.includes('cohortLead')) {
    return { ok: false, message: '只有团长可以发起活动；项目组负责审批' }
  }

  const ownCohorts = await findOwnCohorts(user)
  if (!ownCohorts.length) {
    return { ok: false, message: '你还没有担任团长，请先联系项目组' }
  }

  const payload = await getClient()
  // 已解散的团不能再发起新活动（已有的活动与记录照常保留）
  const running = await payload.find({
    collection: 'cohorts',
    where: { and: [{ id: { in: ownCohorts.map((c) => c.id) } }, { status: { equals: 'active' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const cohorts = running.docs as any[]
  if (!cohorts.length) {
    return { ok: false, message: '你的互助团已解散，不能再发起新活动；如需恢复请联系项目组' }
  }
  // 「数草稿 → 建草稿」在同一个团上排队执行：并发点几次也不会超过上限
  return withLock(`drafts:${cohorts[0].id}`, async () => {
  // 草稿上限：同一互助团最多 3 个草稿（驳回后正在修改的不计入，它已经不是草稿）
  const draftCount = await payload.count({
    collection: 'activity-plans',
    where: { and: [{ cohort: { equals: cohorts[0].id } }, { status: { equals: 'draft' } }] },
    overrideAccess: true,
  })
  if (draftCount.totalDocs >= MAX_DRAFT_PLANS) {
    return {
      ok: false,
      message: `草稿最多 ${MAX_DRAFT_PLANS} 个。请先把已写好的草稿提交申请后，再发起新活动`,
    }
  }
  // 先建一条空草稿：活动名称是中文，团长在 ① 区填具体内容；
  // 地址标识（网址里那一段）由集合的钩子自动生成不透明随机串。
  const plan = await payload.create({
    collection: 'activity-plans',
    data: {
      title: '未命名活动',
      cohort: cohorts[0].id,
      proposer: user.id,
      form: 'offline',
      theme: '',
      goals: '',
      participants: 0,
      budgetItems: [],
      status: 'draft',
    } as never,
    user: user as any,
  })

  revalidatePath('/')
  // 返回新活动的地址标识，由客户端跳过去。
  // ⚠️ 这里**不要在服务端 redirect()**：server action 的相对 redirect 会被服务端
  // 拿去内部渲染目标页，而那个地址取自 NEXT_PUBLIC_SERVER_URL（公众站），
  // 结果工作台的页面被 proxy 拦成 404。客户端 router.push 用的才是当前域。
  return { ok: true, message: String((plan as any).slug ?? plan.id) }
  })
}

/**
 * 编辑活动申请（团长；驳回后可重新编辑再提交）。
 *
 * 字段顺序即《活动申请表》：活动主题 / 活动形式 / 计划活动时间（YYYY年MM月DD日）/
 * 计划活动地点 / 预计参与人数 / 《经费预算明细表》。全部必填。
 * 「活动名称」字段已删——title 直接取活动主题，列表与页面显示的就是主题。
 */
export async function updatePlan(formData: FormData): Promise<ActionResult> {
  // 同一对象的"查状态 → 改状态"排队执行，防双击 / 并发重复处理（见 lib/lock.ts）
  return withLock(`plan:${formData.get('id')}`, () => updatePlanImpl(formData))
}

async function updatePlanImpl(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, message: '请先登录' }
  if (user.roles?.includes('projectTeam')) {
    return { ok: false, message: '项目组负责审批，不修改互助团的申请' }
  }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: '参数不完整' }

  const theme = String(formData.get('theme') ?? '').trim()
  if (!theme) return { ok: false, message: '请填写活动主题' }
  const kind = String(formData.get('kind') ?? '').trim()
  if (!ACTIVITY_KINDS.includes(kind as (typeof ACTIVITY_KINDS)[number])) {
    return { ok: false, message: '请选择活动类别' }
  }
  const form = String(formData.get('form') ?? 'offline')
  const plannedAtText = String(formData.get('plannedAt') ?? '').trim()
  const plannedAt = parseCNDate(plannedAtText)
  if (!plannedAt) return { ok: false, message: '请按 YYYY年MM月DD日 格式填写计划活动时间' }
  const location = String(formData.get('location') ?? '').trim()
  if (!location) return { ok: false, message: '请填写计划活动地点' }
  const participants = Number(formData.get('participants') ?? 0)
  if (!Number.isFinite(participants) || participants <= 0) {
    return { ok: false, message: '请填写预计参与人数' }
  }

  // 费用类别从项目组在「设置」里维护的清单里选；明细由人手动写（第四十六轮）
  // 这条申请**原本就有**的类别（后来被从清单里删了/改名了）仍然允许保留。
  const categories = await getExpenseCategories(await getClient())
  const legacyCategories = await legacyBudgetCategories('activity-plans', id)

  const { rows: budgetItems, problems: budgetProblems } = collectExpenseDetails(
    formData,
    categories,
    legacyCategories,
    '预算明细',
  )
  if (!budgetItems.length) return { ok: false, message: '请至少填写一条《经费预算明细表》' }
  if (budgetProblems.length) return { ok: false, message: budgetProblems[0] }

  const payload = await getClient()
  let plan: any = null
  try {
    plan = await payload.findByID({
      collection: 'activity-plans',
      id,
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, message: '找不到这份申请' }
  }

  if (!plan) return { ok: false, message: '找不到这份申请' }
  if (!['draft', 'rejected'].includes(plan.status)) {
    return { ok: false, message: '申请已提交，待审核中；驳回后才能重新编辑' }
  }
  if (!(await canActForCohort(user, plan.cohort?.id ?? plan.cohort))) {
    return { ok: false, message: '只能编辑本互助团的申请' }
  }

  try {
    const updated = await payload.update({
      collection: 'activity-plans',
      id,
      data: {
        title: theme,
        theme,
        kind,
        form,
        plannedAt,
        location,
        participants,
        budgetItems,
      } as never,
      user: user as any,
    })
    revalidatePath('/')
    // 活动详情页按地址标识（随机串）路由
    revalidatePath(`/activities/${(updated as any)?.slug ?? id}`)
    revalidatePath('/home')
    return { ok: true, message: '已保存' }
  } catch (err) {
    console.error('updatePlan failed', err)
    return { ok: false, message: '保存失败，请检查填写内容' }
  }
}

/**
 * 提交活动申请（仅团长）。
 *
 * 申报人取**提交那一刻**的团长姓名快照（applicantName），
 * 申报时间 = submittedAt；之后改个人信息不改这两处。
 * 重新提交（驳回后）保留历史审批记录，只追加新记录。
 */
export async function submitExistingPlan(formData: FormData): Promise<ActionResult> {
  // 同一对象的"查状态 → 改状态"排队执行，防双击 / 并发重复处理（见 lib/lock.ts）
  return withLock(`plan:${formData.get('id')}`, () => submitExistingPlanImpl(formData))
}

async function submitExistingPlanImpl(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, message: '请先登录' }
  if (!user.roles?.includes('cohortLead')) {
    return { ok: false, message: '只有团长可以提交活动申请' }
  }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: '参数不完整' }

  const payload = await getClient()
  let plan: any = null
  try {
    plan = await payload.findByID({
      collection: 'activity-plans',
      id,
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, message: '找不到这份申请' }
  }
  if (!plan) return { ok: false, message: '找不到这份申请' }
  if (!['draft', 'rejected'].includes(plan.status)) {
    return { ok: false, message: '这份申请已经提交过了' }
  }
  if (!(plan.budgetItems ?? []).length) {
    return { ok: false, message: '《经费预算明细表》还没有填写，请先保存完整内容再提交' }
  }
  const missingFields = [
    !plan.theme && '活动主题',
    !plan.plannedAt && '计划活动时间',
    !plan.location && '计划活动地点',
    !plan.participants && '预计参与人数',
  ].filter(Boolean)
  if (missingFields.length) {
    return {
      ok: false,
      message: `还有这几项没填：${missingFields.join('、')}——填好后点「保存草稿」，再提交`,
    }
  }
  if (!(await canActForCohort(user, plan.cohort?.id ?? plan.cohort))) {
    return { ok: false, message: '只能提交本互助团的申请' }
  }
  // 按这份活动建立时记下的上下限校验（之后改活动设置，不影响已存在的活动）
  const fallback = await getActivityRules(payload)
  const budgetMax = Number(plan.ruleBudgetMax ?? fallback.budgetMax)
  const participantsMin = Number(plan.ruleParticipantsMin ?? fallback.participantsMin)
  const budgetTotal = Number(plan.budgetTotal ?? 0)
  if (budgetTotal > budgetMax) {
    return {
      ok: false,
      message: `预算合计 ¥${budgetTotal} 超过上限 ¥${budgetMax}，请调整《经费预算明细表》后再提交`,
    }
  }
  if ((Number(plan.participants) || 0) < participantsMin) {
    return { ok: false, message: `预计参与人数不得少于 ${participantsMin} 人，请修改后再提交` }
  }
  // 明细正文必须写清楚（第四十六轮起「费用项目 + 数量与规格」合并成一列，
  // 这一列就是「预算明细」；老记录里还留着「数量与规格」的，一并算已写）
  const rowWithoutDetail = (plan.budgetItems ?? []).findIndex(
    (row: any) => !expenseDetailText(row).trim(),
  )
  if (rowWithoutDetail >= 0) {
    return {
      ok: false,
      message: `《经费预算明细表》第 ${rowWithoutDetail + 1} 行（${plan.budgetItems[rowWithoutDetail]?.item || plan.budgetItems[rowWithoutDetail]?.category || '未命名明细'}）没写预算明细`,
    }
  }

  try {
    // 版本追溯：每次提交把申请内容整份留档，记成第 N 版（见 lib/plan-versions.ts）。
    // 版本追溯上线前提交过的申请没有快照，planVersions 会先用当时的内容补出第 1 版。
    const submittedAt = new Date().toISOString()
    const previous = planVersions(plan).map((v) => ({
      no: v.no,
      submittedAt: v.submittedAt || null,
      submitterName: v.submitterName,
      snapshot: v.snapshot,
    }))
    const keptSubmitters = Array.isArray(plan.versions) ? plan.versions : []
    const versions = [
      ...previous.map((v, i) => ({
        ...v,
        submitter: resolveId(keptSubmitters[i]?.submitter) ?? null,
      })),
      {
        no: previous.length + 1,
        submittedAt,
        submitter: Number(user.id),
        submitterName: user.name ?? '',
        snapshot: snapshotOf(plan),
      },
    ]
    await payload.update({
      collection: 'activity-plans',
      id,
      data: {
        status: 'submitted',
        applicantName: user.name ?? '',
        submittedAt,
        versions,
      } as never,
      user: user as any,
    })
    // 通知「活动审核负责人」（只有他能审批这一环节）；未指定负责人时不发
    const { planReviewerId } = await getActivityRules(payload)
    if (planReviewerId) {
      await notify(payload, {
        recipient: planReviewerId,
        title: `${plan.cohort?.name ?? '互助团'}提交了活动申请「${plan.theme || plan.title || ''}」，请审批。`,
        link: `/activities/${plan.slug ?? id}`,
      })
    }
    revalidatePath('/')
    revalidatePath(`/activities/${plan.slug ?? id}`)
    revalidatePath('/home')
    return { ok: true, message: '已提交，等待项目组审核' }
  } catch (err) {
    console.error('submitExistingPlan failed', err)
    return { ok: false, message: '提交失败' }
  }
}

/**
 * 编辑活动反馈（团长；项目组要求补充后可再改）。
 *
 * 与提交同一套字段：地点 / 开展时间 / 总结 / 感受 / 支出明细 / 签到表；
 * 照片只在重新选择时替换，否则保留原照片。
 */
export async function updateReport(formData: FormData): Promise<ActionResult> {
  // 同一对象的"查状态 → 改状态"排队执行，防双击 / 并发重复处理（见 lib/lock.ts）
  return withLock(`report:${formData.get('id')}`, () => updateReportImpl(formData))
}

async function updateReportImpl(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, message: '请先登录' }
  if (user.roles?.includes('projectTeam')) {
    return { ok: false, message: '项目组负责采纳反馈，不修改互助团的记录' }
  }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: '参数不完整' }

  const payload = await getClient()
  let report: any = null
  try {
    report = await payload.findByID({
      collection: 'activity-reports',
      id,
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, message: '找不到这份反馈' }
  }
  if (!report) return { ok: false, message: '找不到这份反馈' }
  {
    // ⚠️ 2026-11-03 第五十一轮：**反馈一旦被采纳就是定案**，不能再改。
    //    采纳 = 项目组审过并已发布到公开站，内容对外可见，改了会对不上。
    //    只有「被退回需补充」（revision_required）才允许团长改完重提。
    if (report.status === 'accepted') {
      return { ok: false, message: '反馈已被采纳并发布到公开站，不能再修改；如需更正请联系项目组' }
    }
    if (report.status === 'submitted') {
      return { ok: false, message: '反馈正在等待项目组审核，暂时不能修改' }
    }
    // 报销在审核中也不能改（否则项目组看的和团长改的不是同一份）
    const related = await payload.find({
      collection: 'reimbursements',
      where: { report: { equals: report.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const reimbursementStatus = related.docs[0]?.status
    if (reimbursementStatus === 'approved' || reimbursementStatus === 'paid') {
      return { ok: false, message: '报销已核定，反馈不能再修改；如需更正请联系项目组' }
    }
    if (reimbursementStatus === 'submitted') {
      return { ok: false, message: '报销正在审核，暂时不能修改反馈' }
    }
  }
  if (!(await canActForCohort(user, report.cohort?.id ?? report.cohort))) {
    return { ok: false, message: '只能编辑本互助团的反馈' }
  }

  const location = String(formData.get('location') ?? '').trim()
  if (!location) return { ok: false, message: '请填写活动开展地点' }

  const actualTime = parseActualTime(String(formData.get('actualTime') ?? ''))
  if (!actualTime) {
    return {
      ok: false,
      message: '请按 YYYY年MM月DD日 HH:mm-HH:mm 格式填写开展时间，且结束时间晚于开始时间',
    }
  }
  const dateError = actualBeforePlanned(report.plan?.plannedAt, actualTime.actualAt)
  if (dateError) return { ok: false, message: dateError }

  const summary = String(formData.get('summary') ?? '').trim()
  if (!summary) return { ok: false, message: '请填写活动总结' }
  if (summary.length > 200) return { ok: false, message: '活动总结请控制在 200 字以内' }

  // 费用类别从项目组在「设置」里维护的清单里选；明细由人手动写（第四十六轮）
  const categories = await getExpenseCategories(await getClient())
  const legacyCategories = await legacyBudgetCategories(
    'activity-reports',
    String(formData.get('id') ?? ''),
  )
  const { rows: expenseRows, problems: expenseProblems } = collectExpenseRows(
    formData,
    categories,
    legacyCategories,
  )
  if (!expenseRows.length) return { ok: false, message: '请至少填写一条《经费支出明细表》' }
  if (expenseProblems.length) return { ok: false, message: expenseProblems[0] }

  const attendees = collectAttendees(formData)
  if (!attendees.length) return { ok: false, message: '请至少填写一位《活动签到表》名单' }
  // 实际参与人数与签到人数对齐：就是签到表里签了到的人数
  const signedCount = attendees.filter((row) => Boolean(row.signed)).length
  if (!signedCount) return { ok: false, message: '《活动签到表》里至少要有一位已签到的参与者' }

  try {
    // 照片：重新选择就替换（仍要 3-5 张），没选就保留原照片
    let photos = (report.photos ?? []).map((p: any) => p?.id ?? p)
    const photoFiles = allFiles(formData, 'photos')
    const photoNotes = formData.getAll('photoNote').map((note) => String(note ?? '').trim())
    if (photoFiles.length) {
      if (photoFiles.length < 3 || photoFiles.length > 5) {
        return { ok: false, message: `活动照片 3-5 张，已选 ${photoFiles.length} 张` }
      }
      const problem = photoProblem(photoFiles)
      if (problem) return { ok: false, message: problem }
      photos = []
      for (let index = 0; index < photoFiles.length; index += 1) {
        const uploaded = await uploadMedia(
          photoFiles[index],
          photoNotes[index] || `${report.theme ?? '活动'} 活动照片 ${index + 1}`,
          // 发布前只给本团与项目组看；报销通过、活动发布时转公开
          { user: user as any, visibility: 'internal', cohort: report.cohort?.id ?? report.cohort },
        )
        photos.push(uploaded.id)
      }
    }

    // 支出明细：这一行重新传了凭证就换成新的，没传就保留原来的。
    // 一行可以有多个附件（`receipt-<行号>`，每张自己带说明）。
    const receiptFilesByRow = expenseRows.map((_, index) =>
      formData.getAll(`receipt-${index}`).filter(isFile),
    )
    if (receiptFilesByRow.some((files) => files.some((file) => !isReceiptFile(file)))) {
      return { ok: false, message: '票据必须是 PDF 或图片（JPG / PNG）' }
    }
    const oldItems: any[] = Array.isArray(report.expenseItems) ? report.expenseItems : []
    const items = []
    for (let index = 0; index < expenseRows.length; index += 1) {
      const files = receiptFilesByRow[index]
      if (files.length) {
        const notes = formData.getAll(`receiptNote-${index}`).map((note) => String(note ?? '').trim())
        const ids: (number | string)[] = []
        const names: string[] = []
        for (const [fileIndex, file] of files.entries()) {
          const evidence = await uploadFinanceEvidence(file, {
            user: user as any,
            kind: 'receipt',
            cohort: report.cohort?.id ?? report.cohort,
            // 附件说明：写清这是哪一笔的费用（没写就自动补）
            note: notes[fileIndex] || `${expenseRows[index].item} · 票据 ${fileIndex + 1}`,
          })
          ids.push(evidence.id)
          names.push(evidence.filename ?? file.name)
        }
        items.push({
          category: expenseRows[index].category,
          item: expenseRows[index].item,
          description: expenseRows[index].description,
          amount: expenseRows[index].amount,
          receipt: ids,
          receiptName: names.join('、'),
          note: expenseRows[index].note,
        })
      } else {
        const old = oldItems[index]
        const oldReceipt = old?.receipt
        const oldIds = Array.isArray(oldReceipt)
          ? oldReceipt.map((r: any) => r?.id ?? r)
          : oldReceipt
            ? [oldReceipt?.id ?? oldReceipt]
            : []
        items.push({
          category: expenseRows[index].category,
          item: expenseRows[index].item,
          description: expenseRows[index].description,
          amount: expenseRows[index].amount,
          receipt: oldIds,
          receiptName: old?.receiptName ?? '',
          note: expenseRows[index].note,
        })
      }
    }

    const updatedReport = await payload.update({
      collection: 'activity-reports',
      id,
      data: {
        location,
        ...actualTime,
        summary,
        highlights: String(formData.get('highlights') ?? ''),
        attendees,
        actualParticipants: signedCount,
        expenseItems: items,
        photos,
        status: 'submitted',
      } as never,
      user: user as any,
    })
    const auto = await autoSubmitReimbursement(payload, updatedReport, user)
    revalidatePath('/')
    // 反馈挂在那条活动下面，刷新的是活动详情页（按地址标识路由）
    const planId = typeof report.plan === 'object' && report.plan ? report.plan.id : report.plan
    let planSlug = planId
    if (planId) {
      try {
        const planDoc = await payload.findByID({
          collection: 'activity-plans',
          id: planId,
          depth: 0,
          overrideAccess: true,
        })
        planSlug = (planDoc as any)?.slug ?? planId
      } catch {
        planSlug = planId
      }
    }
    revalidatePath(`/activities/${planSlug}`)
    return {
      ok: true,
      message: auto.ok
        ? '反馈已保存，报销已自动提交'
        : `反馈已保存，但报销未能自动提交：${auto.message ?? '请稍后重试'}`,
    }
  } catch (err) {
    console.error('updateReport failed', err)
    return { ok: false, message: uploadFailureMessage(err, '保存失败，请检查填写内容') }
  }
}

/**
 * 活动审批（项目组）。
 *
 * 审核人取**审批那一刻**的账号姓名快照；每次审批追加一条记录，不覆盖历史。
 * 审核结果只有【审核通过 / 审核不通过】两态（前端二次确认后才提交）；
 * 只有「活动设置」里指定的活动审核负责人可以审核。
 */
export async function reviewPlan(formData: FormData): Promise<ActionResult> {
  // 同一对象的"查状态 → 改状态"排队执行，防双击 / 并发重复处理（见 lib/lock.ts）
  return withLock(`plan:${formData.get('id')}`, () => reviewPlanImpl(formData))
}

async function reviewPlanImpl(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可审批' }

  const id = String(formData.get('id') ?? '')
  const action = String(formData.get('action') ?? '')
  const comment = String(formData.get('comment') ?? '').trim()
  if (!['approved', 'rejected'].includes(action)) return { ok: false, message: '审批动作不合法' }
  if (action !== 'approved' && !comment) {
    return { ok: false, message: '审核不通过时必须填写审核意见' }
  }

  if (!/^\d+$/.test(id)) return { ok: false, message: '参数不完整' }
  const payload = await getClient()
  let existing: any = null
  try {
    existing = await payload.findByID({
      collection: 'activity-plans',
      id,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, message: '找不到这份申请' }
  }
  const rules = await getActivityRules(payload)
  if (rules.planReviewerId !== Number(user.id)) {
    return { ok: false, message: '只有活动审核负责人可以审核活动' }
  }
  if (existing?.status !== 'submitted') {
    return { ok: false, message: '这份申请不在待审核状态' }
  }
  // 不能审核自己提交的申请（一个账号同时有团长与项目组两种角色时）
  if (String(existing?.proposer?.id ?? existing?.proposer ?? '') === String(user.id)) {
    return { ok: false, message: '不能审核自己提交的申请' }
  }

  const reviews = Array.isArray(existing?.reviews) ? [...existing.reviews] : []
  reviews.push({
    reviewer: user.id as number,
    reviewerName: user.name ?? '',
    action,
    comment,
    at: new Date().toISOString(),
    // 审的是当前最新提交的那一版
    version: planVersions(existing).length || 1,
  })

  const slug = existing?.slug ?? id
  try {
    await payload.update({
      collection: 'activity-plans',
      id,
      data: {
        status: action,
        reviews,
        ...(action === 'approved' ? { approvedAt: new Date().toISOString() } : {}),
      } as never,
      user: user as any,
    })
    // 通知团长：审核结果 + 可点击跳到活动页
    const theme = existing?.title ?? existing?.theme ?? ''
    await notify(payload, {
      recipient: existing?.proposer?.id ?? existing?.proposer,
      title:
        action === 'approved'
          ? `您申请的「${theme}」活动审核通过，可准备启动。`
          : `您申请的「${theme}」活动审核未通过，请修改后重新提交。`,
      link: `/activities/${slug}`,
    })
    revalidatePath('/')
    revalidatePath(`/activities/${slug}`)
    revalidatePath('/home')
    return { ok: true }
  } catch (err) {
    console.error('reviewPlan failed', err)
    return { ok: false, message: '审批失败' }
  }
}

/** 提交活动反馈（团长；审批【已通过】后开放） */
export async function submitReport(formData: FormData): Promise<ActionResult> {
  // 同一对象的"查状态 → 改状态"排队执行，防双击 / 并发重复处理（见 lib/lock.ts）
  return withLock(`plan:${formData.get('plan')}`, () => submitReportImpl(formData))
}

async function submitReportImpl(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, message: '请先登录' }
  if (user.roles?.includes('projectTeam')) {
    return { ok: false, message: '活动反馈由互助团填写，项目组不作实施方' }
  }

  const payload = await getClient()
  const planId = String(formData.get('plan') ?? '')
  if (!planId) return { ok: false, message: '请选择对应的活动' }

  let plan: any = null
  try {
    plan = await payload.findByID({
      collection: 'activity-plans',
      id: planId,
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, message: '找不到对应的活动' }
  }
  if (!plan) return { ok: false, message: '找不到对应的活动' }
  if (!['approved', 'implemented'].includes(plan.status)) {
    return { ok: false, message: '活动审核通过后才能填写反馈' }
  }
  if (!(await canActForCohort(user, plan.cohort?.id ?? plan.cohort))) {
    return { ok: false, message: '只能填写本互助团的反馈' }
  }
  // 一场活动只有一份反馈：重复点「提交」不能生出第二份反馈和第二张报销单
  const existingReport = await payload.find({
    collection: 'activity-reports',
    where: { plan: { equals: plan.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existingReport.docs.length) {
    return { ok: false, message: '这场活动已经提交过反馈，请刷新页面后在原反馈上修改' }
  }

  const location = String(formData.get('location') ?? '').trim()
  if (!location) return { ok: false, message: '请填写活动开展地点' }

  // 开展时间是一个整串：2026年10月26日 14:00-16:00
  const actualTime = parseActualTime(String(formData.get('actualTime') ?? ''))
  if (!actualTime) {
    return {
      ok: false,
      message: '请按 YYYY年MM月DD日 HH:mm-HH:mm 格式填写开展时间，且结束时间晚于开始时间',
    }
  }
  const dateError = actualBeforePlanned(plan.plannedAt, actualTime.actualAt)
  if (dateError) return { ok: false, message: dateError }

  const summary = String(formData.get('summary') ?? '').trim()
  if (!summary) return { ok: false, message: '请填写活动总结' }
  if (summary.length > 200) return { ok: false, message: '活动总结请控制在 200 字以内' }

  // 活动照片 3-5 张
  const photoFiles = allFiles(formData, 'photos')
  const photoNotes = formData.getAll('photoNote').map((note) => String(note ?? '').trim())
  if (photoFiles.length < 3 || photoFiles.length > 5) {
    return {
      ok: false,
      message: `活动照片 3-5 张（要有露出全体成员与参与者的合照），已选 ${photoFiles.length} 张`,
    }
  }
  const photoError = photoProblem(photoFiles)
  if (photoError) return { ok: false, message: photoError }

  // 《经费支出明细表》：明细项 + 金额 + 凭证/照片证明（逐行）+ 备注
  // 费用类别从项目组在「设置」里维护的清单里选；明细由人手动写（第四十六轮）
  const categories = await getExpenseCategories(await getClient())
  const legacyCategories = await legacyBudgetCategories(
    'activity-reports',
    String(formData.get('id') ?? ''),
  )
  const { rows: expenseRows, problems: expenseProblems } = collectExpenseRows(
    formData,
    categories,
    legacyCategories,
  )
  if (!expenseRows.length) return { ok: false, message: '请至少填写一条《经费支出明细表》' }
  if (expenseProblems.length) return { ok: false, message: expenseProblems[0] }

  const expenseTotal = expenseRows.reduce((sum, row) => sum + row.amount, 0)
  const budgetTotal = Number(plan.budgetTotal ?? 0)
  if (budgetTotal > 0 && expenseTotal > budgetTotal && expenseRows.every((row) => !row.note)) {
    return {
      ok: false,
      message: `实际支出 ¥${expenseTotal.toFixed(2)} 超出预算合计 ¥${budgetTotal.toFixed(2)}，请在对应明细的备注里说明原因`,
    }
  }

  // 逐行上传凭证/照片证明到财务凭证库（只接受 PDF 或图片）。
  // 一笔支出可以挂**多个**附件（每张都写清是哪一笔的费用）：
  // 第 n 行的文件框没选，就是第 n 行缺凭证（不能把后面的文件往前挪）
  const receiptFilesByRow = expenseRows.map((_, index) =>
    formData.getAll(`receipt-${index}`).filter(isFile),
  )
  const missingRow = expenseRows.findIndex((_, index) => receiptFilesByRow[index].length === 0)
  if (missingRow >= 0) {
    const row = expenseRows[missingRow]
    return {
      ok: false,
      message: `第 ${missingRow + 1} 笔「${row.item || row.category || '未命名明细'}」还没有附凭证/照片证明`,
    }
  }
  if (receiptFilesByRow.some((files) => files.some((file) => !isReceiptFile(file)))) {
    return { ok: false, message: '票据必须是 PDF 或图片（JPG / PNG）' }
  }

  // 签到表：姓名、工作单位、工作职位、签到
  const attendees = collectAttendees(formData)
  if (!attendees.length) return { ok: false, message: '请至少填写一位《活动签到表》名单' }
  // 实际参与人数与签到人数对齐：就是签到表里签了到的人数
  const signedCount = attendees.filter((row) => Boolean(row.signed)).length
  if (!signedCount) return { ok: false, message: '《活动签到表》里至少要有一位已签到的参与者' }

  try {
    const photos = []
    for (let index = 0; index < photoFiles.length; index += 1) {
      const uploaded = await uploadMedia(
        photoFiles[index],
        photoNotes[index] || `${plan.title ?? '活动'} 活动照片 ${index + 1}`,
        // 发布前只给本团与项目组看；报销通过、活动发布时转公开
        { user: user as any, visibility: 'internal', cohort: plan.cohort?.id ?? plan.cohort },
      )
      photos.push(uploaded.id)
    }

    const items = []
    for (let index = 0; index < expenseRows.length; index += 1) {
      const notes = formData.getAll(`receiptNote-${index}`).map((note) => String(note ?? '').trim())
      const evidenceIds: (number | string)[] = []
      const names: string[] = []
      for (const [fileIndex, file] of receiptFilesByRow[index].entries()) {
        const evidence = await uploadFinanceEvidence(file, {
          user: user as any,
          kind: 'receipt',
          cohort: plan.cohort?.id ?? plan.cohort,
          // 附件说明：写清这是哪一笔的费用（没写就自动补）
          note: notes[fileIndex] || `${expenseRows[index].item} · 票据 ${fileIndex + 1}`,
        })
        evidenceIds.push(evidence.id)
        names.push(evidence.filename ?? file.name)
      }
      items.push({
        category: expenseRows[index].category,
        item: expenseRows[index].item,
        description: expenseRows[index].description,
        amount: expenseRows[index].amount,
        receipt: evidenceIds,
        receiptName: names.join('、'),
        note: expenseRows[index].note,
      })
    }

    const createdReport = await payload.create({
      collection: 'activity-reports',
      data: {
        plan: Number(planId),
        cohort: plan.cohort?.id ?? plan.cohort,
        submittedBy: user.id,
        theme: plan.title ?? plan.theme ?? '',
        location,
        ...actualTime,
        summary,
        highlights: String(formData.get('highlights') ?? ''),
        attendees,
        actualParticipants: signedCount,
        expenseItems: items,
        photos,
        // ⚠️ 2026-11-03 第五十一轮：反馈提交后**不再自动生成报销单**。
        //    改成「项目组审反馈 → 采纳 → 才推到报销环节」（见 reviewReport）。
        status: 'submitted',
      } as never,
      user: user as any,
    })
    revalidatePath('/')
    revalidatePath(`/activities/${plan.slug ?? planId}`)
    revalidatePath('/home')
    return {
      ok: true,
      message: '反馈已提交，等待项目组审核采纳',
    }
  } catch (err) {
    console.error('submitReport failed', err)
    return { ok: false, message: uploadFailureMessage(err, '反馈提交失败，请检查填写内容') }
  }
}

/**
 * 把一场活动发布到公开站（**报销审核通过时自动调用**，不再有单独的「精选发布」）。
 *
 * 标题 / 摘要 / 日期 / 地点 / 参与人数 / 第一张现场照片 / 所属互助团全部取自活动反馈；
 * 现场照片此刻才转为公开（视频、签到表、资金证明照片不进公开站，保持内部）。
 * 已发布过的不重复发布。失败不影响报销结果，由调用方提示。
 */
async function publishReport(payload: any, reportId: number | string, authorId: number | string) {
  const report: any = await payload.findByID({
    collection: 'activity-reports',
    id: reportId,
    depth: 1,
    overrideAccess: true,
  })
  if (!report || report.publishedAs) return { ok: true as const, slug: null as string | null }

  const excerpt = String(report.summary ?? '').trim()
  const cohort = report.cohort ?? null
  const slugTaken = async (candidate: string) => {
    const hit = await payload.find({
      collection: 'publications',
      where: { slug: { equals: candidate } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return hit.docs.length > 0
  }

  const photos = Array.isArray(report.photos) ? report.photos : []
  const planId = report.plan?.id ?? report.plan
  let planTitle = ''
  let planKind: string | null = null
  let planSlug = ''
  if (planId) {
    const planDoc = await payload
      .findByID({ collection: 'activity-plans', id: planId, depth: 0, overrideAccess: true })
      .catch(() => null)
    planTitle = String(planDoc?.title ?? '')
    planKind = planDoc?.kind ? String(planDoc.kind) : null
    planSlug = String(planDoc?.slug ?? '')
  }
  // 同一场活动，工作台与公开站用**同一个地址标识**：
  // 工作台 /activities/<标识> ↔ 公开站 /activities/<标识>（换个域名即可互相找到）
  const slug = planSlug && !(await slugTaken(planSlug)) ? planSlug : await uniqueCode(slugTaken)

  const publication = await payload.create({
    collection: 'publications',
    data: {
      title: String(report.theme ?? '').trim() || planTitle || '互助团活动',
      slug,
      type: 'event',
      kind:
        planKind ??
        activityKind(
          String(report.theme ?? ''),
          String(report.summary ?? ''),
          String(report.highlights ?? ''),
        ),
      excerpt,
      summary: report.summary,
      eventDate: report.actualAt ?? null,
      eventLocation: String(report.location ?? ''),
      attendeeCount: report.actualParticipants ? Number(report.actualParticipants) : null,
      byline: cohort?.name ?? '',
      relatedReport: report.id,
      relatedPlan: planId ?? null,
      relatedCohort: cohort?.id ?? null,
      cover: photos[0]?.id ?? null,
      publishedAt: new Date().toISOString(),
      author: authorId,
    } as never,
    overrideAccess: true,
  })

  await payload.update({
    collection: 'activity-reports',
    id: report.id,
    data: { publishedAs: publication.id } as never,
    overrideAccess: true,
  })
  const photoIds = photos.map((p: any) => p?.id ?? p).filter(Boolean)
  if (photoIds.length) {
    await payload.update({
      collection: 'media',
      where: { id: { in: photoIds } },
      data: { visibility: 'public' } as never,
      overrideAccess: true,
    })
  }
  return { ok: true as const, slug: String(publication.slug) }
}

/**
 * 反馈提交 / 重新提交时，自动把《经费支出明细表》转成一张报销单。
 * 同一反馈已有未驳回的报销单时不重复创建；被驳回后重新提交会新建一张。
 *
 * ⚠️ 2026-11-03 第五十一轮：**只在反馈被「采纳」后才创建报销单**。
 *    以前是「反馈一提交就自动生成报销单」，等于反馈还没被审就进了报销环节。
 *    现在：团长提交反馈 → 项目组（活动审核负责人）审反馈 → 采纳了才推送到报销环节。
 *
 *    报销审核负责人**为空**时：报销单照样生成、照样显示「已提交，待审核」，
 *    但**不推送通知、不进待办**（见 `pendingReimbursements` 的过滤）。
 */
async function autoSubmitReimbursement(payload: any, report: any, user: any): Promise<ActionResult> {
  const expenseItems: any[] = Array.isArray(report?.expenseItems) ? report.expenseItems : []
  if (!expenseItems.length) return { ok: false, message: '《经费支出明细表》是空的' }
  const missingRows = expenseItems
    .map((row, index) => ({
      index,
      row,
      count: Array.isArray(row.receipt) ? row.receipt.length : row.receipt ? 1 : 0,
    }))
    .filter((entry) => entry.count === 0)
  if (missingRows.length) {
    const first = missingRows[0]
    return {
      ok: false,
      message: `还有 ${missingRows.length} 笔支出没有凭证/照片证明：第 ${first.index + 1} 笔「${first.row.item || first.row.category || '未命名明细'}」`,
    }
  }

  const existing = await payload.find({
    collection: 'reimbursements',
    where: { report: { equals: report.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0] && existing.docs[0].status !== 'rejected') {
    return { ok: true }
  }

  const items = expenseItems.map((row) => ({
    category: String(row.category ?? ''),
    item: String(row.item ?? ''),
    description: String(row.description ?? ''),
    amount: Number(row.amount) || 0,
    receiptType: 'receipt',
    // 一笔支出可以有多个凭证
    receipt: (Array.isArray(row.receipt) ? row.receipt : row.receipt ? [row.receipt] : []).map(
      (r: any) => r?.id ?? r,
    ),
    receiptName: row.receiptName ?? '',
    note: row.note ?? '',
  }))
  const total = items.reduce((sum, row) => sum + row.amount, 0)

  // 版本追溯：每次提交留一版（像活动申请那样），驳回后重提沿用同一张单
  const previous = existing.docs[0]
  const previousVersions: any[] = Array.isArray(previous?.versions) ? previous.versions : []
  const versionNo = previousVersions.length + 1
  const snapshot = reimbursementSnapshotOf({ items, total }, report)
  /**
   * 这一版的**提交人**：同样是**团长**（系统代理团长提交的报销单，2026-11-04）。
   * 旧流程里 `user` 就是团长；新流程里 `user` 是采纳反馈的项目组成员，
   * 直接用会把「谁提交了这笔报销」记成审核人，追溯起来就乱了。
   */
  const submitterId = report.submittedBy?.id ?? report.submittedBy ?? user.id
  let submitterName = user.name ?? ''
  try {
    const submitterDoc: any = await payload.findByID({
      collection: 'users',
      id: submitterId,
      depth: 0,
      overrideAccess: true,
      select: { name: true },
    })
    if (submitterDoc?.name) submitterName = String(submitterDoc.name)
  } catch {
    // 取不到就用当前用户兜底
  }
  const versions = [
    ...previousVersions,
    {
      no: versionNo,
      submittedAt: new Date().toISOString(),
      submitter: submitterId,
      submitterName,
      snapshot,
    },
  ]

  // ⚠️ 2026-11-03 第五十一轮：**生成时记下报销审核人快照**。
  //    当时有人 → 只有他能审这一单；当时没人 → 这一单永远不流转。
  const { reimbursementReviewerId, reimbursementReviewerName } = await getActivityRules(payload)

  if (previous) {
    await payload.update({
      collection: 'reimbursements',
      id: previous.id,
      data: {
        items,
        total,
        status: 'submitted',
        versions,
        // 重提时也刷新快照：这一版是新的，按新版的负责人来
        reviewerId: reimbursementReviewerId,
        reviewerName: reimbursementReviewerName,
      } as never,
      user,
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'reimbursements',
      data: {
        plan: report.plan?.id ?? report.plan,
        report: report.id,
        cohort: report.cohort?.id ?? report.cohort,
        /**
         * ⚠️ 2026-11-04：报销单的**申请人**是**真正填反馈的团长**
         * （`report.submittedBy`），不是执行「采纳」的那个人。
         *
         * 以前这里写的是 `user.id`——在旧流程里 `user` 是团长（团长提交反馈时自动生成报销单），
         * 碰巧对；但第五十一轮改成「项目组采纳反馈 → 才生成报销单」之后，
         * `user` 变成了**项目组的采纳人**：
         * - 「通知团长审核结果」会通知到项目组自己头上；
         * - 「不能审核自己提交的报销」会把**报销审核负责人恰好是采纳人**的情况误伤。
         * 所以这里必须记团长。
         */
        applicant: report.submittedBy?.id ?? report.submittedBy ?? user.id,
        items,
        total,
        versions,
        status: 'submitted',
        reviewerId: reimbursementReviewerId,
        reviewerName: reimbursementReviewerName,
      } as never,
      user,
    })
  }
  // 通知「报销审核负责人」（只有他能核定这一环节）；未指定负责人时不发
  if (reimbursementReviewerId) {
    // 调用方传入的 report 不一定展开关联，这里按 id 取活动方案，拿到标题与标识
    const planId = report.plan?.id ?? report.plan
    const plan: any = await payload.findByID({
      collection: 'activity-plans',
      id: planId,
      depth: 1,
      overrideAccess: true,
    })
    await notify(payload, {
      recipient: reimbursementReviewerId,
      title: `${plan?.cohort?.name ?? '互助团'}提交了「${plan?.theme || plan?.title || ''}」的报销，请核定。`,
      link: `/activities/${plan?.slug ?? planId}`,
    })
  }
  return { ok: true }
}

/**
 * 活动反馈审核（项目组）——**采纳 / 退回**。
 *
 * 2026-11-03 第五十一轮新增。链路改成四段：
 *   活动申请 → 活动审核 → **活动反馈（采纳）** → 报销审核。
 *
 * - **采纳**（通过）：
 *   1. 反馈状态改为「已采纳」；
 *   2. 活动**自动发布到公开站**（主题 / 总结 / 现场照片对外可见）；
 *   3. **推到报销环节**：由《经费支出明细表》生成报销单，状态「待审核」。
 *      报销审核负责人**为空**时，报销单照样生成、照样显示「已提交，待审核」，
 *      但不推送通知、不进待办——之后即使设了负责人也不回审这一单。
 * - **退回**（不通过）：意见必填，反馈退回团长修改（需补充），改完重新提交。
 *
 * 谁能审：**活动审核负责人**（与「活动审核」同一个负责人，这个位置不会被置空）。
 */
export async function reviewReport(formData: FormData): Promise<ActionResult> {
  return withLock(`report:${formData.get('id')}`, () => reviewReportImpl(formData))
}

async function reviewReportImpl(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可审核活动反馈' }

  const id = String(formData.get('id') ?? '')
  const action = String(formData.get('action') ?? '')
  const comment = String(formData.get('comment') ?? '').trim()
  if (!['approved', 'rejected'].includes(action)) return { ok: false, message: '动作不合法' }
  if (action === 'rejected' && !comment) {
    return { ok: false, message: '退回反馈时必须填写需要团长补充什么' }
  }

  const payload = await getClient()
  let report: any = null
  try {
    report = await payload.findByID({
      collection: 'activity-reports',
      id,
      // depth 1：与「团长改反馈」那条已知能通过校验的路径一致——
      // 那里用 depth 1 读到的 expenseItems[].receipt 就能拿到 id。
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, message: '找不到这份活动反馈' }
  }
  if (!report) return { ok: false, message: '找不到这份活动反馈' }

  // 谁能审：活动审核负责人（这个位置不会被置空，所以反馈环节永远有人管）
  const rules = await getActivityRules(payload)
  if (rules.planReviewerId !== Number(user.id)) {
    return { ok: false, message: '只有活动审核负责人可以审核活动反馈' }
  }
  if (report.status !== 'submitted') {
    return { ok: false, message: '这份反馈不在待审核状态' }
  }
  const reportId = report.id

  /**
   * ⚠️ 只改状态时，Payload 会拿**合并后的整份文档**去跑必填校验——
   *    反馈里的《经费支出明细表》每笔都要有凭证，缺一项就把整条采纳卡住。
   *
   *    这里**不传 expenseItems**（不传 = 保留原数组，Payload 会把库里的原值合并回来），
   *    之前误传了一个「凭证没展开」的残缺版本，反而把原值覆盖掉了。
   */
  const keep = {
    location: report.location ?? '',
    actualAt: report.actualAt ?? new Date().toISOString(),
    summary: report.summary ?? '',
    attendees: report.attendees ?? [],
    photos: (report.photos ?? []).map((p: any) => p?.id ?? p),
    /**
     * 支出明细**原样带回**（不重建字段）：
     * 「凭证」是必填的，而 Payload 更新数组子字段里的 upload 关系时，
     * 要的是**完整的关系文档对象**（`{ id, filename, url, … }`），
     * 传裸 id 数组会被判「缺凭证」，把整条采纳卡住。
     * 所以这里直接用读出来的原值，不做任何转换。
     */
    expenseItems: (report.expenseItems ?? []).map((row: any) => ({
      ...row,
      receipt: (Array.isArray(row?.receipt) ? row.receipt : row?.receipt ? [row.receipt] : []).map(
        (r: any) => (r && typeof r === 'object' ? r : { id: r }),
      ),
    })),
  }

  try {
    if (action === 'rejected') {
      await payload.update({
        collection: 'activity-reports',
        id: reportId,
        data: { ...keep, status: 'revision_required', revisionNote: comment } as never,
        user: user as any,
        overrideAccess: true,
      })
      await notify(payload, {
        recipient: report.submittedBy?.id ?? report.submittedBy,
        title: `「${report.theme || '活动'}」的活动反馈需要补充，请按意见修改后重新提交。`,
        link: `/activities/${report.plan?.slug ?? ''}`,
      })
      revalidatePath('/')
      revalidatePath(`/activities/${report.plan?.slug ?? ''}`)
      return { ok: true, message: '已退回，团长可以修改后重新提交' }
    }

    // ---- 采纳：① 反馈已采纳 → ② 发布到公开站 → ③ 推到报销环节 ----
    await payload.update({
      collection: 'activity-reports',
      id: reportId,
      data: { ...keep, status: 'accepted', revisionNote: comment } as never,
      user: user as any,
      overrideAccess: true,
    })

    // ② 发布到公开站
    let publishNote = ''
    try {
      await publishReport(payload, reportId, user.id)
    } catch (err) {
      console.error('publish on report accepted failed', err)
      publishNote = '，但发布到公开站失败，请联系运维处理'
    }

    // ③ 推到报销环节
    const auto = await autoSubmitReimbursement(payload, report, user)

    await notify(payload, {
      recipient: report.submittedBy?.id ?? report.submittedBy,
      title: `「${report.theme || '活动'}」的活动反馈已采纳，活动已发布到公开站。`,
      link: `/activities/${report.plan?.slug ?? ''}`,
    })
    revalidatePath('/')
    revalidatePath(`/activities/${report.plan?.slug ?? ''}`)
    revalidatePath('/home')
    return {
      ok: true,
      message: auto.ok
        ? `反馈已采纳，活动已发布到公开站${publishNote}`
        : `反馈已采纳，活动已发布到公开站${publishNote}；但报销单未能生成：${auto.message ?? '请稍后重试'}`,
    }
  } catch (err) {
    console.error('reviewReport failed', err)
    return { ok: false, message: '操作失败，请重试' }
  }
}

/**
 * 活动报销审核（项目组）——**只审报销**。
 *
 * ⚠️ 2026-11-03 第五十一轮：反馈的审核拆出去了（见 `reviewReport`），
 *    这里只管钱——按《经费支出明细表》核定金额。
 * - 通过：按申请金额核定；
 * - 不通过：意见必填，报销单驳回，团长改完重新提交会生成新的报销单。
 *
 * 审核人快照、结果两态、意见（不通过必填）、每次审核追加一条记录。
 */
export async function reviewReimbursement(formData: FormData): Promise<ActionResult> {
  // 同一对象的"查状态 → 改状态"排队执行，防双击 / 并发重复处理（见 lib/lock.ts）
  return withLock(`reimbursement:${formData.get('id')}`, () => reviewReimbursementImpl(formData))
}

async function reviewReimbursementImpl(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可审核' }

  const id = String(formData.get('id') ?? '')
  const action = String(formData.get('action') ?? '')
  const comment = String(formData.get('comment') ?? '').trim()
  if (!['approved', 'rejected'].includes(action)) return { ok: false, message: '动作不合法' }
  if (action === 'rejected' && !comment) {
    return { ok: false, message: '审核不通过时必须填写审核意见' }
  }

  const payload = await getClient()
  let existing: any = null
  try {
    existing = await payload.findByID({
      collection: 'reimbursements',
      id,
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, message: '找不到报销单' }
  }
  const rules = await getActivityRules(payload)
  // ⚠️ 2026-11-03 第五十一轮：**按报销单自己记的审核人快照判权限**，不看当前设置。
  //    快照在报销单生成时写下（那时没人 → 一直没人）。
  //    这样「之后才设负责人」也不会把以前的活动翻出来重审。
  const assigned = existing?.reviewerId?.id ?? existing?.reviewerId ?? null
  if (!assigned) {
    return { ok: false, message: '这张报销单没有指定审核人（生成时未设置报销审核负责人），不再流转' }
  }
  if (Number(assigned) !== Number(user.id)) {
    return { ok: false, message: '只有这张报销单的审核人可以审核报销' }
  }
  if (existing?.status !== 'submitted') {
    return { ok: false, message: '这张报销单不在待审核状态' }
  }
  /**
   * ⚠️ 2026-11-04：**不再拦「不能审核自己提交的报销」**。
   *
   * 报销单是**系统代理团长提交的**（团长填反馈 → 项目组采纳 → 自动生成报销单），
   * 它的「申请人」记的是团长，不是审核人。
   * 以前拿 `applicant` 判断「是不是自己提交的」，在新流程下会误伤：
   * **报销审核负责人恰好就是采纳反馈的那个人（或团长本人）时，报销就永远审不了。**
   *
   * 「谁能核这笔钱」由**报销审核负责人**这个设置说了算（`reimbursement.reviewerId` 快照），
   * 上面已经校验过了，不再另加一条拦截。
   *
   * （活动**申请**那边的「不能审核自己提交的申请」仍然保留——
   *   那是团长真的自己填了申请，自我审批要拦。）
   */

  const reviews = Array.isArray(existing?.reviews) ? [...existing.reviews] : []
  const currentVersion = Array.isArray(existing?.versions) && existing.versions.length
    ? Number(existing.versions[existing.versions.length - 1]?.no) || 1
    : 1
  reviews.push({
    reviewer: user.id as number,
    reviewerName: user.name ?? '',
    action,
    comment,
    at: new Date().toISOString(),
    // 审的是第几版（页面按这个把审核意见对上版本）
    version: currentVersion,
  })

  try {
    await payload.update({
      collection: 'reimbursements',
      id,
      data: {
        status: action,
        reviews,
        ...(action === 'approved'
          ? {
              approvedAmount: Number(existing?.total ?? 0),
              approver: user.id,
              approvedAt: new Date().toISOString(),
            }
          : {}),
      } as never,
      user: user as any,
      // 只改状态与审核记录，不重跑整套必填校验（同 `reviewReport`）
      draft: true,
    })

    // ⚠️ 2026-11-03 第五十一轮：**不再动反馈的状态**。
    //    反馈的审核与采纳已经拆到 `reviewReport`（上一环节），
    //    这里只审钱：报销驳回时团长改的是**报销明细**，反馈本身不动。
    let publishNote = ''
    // 通知团长审核结果
    let theme = ''
    try {
      const planDoc: any = await payload.findByID({
        collection: 'activity-plans',
        id: existing?.plan?.id ?? existing?.plan,
        depth: 0,
        overrideAccess: true,
      })
      theme = planDoc?.title ?? ''
    } catch {
      // 取不到活动名就只用编号
    }
    await notify(payload, {
      recipient: existing?.applicant?.id ?? existing?.applicant,
      title:
        action === 'approved'
          ? `「${theme}」报销审核通过。`
          : `「${theme}」报销审核未通过，请按意见修改报销明细后重新提交。`,
      link: `/activities/${existing?.plan?.slug ?? ''}`,
    })
    revalidatePath('/')
    revalidatePath(`/activities/${existing?.plan?.slug ?? ''}`)
    return {
      ok: true,
      message: action === 'approved' ? '报销已核定通过' : '已驳回，请团长修改报销明细后重新提交',
    }
  } catch (err) {
    console.error('reviewReimbursement failed', err)
    return { ok: false, message: '审核失败' }
  }
}

/**
 * 修改个人信息（本人）：姓名 / 手机号 / 邮箱。
 *
 * 邮箱是登录账号——改了以后**下一次登录用新邮箱**（当前会话不受影响）。
 * 团详情页的「团长」卡读的是 cohorts.leader 这条关系指向的用户文档，
 * 所以这里改完，互助团页面的团长姓名 / 手机号 / 邮箱自动跟着变，不用再写一遍。
 * 角色 / 状态由项目组与运维管，这里不给改的口子。
 */
export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, message: '请先登录' }

  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!name) return { ok: false, message: '请填写姓名' }
  if (name.length > 40) return { ok: false, message: '姓名最多 40 个字' }
  if (!email) return { ok: false, message: '请填写邮箱' }
  if (email.length > 120) return { ok: false, message: '邮箱太长了' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: '邮箱格式不正确' }
  if (phone && !/^1\d{10}$/.test(phone)) return { ok: false, message: '手机号格式不正确' }

  const payload = await getClient()

  // 改登录邮箱 = 改账号身份：必须再输一次当前密码。
  // 否则拿到一次会话（比如别人没锁屏的电脑）就能把邮箱改成自己的，再走找回密码夺走账号。
  // 用 payload.login 校验：错一次同样计入账号的连续失败次数（连错会锁定），不能拿来爆破。
  const currentEmail = String((user as any).email ?? '').toLowerCase()
  if (email !== currentEmail) {
    const password = String(formData.get('currentPassword') ?? '')
    if (!password) return { ok: false, message: '修改邮箱需要输入当前密码' }
    try {
      await payload.login({ collection: 'users', data: { email: currentEmail, password } })
    } catch {
      return { ok: false, message: '当前密码不正确' }
    }
  }
  // 邮箱是登录身份，先查重（排除自己）
  const taken = await payload.find({
    collection: 'users',
    where: { email: { equals: email }, id: { not_equals: user.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (taken.docs.length) return { ok: false, message: '这个邮箱已经被别的账号用了' }

  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { name, phone: phone || null, email },
      user: user as any,
    })
    revalidatePath('/account')
    revalidatePath('/home')
    // 顶栏右上角显示的是姓名，刷新当前路由即可
    revalidatePath('/')
    revalidatePath('/circles')
    return { ok: true, message: '个人信息已更新' }
  } catch (err) {
    console.error('updateProfile failed', err)
    return { ok: false, message: '保存失败，请重试' }
  }
}

export async function createResource(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可上传学习资源' }

  const title = String(formData.get('title') ?? '').trim()
  const summary = String(formData.get('summary') ?? '').trim()
  if (!title) return { ok: false, message: '请填写标题' }
  if (!summary) return { ok: false, message: '请填写简介' }

  const payload = await getClient()
  // 网址里的那一段：不透明随机串，不让人手填
  const slug = await uniqueCode(async (candidate) => {
    const hit = await payload.find({
      collection: 'resources',
      where: { slug: { equals: candidate } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return hit.docs.length > 0
  })

  try {
    const file = firstFile(formData.get('file'))
    const url = String(formData.get('url') ?? '').trim()
    // 大文件走**浏览器直传**媒体接口（流式落盘），这里只收媒体 id；
    // 没有直传时才退回"经 action 传文件"（小文件才走得动）。
    // FormData 只能带字符串，而 upload 字段要的是**数字 id**（字符串会被判为非法关系）
    const mediaIdRaw = Number(formData.get('mediaId') ?? 0)
    let fileId: number | string | null = Number.isInteger(mediaIdRaw) && mediaIdRaw > 0 ? mediaIdRaw : null
    // 直传回来的媒体必须是公开文件——不能借资源把内部照片 / 视频挂到公开站
    if (fileId) {
      const media: any = await payload
        .findByID({ collection: 'media', id: fileId, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!media || media.visibility !== 'public') return { ok: false, message: '附件不存在，请重新上传' }
    }
    // 外链只收 http(s)，挡住 javascript: 之类的伪协议
    if (url && !/^https?:\/\//i.test(url)) return { ok: false, message: '外链要以 http:// 或 https:// 开头' }
    if (!fileId && file) {
      const uploaded = await uploadMedia(file, title, { user: user as any, visibility: 'public' })
      fileId = uploaded.id
    }

    // 类型是**文件形态**，不是人的选择：
    // 传了视频（或外链是视频直链）就是视频，其余一律文档。
    // 人手选只能把"页面链接的视频"标成视频，选不了一个视频文件成文档。
    const looksLikeVideo =
      Boolean(file && file.type.startsWith('video/')) || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
    const picked = String(formData.get('type') ?? 'doc')
    const type = looksLikeVideo || picked === 'video' ? 'video' : 'doc'

    await payload.create({
      collection: 'resources',
      data: {
        title,
        slug,
        type,
        category: String(formData.get('category') ?? 'guide'),
        summary,
        url,
        file: fileId,
        tags: [],
        publishedAt: new Date().toISOString(),
        author: user.id,
      } as never,
      user: user as any,
    })
    revalidatePath('/resources')
    revalidatePath('/assets')
    revalidatePath('/')
    return { ok: true }
  } catch (err) {
    console.error('createResource failed', err)
    return { ok: false, message: '上传失败，请检查填写内容' }
  }
}

/**
 * 改资源（项目组）。
 *
 * 资源是**公开内容**：一改，公众站上立刻就变了。所以：
 * - 只允许改白名单里的字段（标题 / 简介 / 分类 / 外链 / 附件 / 推荐位）；
 * - **地址标识（slug）不改**——改了等于换地址，已经发出去的链接会失效；
 * - 附件可以换（重新传一个），没传就保持原样（不是"清空附件"）。
 */
export async function updateResource(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可修改资源' }

  const id = Number(formData.get('id') ?? 0)
  if (!id) return { ok: false, message: '资源不存在' }

  const title = String(formData.get('title') ?? '').trim()
  const summary = String(formData.get('summary') ?? '').trim()
  if (!title) return { ok: false, message: '请填写标题' }
  if (!summary) return { ok: false, message: '请填写简介' }

  const payload = await getClient()
  try {
    const current: any = await payload.findByID({
      collection: 'resources',
      id,
      depth: 0,
      overrideAccess: true,
    })
    if (!current) return { ok: false, message: '资源不存在' }

    const url = String(formData.get('url') ?? '').trim()
    // 外链只收 http(s)，挡住 javascript: 之类的伪协议
    if (url && !/^https?:\/\//i.test(url)) {
      return { ok: false, message: '外链要以 http:// 或 https:// 开头' }
    }

    // 附件：传了就换，没传就保持原来的
    const file = firstFile(formData.get('file'))
    const mediaIdRaw = Number(formData.get('mediaId') ?? 0)
    let fileId: number | string | null = Number.isInteger(mediaIdRaw) && mediaIdRaw > 0 ? mediaIdRaw : null
    if (fileId) {
      const media: any = await payload
        .findByID({ collection: 'media', id: fileId, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!media || media.visibility !== 'public') {
        return { ok: false, message: '附件不存在，请重新上传' }
      }
    } else if (file) {
      const uploaded = await uploadMedia(file, title, { user: user as any, visibility: 'public' })
      fileId = uploaded.id
    }

    const data: Record<string, unknown> = {
      title,
      summary,
      category: String(formData.get('category') ?? current.category ?? 'guide'),
      url,
    }
    if (fileId) data.file = fileId
    // 类型跟着新附件走：换了视频文件就是视频，其余保持原类型
    const looksLikeVideo =
      Boolean(file && file.type.startsWith('video/')) || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
    if (fileId) data.type = looksLikeVideo ? 'video' : String(formData.get('type') ?? current.type ?? 'doc')

    await payload.update({
      collection: 'resources',
      id,
      data: data as never,
      user: user as any,
    })

    revalidatePath('/resources')
    revalidatePath('/assets')
    revalidatePath('/')
    return { ok: true }
  } catch (err) {
    console.error('updateResource failed', err)
    return { ok: false, message: '保存失败，请检查填写内容' }
  }
}

/**
 * 删资源（项目组）。
 *
 * 资源全部公开，删了就是**公众站上立刻没有了**——所以前端先二次确认。
 * 附件文件本身留在媒体库里（可能还被别的记录引用），这里只删这一条资源。
 */
export async function deleteResource(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可删除资源' }

  const id = Number(formData.get('id') ?? 0)
  if (!id) return { ok: false, message: '资源不存在' }

  const payload = await getClient()
  try {
    await payload.delete({ collection: 'resources', id, user: user as any })
    revalidatePath('/resources')
    revalidatePath('/assets')
    revalidatePath('/')
    return { ok: true }
  } catch (err) {
    console.error('deleteResource failed', err)
    return { ok: false, message: '删除失败，请重试' }
  }
}

/**
 * 设置**统一**年度预算（项目组）。
 *
 * 一改就作用于这一年度**所有没有单独设过额度**的互助团；
 * 已经单独设过的团不受影响（那是「单独修改」）。
 */
export async function setDefaultBudget(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可设置年度预算' }

  const year = Number(formData.get('year') ?? 0)
  const amount = Number(formData.get('amount') ?? 0)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, message: '请选择正确的年度' }
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, message: '预算金额不能是负数' }
  }

  const payload = await getClient()
  try {
    const existing = await payload.find({
      collection: 'annual-budget-settings',
      where: { year: { equals: year } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const data = {
      year,
      defaultAmount: Math.round(amount),
      note: String(formData.get('note') ?? '').trim(),
      updatedBy: Number(user.id),
    }
    if (existing.docs?.[0]) {
      await payload.update({
        collection: 'annual-budget-settings',
        id: existing.docs[0].id,
        data: data as never,
        user: user as any,
      })
    } else {
      await payload.create({
        collection: 'annual-budget-settings',
        data: data as never,
        user: user as any,
      })
    }
    revalidatePath('/budget')
    return { ok: true, message: `${year} 年的统一年度预算已设为 ${Math.round(amount)} 元` }
  } catch (err) {
    console.error('setDefaultBudget failed', err)
    return { ok: false, message: '保存失败，请重试' }
  }
}

/**
 * **批量**设置年度预算（项目组）。
 *
 * 「大多数团 5000、少数团 3000」这种事，一个一个点太折磨：
 * 先「统一设置」给全体一个数，再把**要例外的那几个勾起来**一次改掉。
 * 勾选与金额都在表单里传过来，服务端逐个 upsert。
 */
export async function setBudgetForMany(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可设置年度预算' }

  const year = Number(formData.get('year') ?? 0)
  const amount = Number(formData.get('amount') ?? 0)
  const cohortIds = formData
    .getAll('cohort')
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0)

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, message: '请选择正确的年度' }
  }
  if (!cohortIds.length) return { ok: false, message: '请先勾选要设置的互助团' }
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, message: '预算金额不能是负数' }
  }

  const payload = await getClient()
  try {
    const note = String(formData.get('note') ?? '').trim()
    for (const cohortId of cohortIds) {
      const existing = await payload.find({
        collection: 'cohort-budgets',
        where: { and: [{ cohort: { equals: cohortId } }, { year: { equals: year } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const data = {
        cohort: cohortId,
        year,
        amount: Math.round(amount),
        note,
        updatedBy: Number(user.id),
      }
      if (existing.docs?.[0]) {
        await payload.update({
          collection: 'cohort-budgets',
          id: existing.docs[0].id,
          data: data as never,
          user: user as any,
        })
      } else {
        await payload.create({
          collection: 'cohort-budgets',
          data: data as never,
          user: user as any,
        })
      }
    }
    revalidatePath('/budget')
    return {
      ok: true,
      message: `已把 ${cohortIds.length} 个团的 ${year} 年预算设为 ${Math.round(amount)} 元`,
    }
  } catch (err) {
    console.error('setBudgetForMany failed', err)
    return { ok: false, message: '保存失败，请重试' }
  }
}

/**
 * **批量**取消单独额度（项目组）：这些团回到「统一额度」。
 *
 * 例外取消了就该能一键收回——否则额度表只增不减，越攒越乱。
 */
export async function clearBudgetOverrides(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可修改年度预算' }

  const year = Number(formData.get('year') ?? 0)
  const cohortIds = formData
    .getAll('cohort')
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0)
  if (!cohortIds.length) return { ok: false, message: '请先勾选要处理的互助团' }

  const payload = await getClient()
  try {
    const existing = await payload.find({
      collection: 'cohort-budgets',
      where: {
        and: [{ cohort: { in: cohortIds } }, { year: { equals: year } }],
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of existing.docs ?? []) {
      await payload.delete({
        collection: 'cohort-budgets',
        id: doc.id,
        user: user as any,
      })
    }
    revalidatePath('/budget')
    return {
      ok: true,
      message: `已取消 ${(existing.docs ?? []).length} 个团的单独额度，它们回到统一额度`,
    }
  } catch (err) {
    console.error('clearBudgetOverrides failed', err)
    return { ok: false, message: '操作失败，请重试' }
  }
}

/**
 * 设置**单个互助团**的年度预算（项目组）。
 *
 * 这一条会**覆盖**该年度的统一额度（只对这个团）。
 */
export async function setCohortBudget(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可设置年度预算' }

  const year = Number(formData.get('year') ?? 0)
  const cohortId = Number(formData.get('cohort') ?? 0)
  const amount = Number(formData.get('amount') ?? 0)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, message: '请选择正确的年度' }
  }
  if (!cohortId) return { ok: false, message: '请选择互助团' }
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, message: '预算金额不能是负数' }
  }

  const payload = await getClient()
  try {
    const existing = await payload.find({
      collection: 'cohort-budgets',
      where: { and: [{ cohort: { equals: cohortId } }, { year: { equals: year } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const data = {
      cohort: cohortId,
      year,
      amount: Math.round(amount),
      note: String(formData.get('note') ?? '').trim(),
      updatedBy: Number(user.id),
    }
    if (existing.docs?.[0]) {
      await payload.update({
        collection: 'cohort-budgets',
        id: existing.docs[0].id,
        data: data as never,
        user: user as any,
      })
    } else {
      await payload.create({
        collection: 'cohort-budgets',
        data: data as never,
        user: user as any,
      })
    }
    revalidatePath('/budget')
    return { ok: true, message: '已保存这个团的年度预算' }
  } catch (err) {
    console.error('setCohortBudget failed', err)
    return { ok: false, message: '保存失败，请重试' }
  }
}

/**
 * 生成密码重置链接（项目组）。
 *
 * **为什么不给团长自助重置**：没有邮件也没有短信，账号与手机号没法互相验证——
 * 谁都能填一个别人的邮箱要求重置，那就等于把账号送人。
 * 所以只有项目组能发起（见 docs/设计规范.md §4.8）。
 *
 * **为什么是链接而不是直接设新密码**：项目组不该知道团长的密码。
 * 链接由团长自己打开、自己设新密码，用过即失效，固定 7 天有效。
 */
export async function createPasswordReset(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可重置密码' }

  const targetId = Number(formData.get('user') ?? 0)
  if (!targetId) return { ok: false, message: '请选择要重置的账号' }

  const payload = await getClient()
  try {
    const target: any = await payload
      .findByID({ collection: 'users', id: targetId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!target) return { ok: false, message: '账号不存在' }
    // 只能给团长发重置链接：项目组账号（含自己）由运维在后台处理——
    // 否则任何项目组成员都能重置「审核负责人」的密码、冒用他去审核
    if (String(target.id) === String(user.id) || (target.roles ?? []).includes('projectTeam')) {
      return { ok: false, message: '项目组账号的密码请联系运维重置' }
    }

    // 重新生成之前，把这个人**还没用过**的旧链接收掉：
    // 同一时间只留一条有效链接，免得旧链接在外头乱传。
    const now = new Date().toISOString()
    await payload.update({
      collection: 'password-resets',
      where: { and: [{ user: { equals: targetId } }, { usedAt: { exists: false } }] },
      data: { usedAt: now },
      overrideAccess: true,
    })

    const token = await uniqueCode(async (candidate) => {
      const hit = await payload.find({
        collection: 'password-resets',
        where: { token: { equals: candidate } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      return hit.docs.length > 0
    })

    await payload.create({
      collection: 'password-resets',
      data: {
        token,
        user: targetId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        // 关系字段要的是数字 id（当前用户的 id 类型是 string | number）
        createdBy: Number(user.id),
      },
      overrideAccess: true,
    })

    const link = `${workspaceSiteUrl()}/reset-password?token=${token}`
    return { ok: true, message: '链接已生成，发给本人即可', data: { link } }
  } catch (err) {
    console.error('createPasswordReset failed', err)
    return { ok: false, message: '生成失败，请重试' }
  }
}

/**
 * 生成邀请链接（项目组）。
 *
 * 两种用途：`create-cohort`（对方成为团长）与 `join-cohort`（加入指定互助团）。
 * 链接用随机 token，**不是邀请码**——码要人肉转述，链接能直接发出去。
 */
export async function createInvitationLink(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, message: '请先登录' }
  if (!user.roles?.includes('projectTeam')) {
    return { ok: false, message: '只有项目组可以发起邀请' }
  }

  const purpose = String(formData.get('purpose') ?? 'create-cohort')
  if (!['create-cohort', 'transfer-lead'].includes(purpose)) {
    return { ok: false, message: '用途不合法' }
  }

  const cohortId = Number(formData.get('cohort') ?? 0) || null
  if (purpose === 'transfer-lead' && !cohortId) {
    return { ok: false, message: '请选择要移交的互助团' }
  }

  // 有效期：自创建起 7×24 小时（唯一口径在 lib/invitation.ts 的 INVITE_VALID_MS）
  const VALID_MS = INVITE_VALID_MS
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: '邮箱格式不正确' }

  // 随机 token：16 位大写字母数字（去掉易混淆字符），用**密码学安全**的随机数——
  // 链接就是凭证，拿到就能注册成团长，不能用 Math.random 这种可预测的伪随机
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let token = ''
  for (let i = 0; i < 16; i += 1) {
    token += alphabet[randomInt(alphabet.length)]
  }

  const payload = await getClient()
  if (cohortId) {
    const cohort = await payload
      .findByID({ collection: 'cohorts', id: cohortId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!cohort) return { ok: false, message: '找不到这个互助团' }
  }
  try {
    // 同一时间只保留一条有效链接：生成新的之前，把旧的那条置为「已撤销」。
    // create-cohort 是全局唯一；transfer-lead 按团唯一（每个团一个转移链接）。
    const activeScope =
      purpose === 'create-cohort'
        ? {
            and: [{ purpose: { equals: 'create-cohort' } }, { status: { equals: 'active' } }],
          }
        : {
            and: [
              { purpose: { equals: 'transfer-lead' } },
              { cohort: { equals: cohortId } },
              { status: { equals: 'active' } },
            ],
          }
    const previous = await payload.find({
      collection: 'invitation-links',
      where: activeScope as never,
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of previous.docs) {
      await payload.update({
        collection: 'invitation-links',
        id: doc.id,
        data: { status: 'revoked' },
        overrideAccess: true,
      })
    }

    await payload.create({
      collection: 'invitation-links',
      data: {
        token,
        purpose,
        email: email || null,
        cohort: cohortId,
        note: String(formData.get('note') ?? ''),
        invitedBy: user.id,
        expiresAt: new Date(Date.now() + VALID_MS).toISOString(),
        status: 'active',
      } as never,
      user: user as any,
    })
    revalidatePath('/circles/new')
    revalidatePath('/circles')
    // 链接指向**工作台域**（注册页在那边，公众域的 /join 一律 404）。
    // 地址取配置，不取请求头（Host / X-Forwarded-Host 能被伪造成钓鱼域名）
    return { ok: true, message: `${workspaceSiteUrl()}/join?token=${token}` }
  } catch (err) {
    console.error('createInvitationLink failed', err)
    return { ok: false, message: '生成失败，请重试' }
  }
}

/**
 * 互助团资料统一编辑（2026-11-01 第三十五轮）。
 *
 * 主页图、地域、骨干成员**一次提交一起存**：
 * 建团时填错地域是常事（只填到省、填错市），事后要能改；
 * 但分散在三处分别保存容易漏改一半，所以合并成一个动作。
 *
 * 地域只校验「省必填」——填到哪一级，团就落在哪一级（与建团同一口径）。
 * 换图是可选的：不选文件就不动 `cover`。
 *
 * 权限：本团团长或项目组。
 */
export async function updateCohortProfile(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { ok: false, message: '请先登录' }

  const cohortId = String(formData.get('cohortId') ?? '')
  if (!cohortId) return { ok: false, message: '参数不完整' }

  const payload = await getClient()
  const cohort = (await payload.findByID({
    collection: 'cohorts',
    id: cohortId,
    depth: 0,
    overrideAccess: true,
  })) as any
  if (!cohort) return { ok: false, message: '互助团不存在' }

  const isLead = resolveId(cohort.leader) === Number(user.id)
  if (!isLead && !user.roles?.includes('projectTeam')) {
    return { ok: false, message: '只有本团团长或项目组可以编辑互助团资料' }
  }

  // 地域：省必填，市 / 区县可留空（只填到省也是合法的团）
  const province = String(formData.get('province') ?? '').trim()
  const provinceCode = String(formData.get('provinceCode') ?? '').trim()
  if (!province || !provinceCode) {
    return { ok: false, message: '请选择所在省' }
  }
  const location = {
    province,
    provinceCode,
    city: String(formData.get('city') ?? '').trim(),
    cityCode: String(formData.get('cityCode') ?? '').trim(),
    district: String(formData.get('district') ?? '').trim(),
    districtCode: String(formData.get('districtCode') ?? '').trim(),
  }
  // 地名来自地域下拉（行政区划），代码是 6 位 adcode：表单之外伪造的长串 / 乱码一律拒
  const ADCODE = /^\d{6}$/
  const badName = [location.province, location.city, location.district].some((n) => n.length > 30)
  const badCode = [location.provinceCode, location.cityCode, location.districtCode].some(
    (c) => c !== '' && !ADCODE.test(c),
  )
  if (badName || badCode || (location.city && !location.cityCode) || (location.district && !location.districtCode)) {
    return { ok: false, message: '所在地域不正确，请重新从下拉里选' }
  }
  // `cohorts.region` 是 location 的**冗余文本快照**（公开站在 regionShort 缺失时回落到它）。
  // 改了地域就要同步它，否则两处数据打架（地图在一个省、名录写着另一个省）。
  const region = formatPlace(location.province, location.city, location.district)

  const read = (key: string) =>
    String(formData.get(key) ?? '')
      .trim()
      .slice(0, 20)
  const team = {
    viceLeader: read('viceLeader'),
    resourceLiaison: read('resourceLiaison'),
    materials: read('materials'),
    media: read('media'),
  }

  // 运行状态：**只有项目组能改**（团长改不了自己团的状态）。
  // 解散时间在服务端记（切到「解散」的那一刻），切回「运行中」清空。
  const rawStatus = String(formData.get('status') ?? '').trim()
  let statusPatch: { status: 'active' | 'closed'; dissolvedAt: string | null } | null = null
  if (rawStatus) {
    if (!user.roles?.includes('projectTeam')) {
      return { ok: false, message: '只有项目组可以调整互助团状态' }
    }
    if (!['active', 'closed'].includes(rawStatus)) {
      return { ok: false, message: '状态不合法' }
    }
    if (rawStatus !== String(cohort.status ?? '')) {
      statusPatch = {
        status: rawStatus as 'active' | 'closed',
        dissolvedAt: rawStatus === 'closed' ? new Date().toISOString() : null,
      }
    }
  }

  // 换图是可选的：不选文件就不动 cover
  const file = firstFile(formData.get('cover'))
  if (file && !file.type.startsWith('image/')) {
    return { ok: false, message: '主页大图只能是图片' }
  }
  if (file && file.size > 20 * 1024 * 1024) {
    return { ok: false, message: '图片不能超过 20MB' }
  }

  try {
    let coverId = cohort.cover?.id ?? cohort.cover
    if (file) {
      const uploaded = await uploadMedia(file, `${cohort.name} 主页大图`, {
        user: user as any,
        visibility: 'public',
        cohort: cohort.id,
      })
      coverId = uploaded.id
    }

    await payload.update({
      collection: 'cohorts',
      id: cohort.id,
      data: { location, region, team, cover: coverId, ...(statusPatch ?? {}) },
      user: user as any,
    })
    revalidatePath('/circles')
    revalidatePath('/circles/all')
    revalidatePath(`/circles/${cohort.slug}`)
    revalidatePath(`/network/${cohort.slug}`)
    return { ok: true, message: '已保存' }
  } catch (err) {
    if (err instanceof UploadTypeError) return { ok: false, message: err.message }
    console.error('updateCohortProfile failed', err)
    return { ok: false, message: '保存失败，请重试' }
  }
}

/**
 * ⚠️ 互助团状态**不再有单独的动作**（2026-11-02 第四十一轮）：
 * 改状态收进了 `updateCohortProfile`（页头的「编辑资料」弹窗里一次提交），
 * 写入口只留一个。原来的 `updateCohortStatus` 与滑块开关组件一并删掉。
 */

/** 登出：交给 /logout 页面走 Payload 的 POST /api/users/logout 清 cookie */
export async function logout() {
  redirect('/logout')
}

/** 关系字段可能是 id 或已展开的文档，这里统一取出数字 id */
function resolveId(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    // ⚠️ 空串是「未选」：Number('') 是 0，会被当成 id=0 用掉。
    //    「不设置」选项的哨兵值（`__none__`）同理——都不是有效的 id。
    const text = value.trim()
    if (!text) return null
    const n = Number(text)
    return Number.isFinite(n) ? n : null
  }
  const id = (value as any)?.id
  if (typeof id === 'number') return id
  const parsed = Number(id)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 一条经费明细（预算表 / 支出明细表共用一套结构）。
 *
 * 2026-11-02 第四十六轮：**「费用项目 + 数量与规格」合并成一列**，
 * 明细由人**手动填**（写清实际发生的东西或服务），不再要求来自类目树。
 * 类目树只管**一级类别**：必须是项目组在「设置」里维护的大类之一。
 *
 * `categories`：当前生效的类目树（设置里的）；
 * `legacyCategories`：这条记录**原来就有**的类别
 * （后来被从清单里删了/改名了的老类别，仍然允许保留——老记录照常能编辑提交）。
 *
 * 返回 `problems`：哪一行缺什么（要写清是哪一行，右侧「处理」面板里直接说）。
 */
type ExpenseDetailRow = {
  category: string
  item: string
  description: string
  amount: number
  note?: string
}

function collectExpenseDetails(
  formData: FormData,
  categories: BudgetCategoryDef[],
  legacyCategories: string[] = [],
  label = '明细',
): { rows: ExpenseDetailRow[]; problems: string[] } {
  const categoriesRaw = formData.getAll('category')
  const items = formData.getAll('item')
  const descriptions = formData.getAll('description')
  const amounts = formData.getAll('amount')
  const notes = formData.getAll('note')
  const allowed = new Set(categories.map((cat) => cat.name))
  const legacy = new Set(legacyCategories.map((v) => String(v ?? '').trim()).filter(Boolean))
  const rows: ExpenseDetailRow[] = []
  const problems: string[] = []

  items.forEach((raw, index) => {
    const item = String(raw ?? '').trim()
    const amount = Number(amounts[index] ?? 0)
    const category = String(categoriesRaw[index] ?? '').trim()
    const hasAmount = Number.isFinite(amount) && amount > 0
    // 整行都是空的：忽略（用户多留了一行空白）
    if (!item && !hasAmount) return
    const no = index + 1
    if (!item) {
      problems.push(`第 ${no} 行没写${label}`)
      return
    }
    if (!hasAmount) {
      problems.push(`第 ${no} 行没填金额`)
      return
    }
    if (!category) {
      problems.push(`第 ${no} 行没选费用类别`)
      return
    }
    // 一级类别必须在清单里（不信前端：前端传来的类别名要过一遍系统口径）
    if (!allowed.has(category) && !legacy.has(category)) {
      problems.push(`第 ${no} 行的费用类别「${category}」不在清单里，请重新选择`)
      return
    }
    rows.push({
      category,
      item,
      // 「数量与规格」已并入明细（第四十六轮）；这里只接历史表单带过来的值
      description: String(descriptions[index] ?? '').trim(),
      amount,
      note: notes[index] ? String(notes[index]) : undefined,
    })
  })

  return { rows, problems }
}

/** 解析签到名单（《活动签到表》：attendeeName[] / attendeeOrg[] / attendeePosition[] / attendeeSigned[]） */
function collectAttendees(formData: FormData) {
  const names = formData.getAll('attendeeName')
  const orgs = formData.getAll('attendeeOrg')
  const positions = formData.getAll('attendeePosition')
  const signeds = formData.getAll('attendeeSigned')
  const attendees: Record<string, unknown>[] = []
  names.forEach((name, index) => {
    const value = String(name ?? '').trim()
    if (!value) return
    attendees.push({
      name: value,
      organization: String(orgs[index] ?? ''),
      position: String(positions[index] ?? ''),
      signed: String(signeds[index] ?? '') === 'on',
    })
  })
  return attendees
}

/**
 * 读一条记录**原本就有**的费用类别名单。
 *
 * 用途：项目组后来改了费用类目清单（删了某个类别、改了名字），
 * 已经存在的记录里那个类别**仍然允许保留**——
 * 这就是"后续改动不影响之前已经提交的数据"的落点。
 *
 * （第四十六轮起，明细正文由人手动填、不再要求在清单里，
 *  所以要保留下来的只有**一级类别**。）
 */
async function legacyBudgetCategories(
  collection: 'activity-plans' | 'activity-reports',
  id: string,
): Promise<string[]> {
  if (!id) return []
  try {
    const payload = await getClient()
    const doc: any = await payload.findByID({
      collection,
      id,
      depth: 0,
      overrideAccess: true,
    })
    const source = collection === 'activity-plans' ? doc?.budgetItems : doc?.expenseItems
    return ((source ?? []) as any[])
      .map((row) => String(row?.category ?? '').trim())
      .filter(Boolean)
  } catch {
    return [] as string[]
  }
}

/**
 * 解析《经费支出明细表》子表（凭证为 receipt 文件）。
 *
 * 与预算表同一套结构与同一套校验（第四十六轮）：
 * 费用类别从清单里选，明细手动写。
 */
function collectExpenseRows(
  formData: FormData,
  categories: BudgetCategoryDef[],
  legacyCategories: string[] = [],
) {
  return collectExpenseDetails(formData, categories, legacyCategories, '实际支出明细')
}

/**
 * 活动设置（项目组）：预算合计上限、预计参与人数下限、两个审核环节的负责人、费用类别清单。
 * 负责人只能从项目组成员中选（全局配置的钩子再兜一次）。
 *
 * ⚠️ **两张卡各存各的**（2026-11-02 第四十一轮）：
 * 「活动规则」与「费用类别」是页面上的两张卡、两个表单，
 * 但服务端以前**只认一个动作**——那张卡提交另一半字段，
 * 于是两边都存不进去（少了预算上限就报错，少了费用类别也报错）。
 * 现在拆成两个动作：各存各的，互不牵连。
 */

/** 把「改了什么」追加到修改记录（审核负责人换人必须留痕） */
async function appendChangeLog(payload: any, before: any, user: any, changes: string[]) {
  const changeLog = [
    ...(Array.isArray(before?.changeLog) ? before.changeLog : []).map((row: any) => ({
      at: row.at,
      by: resolveId(row.by),
      byName: row.byName,
      summary: row.summary,
    })),
    ...(changes.length
      ? [{ at: new Date().toISOString(), by: Number(user.id), byName: user.name ?? '', summary: changes.join('；') }]
      : []),
  ]
  await payload.updateGlobal({
    slug: 'activity-settings' as any,
    data: { changeLog } as any,
    user: user as any,
  })
}

/** 活动规则：预算上限、人数下限、两个审核负责人 */
export async function updateActivityRules(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可修改活动设置' }

  const budgetMax = Number(formData.get('budgetMax'))
  if (!Number.isFinite(budgetMax) || budgetMax <= 0) {
    return { ok: false, message: '预算合计上限请填写大于 0 的金额' }
  }
  const participantsMin = Number(formData.get('participantsMin'))
  if (!Number.isInteger(participantsMin) || participantsMin < 1) {
    return { ok: false, message: '预计参与人数下限请填写不小于 1 的整数' }
  }
  const planReviewer = resolveId(formData.get('planReviewer'))
  const reimbursementReviewer = resolveId(formData.get('reimbursementReviewer'))
  // 活动审核负责人必须有人（没人就没人能批活动）
  if (!planReviewer) {
    return { ok: false, message: '请为活动审核环节选择一位负责人' }
  }
  // ⚠️ 2026-11-03 第五十一轮：**报销审核负责人可以为空**。
  //    空着 = 暂不开展报销核定：反馈照样被采纳、照样发布到公开站，
  //    报销单照样生成并显示「已提交，待审核」，但**不进待办、没人能审**。
  //    之后即使设了负责人，也不回审以前的活动（见 reimbursement 的 reviewer 快照）。

  const payload = await getClient()
  try {
    // 修改记录：对比旧值写一句"改了什么"，追加到 changeLog（审核负责人换人必须留痕）
    const before: any = await payload.findGlobal({ slug: 'activity-settings' as any, depth: 1, overrideAccess: true })
    const nameOf = async (id: number | null) =>
      id
        ? String(
            ((await payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true }).catch(() => null)) as any)
              ?.name ?? id,
          )
        : '（未指定）'
    const changes: string[] = []
    if (Number(before?.budgetMax) !== budgetMax) changes.push(`预算上限 ${before?.budgetMax ?? '—'} → ${budgetMax} 元`)
    if (Number(before?.participantsMin) !== participantsMin) {
      changes.push(`人数下限 ${before?.participantsMin ?? '—'} → ${participantsMin} 人`)
    }
    if (resolveId(before?.planReviewer) !== planReviewer) {
      changes.push(`活动审核负责人 ${await nameOf(resolveId(before?.planReviewer))} → ${await nameOf(planReviewer)}`)
    }
    if (resolveId(before?.reimbursementReviewer) !== reimbursementReviewer) {
      changes.push(
        `报销审核负责人 ${await nameOf(resolveId(before?.reimbursementReviewer))} → ${await nameOf(reimbursementReviewer)}`,
      )
    }
    await payload.updateGlobal({
      slug: 'activity-settings' as any,
      data: {
        budgetMax,
        participantsMin,
        planReviewer,
        reimbursementReviewer,
      } as any,
      user: user as any,
    })
    await appendChangeLog(payload, before, user, changes)
  } catch (err) {
    console.error('updateActivityRules failed', err)
    // 只把我们自己写的中文校验提示（全局配置钩子里抛的）给到前端；其余内部错误不外露
    const text = err instanceof Error ? err.message : ''
    return { ok: false, message: /[\u4e00-\u9fa5]/.test(text) && text.length < 80 ? text : '保存失败，请重试' }
  }
  revalidatePath('/settings')
  revalidatePath('/')
  return { ok: true, message: '已保存' }
}

/**
 * 费用类别清单（项目组）：**只有一级**（2026-11-03 第五十一轮移除二级明细项）。
 *
 * 表单用 `expenseCategory[]` 提交（每个一个类别名）。
 * 单独一个动作：改类别不该因为「预算上限没填」而存不进去，反之亦然。
 */
export async function updateExpenseCategories(formData: FormData): Promise<ActionResult> {
  const user = await currentUser()
  if (!user?.roles?.includes('projectTeam')) return { ok: false, message: '仅项目组可修改费用类别' }

  const rawCategories = formData.getAll('expenseCategory')
  const expenseCategories: { category: string }[] = []
  for (const rawCategory of rawCategories) {
    const category = String(rawCategory ?? '').trim()
    if (!category) continue
    if (expenseCategories.some((row) => row.category === category)) {
      return { ok: false, message: `费用类别「${category}」重复了，请合并后再保存` }
    }
    expenseCategories.push({ category })
  }
  if (!expenseCategories.length) {
    return { ok: false, message: '至少保留一个费用类别' }
  }

  const payload = await getClient()
  try {
    const before: any = await payload.findGlobal({ slug: 'activity-settings' as any, depth: 1, overrideAccess: true })
    await payload.updateGlobal({
      slug: 'activity-settings' as any,
      data: { expenseCategories } as any,
      user: user as any,
    })
    // 费用类别：只记数量变化，不逐条刷屏（改了什么在设置页看得见）
    const changes: string[] = []
    const beforeCategoryCount = (before?.expenseCategories ?? []).length
    if (beforeCategoryCount !== expenseCategories.length) {
      changes.push(`费用类别 ${beforeCategoryCount} → ${expenseCategories.length} 类`)
    }
    await appendChangeLog(payload, before, user, changes)
  } catch (err) {
    console.error('updateExpenseCategories failed', err)
    const text = err instanceof Error ? err.message : ''
    return { ok: false, message: /[\u4e00-\u9fa5]/.test(text) && text.length < 80 ? text : '保存失败，请重试' }
  }
  revalidatePath('/settings')
  revalidatePath('/')
  return { ok: true, message: '已保存' }
}
