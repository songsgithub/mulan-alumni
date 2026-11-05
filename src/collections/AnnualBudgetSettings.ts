import type { CollectionConfig } from 'payload'

import { isManager, opsOnly } from '../access'

/**
 * 年度预算的**统一口径**（项目组一次设定，全体互助团通用）。
 *
 * 一行 = 一个年度：
 * - `year`：年份（如 2026），一年度只有一行；
 * - `defaultAmount`：该年度的**默认年度预算**（元）。
 *   没有单独设过预算的互助团，就用这个数；
 * - 某个团要不一样 → 在 `cohort-budgets` 里给它单独设一条（那一团的记录优先）。
 *
 * ⚠️ 这个数**不是**「每场活动能花多少」——那是活动经费上限（`activity-settings.budgetMax`，
 * 单场口径）。这里是「这个团一整年能用多少」，两回事，不要混。
 */
export const AnnualBudgetSettings: CollectionConfig = {
  slug: 'annual-budget-settings',
  labels: {
    singular: '年度预算设置',
    plural: '年度预算设置',
  },
  admin: {
    group: '经费',
    useAsTitle: 'year',
    defaultColumns: ['year', 'defaultAmount', 'updatedAt'],
  },
  access: {
    // 项目组与后台账号看得到（团长只在经费页看汇总，不需要这个集合的读写）
    read: ({ req: { user } }) => isManager(user),
    create: opsOnly,
    update: opsOnly,
    delete: opsOnly,
  },
  fields: [
    {
      name: 'year',
      type: 'number',
      label: '年度',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'defaultAmount',
      type: 'number',
      label: '默认年度预算（元）',
      required: true,
      min: 0,
      admin: {
        description: '这一年度全体互助团通用的年度预算；某个团要单独设，在「经费」页单独改。',
      },
    },
    {
      name: 'note',
      type: 'text',
      label: '备注',
    },
    {
      name: 'updatedBy',
      type: 'relationship',
      relationTo: 'users',
      label: '最后修改人',
    },
  ],
}
