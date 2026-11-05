import type { CollectionConfig } from 'payload'

import { internalRead, isCohortLead, isManager, opsOnly } from '../access'
import { reportOverdueDays } from '../lib/workflow'

/**
 * 活动反馈（SOP 第三步：实施活动并反馈）
 *
 * 字段对齐 SOP《数字木兰校友会互助团活动反馈表》：
 * 一、活动开展主题 / 二、地点 / 三、时间 / 四、互助团成员名单 / 五、活动总结（200 字以内）
 * 六、成员活动感受 / 七、活动照片（3-5 张，含全员合照）/ 八、活动资金使用情况（附照片证明）
 * 并补充《活动签到表》与「活动结束后 5 天内提交」的时限判定。
 */
export const ActivityReports: CollectionConfig = {
  slug: 'activity-reports',
  labels: {
    singular: '活动反馈',
    plural: '活动反馈',
  },
  admin: {
    group: '活动与经费',
    useAsTitle: 'summary',
    defaultColumns: [
      'plan',
      'cohort',
      'submittedBy',
      'actualAt',
      'actualParticipants',
      'actualSpending',
      'status',
    ],
  },
  access: {
    read: internalRead,
    // 提交 / 修改 / 采纳都走服务端动作；REST 直接写入只给后台账号
    // （否则团长能给别团的方案挂反馈、把别团方案改成「已实施」，或删掉已采纳的反馈）
    create: opsOnly,
    update: opsOnly,
    delete: opsOnly,
  },
  fields: [
    {
      name: 'plan',
      type: 'relationship',
      relationTo: 'activity-plans',
      label: '对应活动方案',
      required: true,
      index: true,
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      label: '互助团',
      required: true,
      index: true,
    },
    {
      name: 'submittedBy',
      type: 'relationship',
      relationTo: 'users',
      label: '提交人',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'theme',
      type: 'text',
      label: '活动开展主题',
      admin: {
        description: 'SOP 反馈表第一项，默认取方案名称',
      },
    },
    {
      name: 'location',
      type: 'text',
      label: '活动开展地点',
    },
    {
      name: 'actualAt',
      type: 'date',
      label: '实际开展时间',
      required: true,
    },
    {
      name: 'actualStart',
      type: 'text',
      label: '活动开始时间',
      admin: {
        description: 'SOP 反馈表第三项：活动开展时间要写到时段，如 14:00',
      },
    },
    {
      name: 'actualEnd',
      type: 'text',
      label: '活动结束时间',
      admin: {
        description: '如 16:00',
      },
    },
    {
      name: 'expenseItems',
      type: 'array',
      label: '《经费支出明细表》',
      admin: {
        description: '序号自动；费用类别从清单里选；明细手动写（写清实际花了什么）；报销金额以合计为准',
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
          label: '实际支出明细',
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
          name: 'amount',
          type: 'number',
          label: '金额（元）',
          required: true,
        },
        {
          name: 'receipt',
          type: 'upload',
          relationTo: 'finance-evidence',
          hasMany: true,
          label: '凭证/照片证明',
          required: true,
          admin: {
            description:
              '发票 / 收据 / 支付截图 / 消费照片；一笔支出可以附多张（每张都写清是哪一笔的费用），缺凭证无法提交报销',
          },
        },
        {
          name: 'receiptName',
          type: 'text',
          label: '凭证文件名',
          admin: {
            readOnly: true,
            description: '多个附件时按提交顺序用「、」连接',
          },
        },
        {
          name: 'note',
          type: 'text',
          label: '备注',
        },
      ],
    },
    {
      name: 'actualParticipants',
      type: 'number',
      label: '实际参与人数（与签到人数一致）',
      admin: {
        readOnly: true,
        description: '由《活动签到表》中签到的人数自动生成，不可手改',
      },
      defaultValue: 0,
    },
    {
      name: 'actualSpending',
      type: 'number',
      label: '实际支出（元）',
      defaultValue: 0,
    },
    {
      name: 'summary',
      type: 'textarea',
      label: '活动总结',
      required: true,
      maxLength: 200,
      admin: {
        description: 'SOP 反馈表第五项：200 字以内，写清开展情况、讲师与互动',
      },
    },
    {
      name: 'attendees',
      type: 'array',
      label: '互助团成员与签到（SOP 签到表）',
      admin: {
        description: '对应《活动签到表》：姓名、工作单位、职位、手机号、团内角色与签到确认',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          label: '姓名',
          required: true,
        },
        {
          name: 'organization',
          type: 'text',
          label: '工作单位',
        },
        {
          name: 'position',
          type: 'text',
          label: '职位',
        },
        {
          name: 'phone',
          type: 'text',
          label: '手机号',
        },
        {
          name: 'role',
          type: 'select',
          label: '团内角色',
          defaultValue: 'core',
          options: [
            { label: '团长', value: 'leader' },
            { label: '副团长', value: 'deputy' },
            { label: '资源对接', value: 'resource' },
            { label: '材料整理', value: 'materials' },
            { label: '拍摄宣传', value: 'media' },
            { label: '骨干成员', value: 'core' },
            { label: '成员', value: 'member' },
          ],
        },
        {
          name: 'signed',
          type: 'checkbox',
          label: '已签到',
          defaultValue: false,
        },
      ],
    },
    {
      name: 'feelings',
      type: 'array',
      label: '成员活动感受（SOP 反馈表第六项）',
      fields: [
        {
          name: 'memberName',
          type: 'text',
          label: '组员',
          required: true,
        },
        {
          name: 'content',
          type: 'textarea',
          label: '感受',
          required: true,
        },
      ],
    },
    {
      name: 'photos',
      type: 'upload',
      relationTo: 'media',
      label: '活动照片',
      hasMany: true,
      required: true,
      minRows: 1,
      admin: {
        description: 'SOP 反馈表第七项：3-5 张，含露出全体成员与参与者的合照',
      },
    },
    {
      name: 'materials',
      type: 'array',
      label: '活动资金使用情况（必要物料与价格）',
      admin: {
        description: 'SOP 反馈表第八项：必要物料及价格；对应的照片证明见下方「资金使用照片证明」',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          label: '物料',
          required: true,
        },
        {
          name: 'price',
          type: 'number',
          label: '价格（元）',
          required: true,
        },
        {
          name: 'note',
          type: 'text',
          label: '说明',
        },
      ],
    },
    {
      name: 'spendingProofs',
      type: 'upload',
      relationTo: 'media',
      label: '资金使用照片证明',
      hasMany: true,
      admin: {
        description: 'SOP 反馈表第八项：必要物料与价格对应的照片证明',
      },
    },
    {
      name: 'videos',
      type: 'upload',
      relationTo: 'media',
      label: '现场视频',
      hasMany: true,
      admin: {
        description: 'SOP 要求保留的现场视频证据（与照片、签到表一起）',
      },
    },
    {
      name: 'signupSheet',
      type: 'upload',
      relationTo: 'media',
      label: '活动签到表（扫描件）',
      admin: {
        description: 'SOP 要求随反馈表一并提交《活动签到表》',
      },
    },
    {
      name: 'highlights',
      type: 'textarea',
      label: '亮点与经验',
      admin: {
        description: '可复用经验将沉淀为公开学习资源',
      },
    },
    {
      name: 'survey',
      type: 'group',
      label: '参与者反馈',
      fields: [
        {
          name: 'satisfaction',
          type: 'number',
          label: '满意度（1-5）',
          min: 1,
          max: 5,
        },
        {
          name: 'gain',
          type: 'textarea',
          label: '最大收获',
        },
        {
          name: 'suggestions',
          type: 'textarea',
          label: '改进建议',
        },
      ],
    },
    {
      name: 'recommendedForPublish',
      type: 'checkbox',
      label: '推荐发布到公开站（已停用）',
      defaultValue: false,
      index: true,
      admin: {
        // 2026-10-28 第十八轮起没有单独的提名 / 精选发布：报销核定通过即自动发布。
        // 字段保留是因为库里有历史值（删列要迁移）；业务代码已不读写它。
        description: '历史字段：现在报销核定通过即自动发布，不再需要提名',
        readOnly: true,
      },
      access: {
        // 提名是团长的事，项目组负责最终发布
        update: ({ req: { user } }) => isManager(user) || isCohortLead(user),
      },
    },
    {
      name: 'recommendedNote',
      type: 'textarea',
      label: '推荐理由',
      admin: {
        description: '一句话说清这条为什么值得公开给更多人看',
      },
      access: {
        update: ({ req: { user } }) => isManager(user) || isCohortLead(user),
      },
    },
    {
      name: 'publishedAs',
      type: 'relationship',
      relationTo: 'publications',
      label: '已发布为',
      admin: {
        readOnly: true,
        description: '转成公开成果后自动回填，防止同一条反馈重复发布',
      },
      access: {
        update: ({ req: { user } }) => isManager(user),
      },
    },
    {
      name: 'status',
      type: 'select',
      label: '状态',
      defaultValue: 'submitted',
      options: [
        { label: '待采纳', value: 'submitted' },
        { label: '已采纳', value: 'accepted' },
        { label: '需补充', value: 'revision_required' },
      ],
      index: true,
    },
    {
      name: 'revisionNote',
      type: 'textarea',
      label: '项目组意见',
    },
    {
      name: 'submittedAt',
      type: 'date',
      label: '提交时间',
      admin: {
        readOnly: true,
        description: '用于核算「活动结束后 5 天内提交」的时限',
      },
    },
    {
      name: 'overdueDays',
      type: 'number',
      label: '超期提交天数',
      admin: {
        readOnly: true,
        description: 'SOP 要求活动结束后 5 天内提交反馈',
      },
      defaultValue: 0,
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        // 反馈时限：活动结束后 5 天内提交
        if (data?.actualAt) {
          const submittedAt = data?.submittedAt ?? originalDoc?.submittedAt ?? new Date().toISOString()
          data.overdueDays = reportOverdueDays(data.actualAt, submittedAt)
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (!data?.submittedBy && req.user) {
          data.submittedBy = req.user.id
        }
        // 提交时间：首次提交自动打点，用于核算 5 天时限
        if (!data?.submittedAt && !originalDoc?.submittedAt) {
          data.submittedAt = new Date().toISOString()
        }
        // 只有项目组可以把反馈推进到"已采纳 / 需补充"；成员只能提交或重提
        const nextStatus = data?.status ?? originalDoc?.status
        const isCreate = !originalDoc?.id
        if (
          !isCreate &&
          nextStatus !== originalDoc.status &&
          nextStatus !== 'submitted' &&
          !isManager(req.user)
        ) {
          throw new Error('仅项目组可以采纳或要求补充活动反馈')
        }
        if (!data?.theme && data?.plan) {
          const planId = data.plan?.id ?? data.plan
          try {
            const plan = await req.payload.findByID({
              collection: 'activity-plans',
              id: planId,
              depth: 0,
            })
            if (plan?.title) data.theme = plan.title
          } catch {
            // 取不到方案标题不阻断反馈保存
          }
        }
        // 反馈提交后，活动方案自动流转为"已实施"——只从「已通过」往前走一步，
        // 不会把别的状态（草稿 / 待审核 / 已关闭）改掉
        if (data?.plan) {
          try {
            const planId = data.plan.id ?? data.plan
            const planDoc: any = await req.payload.findByID({
              collection: 'activity-plans',
              id: planId,
              depth: 0,
              overrideAccess: true,
            })
            if (planDoc?.status === 'approved') {
              await req.payload.update({
                collection: 'activity-plans',
                id: planId,
                data: { status: 'implemented' },
                overrideAccess: true,
              })
            }
          } catch {
            // 方案状态回写失败不阻断反馈保存
          }
        }
        return data
      },
    ],
  },
}
