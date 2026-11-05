import type { CollectionConfig } from 'payload'

import { isOps } from '../access'

/**
 * 后台账号（运维 / 技术负责人）。
 *
 * 与业务账号（`users`）**完全分离**：
 * `payload.config.ts` 里 `admin.user: 'ops-users'`，所以 Payload CMS 后台的登录候选
 * 只有这个集合——核心成员、团长、项目组的业务账号根本进不去后台。
 *
 * 后台账号在访问控制里按**全局管理员**处理（`access/index.ts` 的 `isManager`），
 * 目的是让运维能修数据；它不参与业务语义（谁是谁的团长），也进不了工作台
 * （工作台登录走 `users` 集合）。
 */
export const OpsUsers: CollectionConfig = {
  slug: 'ops-users',
  labels: {
    singular: '后台账号',
    plural: '后台账号',
  },
  auth: {
    tokenExpiration: 60 * 60 * 4,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    cookies: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  admin: {
    group: '系统',
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'lastLoginAt'],
  },
  access: {
    // 只有后台账号能看后台账号列表（业务账号连邮箱都不该看到）
    read: ({ req: { user } }) => isOps(user),
    // 账号只能由种子脚本创建，不允许在后台里随手注册
    create: () => false,
    update: ({ req: { user } }) => isOps(user),
    delete: ({ req: { user } }) => isOps(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: '姓名',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      label: '邮箱',
      required: true,
      unique: true,
    },
    {
      name: 'lastLoginAt',
      type: 'date',
      label: '最近登录',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: '备注',
      admin: {
        description: '谁负责这套系统、怎么联系',
      },
    },
  ],
}
