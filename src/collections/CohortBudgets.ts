import type { CollectionConfig } from 'payload'

import { isManager, opsOnly } from '../access'

/**
 * 互助团的**年度预算**（一个团、一个年度一条）。
 *
 * 与「每场活动的预算」不是一回事：
 * - 活动预算 = 这一场打算花多少（活动方案里填，受单场经费上限约束）；
 * - 年度预算 = 这个团**一整年**能用多少（这里）。
 *
 * 优先级：这条记录 > `annual-budget-settings` 里的该年度默认额度。
 * 也就是说：项目组先统一设一个数，之后哪个团要不一样，单独给它加一条。
 *
 * 实际执行不在这里存——它由**已核定的报销**实时算出来
 * （见 `src/lib/annual-budget.ts`）：没闭环的申请不算数。
 */
export const CohortBudgets: CollectionConfig = {
  slug: 'cohort-budgets',
  labels: {
    singular: '年度预算',
    plural: '年度预算',
  },
  admin: {
    group: '经费',
    useAsTitle: 'cohort',
    defaultColumns: ['cohort', 'year', 'amount', 'updatedAt'],
  },
  access: {
    // 项目组与后台账号看得到全部
    read: ({ req: { user } }) => isManager(user),
    create: opsOnly,
    update: opsOnly,
    delete: opsOnly,
  },
  fields: [
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      label: '互助团',
      required: true,
      index: true,
    },
    {
      name: 'year',
      type: 'number',
      label: '年度',
      required: true,
      index: true,
    },
    {
      name: 'amount',
      type: 'number',
      label: '年度预算（元）',
      required: true,
      min: 0,
      admin: {
        description: '这个团这一整年的规划预算。留 0 表示不单独设，走项目组的统一额度。',
      },
    },
    {
      name: 'note',
      type: 'text',
      label: '备注',
      admin: {
        description: '例如：这一年的重点是返乡就业专项。',
      },
    },
    {
      name: 'updatedBy',
      type: 'relationship',
      relationTo: 'users',
      label: '最后修改人',
    },
  ],
}
