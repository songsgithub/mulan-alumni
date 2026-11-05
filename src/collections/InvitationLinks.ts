import type { CollectionConfig } from 'payload'

import { isManager, opsOnly } from '../access'

/**
 * 邀请链接（不是邀请码）。
 *
 * 项目组在「互助团」页生成一条带 token 的链接：
 * - `create-cohort`：对方打开链接填资料 → 互助团建成，对方成为团长
 * - `transfer-lead`：对方打开链接填资料 → 直接接管指定互助团的团长
 *
 * 有效期**固定 7 天**（不再有三档），**用过即失效**（见 docs/设计规范.md §4.6）。
 */
export const InvitationLinks: CollectionConfig = {
  slug: 'invitation-links',
  labels: {
    singular: '邀请链接',
    plural: '邀请链接',
  },
  admin: {
    group: '成员与权限',
    defaultColumns: ['token', 'purpose', 'email', 'cohort', 'status', 'expiresAt'],
  },
  access: {
    read: ({ req: { user } }) => isManager(user),
    // 生成链接、注册时作废链接都走服务端；REST 直写只给后台账号
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
        description: '拼进链接里的一段随机字符，例如 /join?token=xxxx',
      },
    },
    {
      name: 'purpose',
      type: 'select',
      label: '用途',
      required: true,
      defaultValue: 'create-cohort',
      options: [
        { label: '创建互助团（对方成为团长）', value: 'create-cohort' },
        { label: '团长转移（对方接管这个团）', value: 'transfer-lead' },
      ],
      index: true,
    },
    {
      name: 'email',
      type: 'text',
      label: '受邀人邮箱',
      index: true,
      admin: {
        description: '填了就绑定给这个人；不填则谁拿到链接都能用',
      },
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      label: '要移交的互助团',
      admin: {
        condition: (_, siblingData) => siblingData?.purpose === 'transfer-lead',
        description: '用途是"团长转移"时指定',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: '备注',
      admin: {
        description: '写给对方的话，比如"这是你那个团的位置"',
      },
    },
    {
      name: 'invitedBy',
      type: 'relationship',
      relationTo: 'users',
      label: '发起人',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: '过期时间',
      admin: {
        description: '自创建起 7×24 小时；过期即自动失效',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      label: '状态',
      defaultValue: 'active',
      options: [
        { label: '可使用', value: 'active' },
        { label: '已使用', value: 'used' },
        { label: '已撤销', value: 'revoked' },
        { label: '已过期', value: 'expired' },
      ],
      index: true,
    },
    {
      name: 'usedAt',
      type: 'date',
      label: '使用时间',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'usedBy',
      type: 'relationship',
      relationTo: 'users',
      label: '使用者',
      admin: {
        readOnly: true,
      },
    },
  ],
}
