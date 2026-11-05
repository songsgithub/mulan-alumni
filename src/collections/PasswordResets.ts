import type { CollectionConfig } from 'payload'

import { opsOnly } from '../access'

/**
 * 密码重置链接。
 *
 * **为什么是「链接」而不是「项目组直接设一个新密码」**：
 * 没有邮件也没有短信（见 docs/设计规范.md §4.8），项目组没法把新密码安全地送到团长手上；
 * 而让项目组看到团长的密码，等于多一个人知道团长用什么登录。
 * 所以走一次性链接：项目组生成一条链接，用微信 / 电话发给团长，
 * 团长自己打开链接设新密码——项目组从头到尾不知道密码。
 *
 * 用过一次即失效（`usedAt`），**固定 7 天**有效。
 */
export const PasswordResets: CollectionConfig = {
  slug: 'password-resets',
  labels: {
    singular: '密码重置',
    plural: '密码重置',
  },
  admin: {
    group: '成员与权限',
    defaultColumns: ['user', 'expiresAt', 'usedAt', 'createdAt'],
  },
  access: {
    // 里面装的是「谁能重置谁」的凭据：一个都不能对外
    read: opsOnly,
    create: opsOnly,
    update: opsOnly,
    delete: opsOnly,
  },
  fields: [
    {
      name: 'token',
      type: 'text',
      label: '链接标识',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: '拼进链接里的一段随机字符，例如 /reset-password?token=xxxx',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      label: '要重置的账号',
      required: true,
      index: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: '过期时间',
      required: true,
    },
    {
      name: 'usedAt',
      type: 'date',
      label: '使用时间',
      admin: {
        description: '用过即失效；空着说明还没用',
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: '谁生成的',
    },
  ],
}
