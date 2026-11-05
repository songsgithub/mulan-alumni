import type { CollectionConfig, Where } from 'payload'

/**
 * 站内通知（工作台右上角铃铛）。
 *
 * 目前两类：活动审批结果与报销审核结果——都是**发给团长的**，
 * 通知里带着活动详情页的链接，点通知直接跳过去。
 *
 * 由服务端动作（审批 / 核定）创建，不对任何客户端开放创建口；
 * 本人只能读自己的、把已读标记改成 true。
 */
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  labels: {
    singular: '通知',
    plural: '通知',
  },
  admin: {
    group: '活动与经费',
    useAsTitle: 'title',
    defaultColumns: ['recipient', 'title', 'read', 'createdAt'],
  },
  access: {
    // 收件人是业务账号（users）；后台账号的 id 与业务账号的 id 会撞号，按 collection 分开
    read: ({ req: { user } }) => {
      if (!user) return false
      if ((user as any).collection === 'ops-users') return true
      return { recipient: { equals: user.id } }
    },
    create: () => false,
    // 本人只能把通知标成已读；不能改内容
    update: ({ req: { user } }): false | Where => {
      if (!user || (user as any).collection !== 'users') return false
      return {
        and: [{ recipient: { equals: user.id as any } }, { read: { not_equals: true } }],
      } as Where
    },
    delete: ({ req: { user } }) => Boolean((user as any)?.collection === 'ops-users'),
  },
  hooks: {
    // 收件人只能动「已读」：标题 / 链接 / 收件人一律保持原样（防止把链接改成钓鱼地址）
    beforeChange: [
      ({ data, originalDoc, req }) => {
        const ops = (req.user as any)?.collection === 'ops-users'
        if (!originalDoc || ops || !req.user) return data
        return {
          ...data,
          recipient: originalDoc.recipient?.id ?? originalDoc.recipient,
          title: originalDoc.title,
          link: originalDoc.link,
          read: data?.read === true ? true : originalDoc.read,
        }
      },
    ],
  },
  fields: [
    {
      name: 'recipient',
      type: 'relationship',
      relationTo: 'users',
      label: '收件人',
      required: true,
      index: true,
    },
    {
      name: 'title',
      type: 'text',
      label: '标题',
      required: true,
    },
    {
      name: 'link',
      type: 'text',
      label: '跳转链接',
      admin: {
        description: '工作台内的活动详情页地址（/activities/<标识>）',
      },
    },
    {
      name: 'read',
      type: 'checkbox',
      label: '已读',
      defaultValue: false,
      index: true,
    },
  ],
}
