import type { CollectionConfig } from 'payload'

import { isManager, opsOnly } from '../access'

/**
 * 付款记录（财务侧的账，工作台的活动页不再展示这一块）。
 * 谁打款、什么时候到账，在这里登记并留痕。
 */
export const Payments: CollectionConfig = {
  slug: 'payments',
  labels: {
    singular: '付款记录',
    plural: '付款记录',
  },
  admin: {
    group: '活动与经费',
    defaultColumns: ['reimbursement', 'payee', 'amount', 'status', 'scheduledAt', 'paidAt'],
  },
  access: {
    read: ({ req: { user } }) => isManager(user),
    // 写入只给后台账号：否则项目组 REST 直接 PATCH 就能把任意付款改成已到账
    create: opsOnly,
    update: opsOnly,
    delete: opsOnly,
  },
  fields: [
    {
      name: 'reimbursement',
      type: 'relationship',
      relationTo: 'reimbursements',
      label: '对应报销单',
      required: true,
      index: true,
    },
    {
      name: 'payee',
      type: 'text',
      label: '收款方',
      required: true,
    },
    {
      name: 'amount',
      type: 'number',
      label: '付款金额（元）',
      required: true,
    },
    {
      name: 'method',
      type: 'select',
      label: '付款方式',
      defaultValue: 'bank',
      options: [
        { label: '银行转账', value: 'bank' },
        { label: '第三方支付', value: 'third_party' },
        { label: '其他', value: 'other' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      label: '状态',
      defaultValue: 'pending',
      options: [
        { label: '待付款', value: 'pending' },
        { label: '付款中', value: 'processing' },
        { label: '已到账', value: 'paid' },
        { label: '付款失败', value: 'failed' },
      ],
      index: true,
    },
    {
      name: 'scheduledAt',
      type: 'date',
      label: '计划付款日',
    },
    {
      name: 'paidAt',
      type: 'date',
      label: '实际付款日',
    },
    {
      name: 'externalRef',
      type: 'text',
      label: '外部流水号',
      admin: {
        description: '打款流水号；标记"已到账"时必填，用于对账',
      },
    },
    {
      name: 'voucher',
      type: 'upload',
      relationTo: 'finance-evidence',
      label: '付款凭证',
      admin: {
        description: '银行回单 / 打款截图',
      },
    },
    {
      name: 'operator',
      type: 'relationship',
      relationTo: 'users',
      label: '经办人',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: '备注',
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        // 对账要求：标记"已到账"必须有流水号与付款日期
        if (data?.status === 'paid') {
          if (!String(data?.externalRef ?? '').trim()) {
            throw new Error('标记为"已到账"时必须回填付款流水号，用于对账')
          }
          if (!data?.paidAt) {
            data.paidAt = new Date().toISOString()
          }
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, req }) => {
        if (!data?.operator && req.user) {
          data.operator = req.user.id
        }
        // 付款完成 → 回写报销单状态
        if (data?.status === 'paid' && data?.reimbursement) {
          try {
            await req.payload.update({
              collection: 'reimbursements',
              id: data.reimbursement.id ?? data.reimbursement,
              data: {
                status: 'paid',
                paidAt: data.paidAt ?? new Date().toISOString(),
                paymentRef: data.externalRef,
              },
            })
          } catch {
            // 回写失败不阻断付款记录保存
          }
        }
        return data
      },
    ],
  },
}
