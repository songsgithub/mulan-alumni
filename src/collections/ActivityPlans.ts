import type { CollectionConfig } from 'payload'

import { isCohortLead, isManager, opsOnly, planRead } from '../access'
import { generateSlug } from '../lib/slug'

/** 人均经费（元）：预算合计 ÷ 预计参与人数，保留两位小数 */
const perPersonBudget = (total: number, participants: number): number =>
  participants > 0 ? Math.round((total / participants) * 100) / 100 : 0

/**
 * 活动方案（SOP 第一步：团长提交活动方案，含活动经费）
 * 状态：draft → submitted → approved / rejected / revision_required → implemented → closed
 */
export const ActivityPlans: CollectionConfig = {
  slug: 'activity-plans',
  labels: {
    singular: '活动方案',
    plural: '活动方案',
  },
  admin: {
    group: '活动与经费',
    useAsTitle: 'title',
    defaultColumns: ['title', 'cohort', 'proposer', 'plannedAt', 'budgetTotal', 'status'],
  },
  access: {
    read: planRead,
    // 起草 / 编辑 / 提交 / 审批都走服务端动作（校验团长归属、状态机与指定审核人）；
    // REST 直接写入只给后台账号——否则团长 PATCH status=approved 就能自己批自己
    create: opsOnly,
    update: opsOnly,
    delete: opsOnly,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: '活动名称',
      required: true,
      admin: {
        description: '中文人话，写活动的主题（"AI 工具共学工作坊（第 3 期）"）。',
      },
    },
    {
      name: 'slug',
      type: 'text',
      label: '地址标识',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          '地址栏里的那一段（/activities/<标识>）。不透明随机串，不带编号、拼音或城市。',
      },
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      label: '所属互助团',
      required: true,
      index: true,
    },
    {
      name: 'proposer',
      type: 'relationship',
      relationTo: 'users',
      label: '提交人（团长）',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'applicantName',
      type: 'text',
      label: '申报人（提交时快照）',
      admin: {
        readOnly: true,
        description: '提交申请那一刻的团长姓名；之后改个人信息不改这里',
      },
    },
    {
      name: 'form',
      type: 'select',
      label: '活动形式',
      defaultValue: 'offline',
      options: [
        { label: '线下', value: 'offline' },
        { label: '线上', value: 'online' },
        { label: '线上线下结合', value: 'hybrid' },
      ],
    },
    {
      name: 'theme',
      type: 'text',
      label: '主题方向',
    },
    {
      name: 'kind',
      type: 'select',
      label: '活动类别',
      // 公开站的类别筛选按它来；数据库层不强制（空草稿先建出来，表单里再要求选）
      options: [
        { label: '技能提升类', value: '技能提升类' },
        { label: 'AI素养类', value: 'AI素养类' },
        { label: '健康科普类', value: '健康科普类' },
        { label: '生活成长类', value: '生活成长类' },
      ],
    },
    {
      name: 'plannedAt',
      type: 'date',
      label: '计划时间',
      // 数据库层不强制：空草稿先建出来，表单里再要求填
    },
    {
      name: 'location',
      type: 'text',
      label: '活动地点',
    },
    {
      name: 'goals',
      type: 'textarea',
      label: '活动目标',
      // 同上：草稿可以先空着
    },
    {
      name: 'participants',
      type: 'number',
      label: '预计参与人数',
      defaultValue: 0,
    },
    {
      name: 'budgetItems',
      type: 'array',
      label: '《经费预算明细表》',
      admin: {
        description:
          '序号自动；费用类别一级从清单里选；明细手动写（写清实际的东西或服务）；金额逐项填写',
      },
      fields: [
        {
          name: 'category',
          type: 'text',
          label: '费用类别（一级）',
          required: true,
        },
        {
          name: 'item',
          type: 'text',
          label: '预算明细',
          required: true,
          admin: {
            description:
              '第四十六轮起「费用项目 + 数量与规格」合并成一列：按实际发生的东西或服务写，不必照抄清单里的名字',
          },
        },
        {
          name: 'description',
          type: 'text',
          label: '数量与规格（历史字段）',
          admin: {
            description: '旧记录里的「数量与规格」，新记录不再填；展示时会并进明细里',
          },
        },
        {
          name: 'tier',
          type: 'select',
          label: '档位（历史字段）',
          defaultValue: 'open',
          admin: { hidden: true },
          options: [
            { label: '默认开放', value: 'open' },
            { label: '需项目组确认', value: 'confirm' },
          ],
        },
        {
          name: 'amount',
          type: 'number',
          label: '金额（元）',
          required: true,
        },
    {
      name: 'note',
      type: 'text',
      label: '备注',
    },
  ],
    },
    {
      name: 'budgetTotal',
      type: 'number',
      label: '预算合计（元）',
      admin: {
        readOnly: true,
      },
      defaultValue: 0,
    },
    {
      name: 'budgetPerPerson',
      type: 'number',
      label: '人均经费（元）',
      admin: {
        readOnly: true,
        description: '预算合计 ÷ 预计参与人数',
      },
      defaultValue: 0,
    },
    {
      name: 'ruleBudgetMax',
      type: 'number',
      label: '建立时的预算上限（元）',
      admin: {
        readOnly: true,
        description: '建立活动时记下的预算合计上限；之后修改活动设置，这份活动仍按它的规则走',
      },
    },
    {
      name: 'ruleParticipantsMin',
      type: 'number',
      label: '建立时的预计人数下限（人）',
      admin: {
        readOnly: true,
        description: '建立活动时记下的预计参与人数下限；之后修改活动设置，这份活动仍按它的规则走',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: '状态',
      defaultValue: 'draft',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '待审核', value: 'submitted' },
        { label: '已通过', value: 'approved' },
        { label: '已驳回', value: 'rejected' },
        { label: '已实施', value: 'implemented' },
        { label: '已结项', value: 'closed' },
      ],
      index: true,
    },
    {
      name: 'reviews',
      type: 'array',
      label: '审批轨迹',
      admin: {
        readOnly: true,
      },
      fields: [
        {
          name: 'reviewer',
          type: 'relationship',
          relationTo: 'users',
          label: '处理人',
        },
        {
          name: 'reviewerName',
          type: 'text',
          label: '审核人姓名（审批时快照）',
          admin: {
            description: '审批那一刻的账号姓名；之后改个人信息不改这里',
          },
        },
        {
          name: 'action',
          type: 'select',
          label: '结论',
          options: [
            { label: '提交', value: 'submitted' },
            { label: '审核通过', value: 'approved' },
            { label: '审核不通过', value: 'rejected' },
            { label: '要求修改', value: 'revision_required' },
            { label: '结项', value: 'closed' },
          ],
        },
        {
          name: 'comment',
          type: 'textarea',
          label: '意见',
        },
        {
          name: 'at',
          type: 'date',
          label: '时间',
        },
        {
          name: 'version',
          type: 'number',
          label: '审核的版本',
          admin: { description: '这条审批针对的是第几版申请（对应「申请版本」里的版本号）' },
        },
      ],
    },
    {
      name: 'versions',
      type: 'array',
      label: '申请版本',
      admin: {
        readOnly: true,
        description: '每次提交申请时整份留档（第 1 版、第 2 版……），驳回后修改再提交会生成新的一版；之后不再改动',
      },
      fields: [
        { name: 'no', type: 'number', label: '版本号', required: true },
        { name: 'submittedAt', type: 'date', label: '提交时间' },
        { name: 'submitter', type: 'relationship', relationTo: 'users', label: '提交人' },
        { name: 'submitterName', type: 'text', label: '提交人姓名（提交时快照）' },
        {
          name: 'snapshot',
          type: 'json',
          label: '申请内容快照',
          admin: { description: '活动主题 / 类别 / 形式 / 时间 / 地点 / 人数 / 预算明细与合计' },
        },
      ],
    },
    {
      name: 'submittedAt',
      type: 'date',
      label: '提交时间',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'approvedAt',
      type: 'date',
      label: '批准时间',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'attachments',
      type: 'upload',
      relationTo: 'media',
      label: '附件',
      hasMany: true,
    },
  ],
  hooks: {
    beforeValidate: [
      // 地址标识统一是不透明随机串，谁建的活动都一样
      generateSlug('activity-plans'),
      ({ data }) => {
        if (Array.isArray(data?.budgetItems)) {
          const total = data.budgetItems.reduce(
            (sum: number, item: any) => sum + (Number(item?.amount) || 0),
            0,
          )
          data.budgetTotal = Math.round(total * 100) / 100
        }
        if (typeof data?.budgetTotal === 'number') {
          const participants = Number(data?.participants) || 0
          data.budgetPerPerson = perPersonBudget(data.budgetTotal, participants)
        }
        return data
      },
    ],
    beforeChange: [
      // 建立活动时记下当时的上下限（之后活动设置怎么改，这份活动都不跟着变）
      async ({ data, req, originalDoc }) => {
        // 新建时 originalDoc 可能是空对象（不是 undefined），所以判断有没有 id
        if (!originalDoc?.id && data && (data.ruleBudgetMax == null || data.ruleParticipantsMin == null)) {
          const settings: any = await req.payload.findGlobal({
            slug: 'activity-settings' as any,
            depth: 0,
            overrideAccess: true,
          })
          data.ruleBudgetMax = settings.budgetMax
          data.ruleParticipantsMin = settings.participantsMin
        }
        return data
      },
      ({ data, req, originalDoc }) => {
        if (!data?.proposer && req.user) {
          data.proposer = req.user.id
        }
        // 提交申请是**团长**的动作：骨干可以改内容，但不能自己把方案推入审批
        if (
          data?.status === 'submitted' &&
          originalDoc?.status !== 'submitted' &&
          req.user &&
          !isCohortLead(req.user) &&
          !isManager(req.user)
        ) {
          throw new Error('只有团长可以提交活动申请')
        }
        if (data?.status === 'submitted' && !data.submittedAt) {
          data.submittedAt = new Date().toISOString()
        }
        if (data?.status === 'approved' && !data.approvedAt) {
          data.approvedAt = new Date().toISOString()
        }
        // 提交后锁定内容，仅保留状态流转与审批 / 版本记录。
        // 草稿可以随便改；驳回后要允许团长改内容再提交，所以驳回也不锁（否则修改被静默覆盖）。
        // ⚠️ 不论这次写入带不带 status 都锁：审批（submitted → approved）同样不许顺手改内容，
        // 版本快照记的就是提交那一刻的内容，内容一变快照就对不上了。
        if (originalDoc?.id && !['draft', 'rejected'].includes(originalDoc.status)) {
          return {
            ...data,
            title: originalDoc.title,
            theme: originalDoc.theme,
            kind: originalDoc.kind,
            form: originalDoc.form,
            goals: originalDoc.goals,
            budgetItems: originalDoc.budgetItems,
            plannedAt: originalDoc.plannedAt,
            location: originalDoc.location,
            participants: originalDoc.participants,
            budgetTotal: originalDoc.budgetTotal,
            budgetPerPerson: originalDoc.budgetPerPerson,
            ruleBudgetMax: originalDoc.ruleBudgetMax,
            ruleParticipantsMin: originalDoc.ruleParticipantsMin,
          }
        }
        return data
      },
    ],
  },
}

