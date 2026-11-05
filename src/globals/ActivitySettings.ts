import type { GlobalConfig } from 'payload'

import { opsOnly } from '../access'

/**
 * 活动设置（全站一份）：经费预算上限、预计参与人数下限、两个审核环节的负责人。
 *
 * - 读：登录即可（团长填写活动方案时要看到上限与下限）。
 * - 写：项目组 / 运维。
 * - 审核负责人只能从**项目组成员**中选，且两个环节可以是同一个人。
 * - 没有被设置为负责人的项目组成员：只能查看与打印，不能审核。
 */
export const ActivitySettings: GlobalConfig = {
  slug: 'activity-settings',
  label: '活动设置',
  access: {
    read: ({ req: { user } }) => Boolean(user),
    // 工作台改设置走服务端动作 updateActivityRules（校验负责人必须是项目组成员）；REST 只给后台账号
    update: opsOnly,
  },
  fields: [
    {
      name: 'budgetMax',
      type: 'number',
      label: '预算合计上限（元）',
      required: true,
      min: 0,
      defaultValue: 500,
      admin: {
        description: '《经费预算明细表》合计必须小于等于该数值，超过则不能提交活动申请',
      },
    },
    {
      name: 'participantsMin',
      type: 'number',
      label: '预计参与人数下限（人）',
      required: true,
      min: 1,
      defaultValue: 1,
      admin: {
        description: '预计参与人数必须大于等于该数值，不足则不能提交活动申请。实际参与人数不设限制',
      },
    },
    {
      name: 'planReviewer',
      type: 'relationship',
      relationTo: 'users',
      label: '活动审核负责人',
      admin: {
        description: '只能从项目组成员中选择。只有该负责人可以审核活动申请',
      },
    },
    {
      name: 'reimbursementReviewer',
      type: 'relationship',
      relationTo: 'users',
      label: '报销审核负责人',
      admin: {
        description: '只能从项目组成员中选择。只有该负责人可以审核报销单',
      },
    },
    {
      /**
       * 费用类别（**只有一级**，2026-11-03 第五十一轮）。
       *
       * 2026-11-01 第三十六轮：从代码常量下沉到这里——
       * 以前类目写死在 `lib/budget.ts`，改一次类别要动代码、发版；
       * 现在项目组在工作台「设置」里自己维护。
       *
       * 2026-11-03 第五十一轮：**移除二级明细项**。
       * 以前是「一级类别 + 二级明细项」两层（`{ category, items[] }`），
       * 现在只留一级类别名（纯文本数组）——
       * 二级明细项从来只是「可支持范围」参考，而「查询可支持项」入口已删除，
       * 留着这一层只剩维护成本，没有用处。
       *
       * ⚠️ **历史数据不受影响**：活动方案 / 反馈 / 报销单里存的是
       * **类别名的快照**（不是这里的索引），
       * 所以后来改了类别名、甚至删了某个类别，
       * 已经提交的老记录**照样按当初的写法显示**。
       */
      name: 'expenseCategories',
      type: 'array',
      label: '费用类别',
      admin: {
        description:
          '《经费预算明细表》与《经费支出明细表》的费用类别（一级）。改了不影响已提交的历史记录（那里存的是快照）。',
      },
      fields: [
        {
          name: 'category',
          type: 'text',
          label: '费用类别',
          required: true,
        },
      ],
    },
    {
      // 审计：谁在什么时候把规则或审核负责人改成了什么（只追加，不改不删）。
      // 审核负责人决定"谁能批钱"，换人必须留痕。
      name: 'changeLog',
      type: 'array',
      label: '修改记录',
      admin: { readOnly: true, description: '每次在工作台「设置」里保存都会追加一条' },
      fields: [
        { name: 'at', type: 'date', label: '时间' },
        { name: 'by', type: 'relationship', relationTo: 'users', label: '修改人' },
        { name: 'byName', type: 'text', label: '修改人姓名（快照）' },
        { name: 'summary', type: 'textarea', label: '改了什么' },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // 审核负责人必须是项目组成员（服务端兜底，不信任前端的下拉过滤）
        for (const key of ['planReviewer', 'reimbursementReviewer'] as const) {
          const raw = (data as any)?.[key]
          if (raw === undefined || raw === null || raw === '') continue
          const id = typeof raw === 'object' ? raw.id : raw
          const reviewer: any = await req.payload.findByID({
            collection: 'users',
            id,
            depth: 0,
            overrideAccess: true,
          })
          if (!reviewer?.roles?.includes('projectTeam')) {
            throw new Error('审核负责人只能从项目组成员中选择')
          }
        }
        return data
      },
    ],
  },
}
