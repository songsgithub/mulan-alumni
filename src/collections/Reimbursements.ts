import type { CollectionConfig } from 'payload'

import { internalRead, opsOnly } from '../access'

/**
 * 报销（SOP 第四步：项目组同意报销）
 *
 * SOP 4.3「每一笔报销均需凭证齐全、真实合规」与三、1「收集好所有支出的正规发票/收据」，
 * 因此每一行明细都必须挂一张凭证（发票 / 收据 / 支付截图），缺凭证不允许提交。
 *
 * 金额三段分离：预算额 → 实际支出 → 申请报销额 → 核定金额（可核减，必须填原因）。
 */
export const Reimbursements: CollectionConfig = {
  slug: 'reimbursements',
  labels: {
    singular: '报销单',
    plural: '报销单',
  },
  admin: {
    group: '活动与经费',
    useAsTitle: 'id',
    defaultColumns: ['plan', 'applicant', 'total', 'approvedAmount', 'status'],
  },
  access: {
    read: internalRead,
    // 写入只走服务端动作（逐条校验角色 / 归属 / 状态 / 指定审核人）；REST 写入只给后台账号
    create: opsOnly,
    update: opsOnly,
    delete: opsOnly,
  },
  fields: [
    {
      name: 'report',
      type: 'relationship',
      relationTo: 'activity-reports',
      label: '对应活动反馈',
      index: true,
    },
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
      label: '所属互助团',
      index: true,
    },
    {
      name: 'applicant',
      type: 'relationship',
      relationTo: 'users',
      label: '申请人',
      admin: {
        readOnly: true,
      },
    },
    {
      /**
       * 报销审核人**快照**（2026-11-03 第五十一轮）。
       *
       * 在**报销单生成的那一刻**记下当时的报销审核负责人：
       * - 当时有人 → 只有他能在这一单上审核（哪怕后来换了人）；
       * - 当时没人（负责人被置空）→ 这张单**永远不流转**，
       *   不推送通知、不进待办、之后设了负责人也不回审这一单。
       *
       * 这条是「即使后续设置，也不必再审以前的活动」的实现依据。
       */
      name: 'reviewerId',
      type: 'relationship',
      relationTo: 'users',
      label: '报销审核人（生成时快照）',
      index: true,
      admin: {
        description: '报销单生成时的报销审核负责人。为空表示当时未指定，这一单不再流转。',
      },
    },
    {
      name: 'reviewerName',
      type: 'text',
      label: '报销审核人姓名（快照）',
      admin: { readOnly: true },
    },
    {
      name: 'items',
      type: 'array',
      label: '报销明细（随《经费支出明细表》）',
      admin: {
        description: '金额以《经费支出明细表》合计为准，每行都要附凭证',
      },
      fields: [
        {
          name: 'category',
          type: 'text',
          label: '费用类别（一级）',
        },
        {
          name: 'item',
          type: 'text',
          label: '明细项（二级）',
          required: true,
        },
        {
          name: 'description',
          type: 'text',
          label: '事项说明',
        },
        {
          name: 'amount',
          type: 'number',
          label: '金额（元）',
          required: true,
        },
        {
          name: 'receiptType',
          type: 'select',
          label: '凭证形式',
          defaultValue: 'invoice',
          options: [
            { label: '发票', value: 'invoice' },
            { label: '收据', value: 'receipt' },
            { label: '支付截图', value: 'paymentScreenshot' },
            { label: '其他证明材料', value: 'other' },
          ],
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
              '正规发票 / 收据 / 支付截图；一笔支出可以附多张（每张都写清是哪一笔的费用），项目组审核前必须可查',
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
      name: 'total',
      type: 'number',
      label: '申请金额（元）',
      admin: {
        readOnly: true,
      },
      defaultValue: 0,
    },
    {
      name: 'approvedAmount',
      type: 'number',
      label: '核定金额（元）',
      defaultValue: 0,
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
        { label: '已付款', value: 'paid' },
      ],
      index: true,
    },
    {
      name: 'reviews',
      type: 'array',
      label: '审核记录',
      admin: {
        readOnly: true,
        description: '每次审核一条，按时间顺序追加，不覆盖原记录',
      },
      fields: [
        {
          name: 'reviewer',
          type: 'relationship',
          relationTo: 'users',
          label: '审核人',
        },
        {
          name: 'reviewerName',
          type: 'text',
          label: '审核人姓名（审核时快照）',
        },
        {
          name: 'action',
          type: 'select',
          label: '审核结果',
          options: [
            { label: '审核通过', value: 'approved' },
            { label: '审核不通过', value: 'rejected' },
          ],
        },
        {
          name: 'comment',
          type: 'textarea',
          label: '审核意见',
        },
        {
          name: 'at',
          type: 'date',
          label: '审核时间',
        },
        {
          name: 'version',
          type: 'number',
          label: '审核的是第几版',
          admin: {
            description: '版本追溯上线前的旧记录没有这个号，页面会按时间归到当时最新的一版',
          },
        },
      ],
    },
    {
      name: 'versions',
      type: 'array',
      label: '报销版本',
      admin: {
        readOnly: true,
        description:
          '每次提交报销时整份留档（第 1 版、第 2 版……），驳回后修改再提交会生成新的一版；之后不再改动',
      },
      fields: [
        { name: 'no', type: 'number', label: '版本号', required: true },
        { name: 'submittedAt', type: 'date', label: '提交时间' },
        { name: 'submitter', type: 'relationship', relationTo: 'users', label: '提交人' },
        { name: 'submitterName', type: 'text', label: '提交人姓名（提交时快照）' },
        {
          name: 'snapshot',
          type: 'json',
          label: '报销内容快照',
          admin: { description: '费用明细与合计、实际支出、总结等' },
        },
      ],
    },
    {
      name: 'approver',
      type: 'relationship',
      relationTo: 'users',
      label: '审批人',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'approvedAt',
      type: 'date',
      label: '审批时间',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'reviewNote',
      type: 'textarea',
      label: '审批意见',
      admin: {
        description: '核减金额时必须说明原因',
      },
    },
    {
      name: 'paidAt',
      type: 'date',
      label: '付款时间',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'paymentRef',
      type: 'text',
      label: '付款流水号',
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (Array.isArray(data?.items)) {
          const total = data.items.reduce(
            (sum: number, item: any) => sum + (Number(item?.amount) || 0),
            0,
          )
          data.total = Math.round(total * 100) / 100
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (!data?.applicant && req.user) {
          data.applicant = req.user.id
        }
        if (!data?.cohort) {
          const planRef = data?.plan ?? originalDoc?.plan
          const planId = (planRef as any)?.id ?? planRef
          if (planId) {
            try {
              const planDoc: any = await req.payload.findByID({
                collection: 'activity-plans',
                id: planId,
                depth: 0,
              })
              // 所属互助团取自方案，保证凭证可见范围与团一致
              if (planDoc?.cohort) data.cohort = planDoc.cohort
            } catch {
              // 取不到方案不阻断报销保存
            }
          }
        }
        if (data?.status === 'approved' && !data.approvedAt) {
          data.approvedAt = new Date().toISOString()
          data.approver = req.user?.id
        }
        return data
      },
    ],
  },
}
