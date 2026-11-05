import type { CollectionConfig } from 'payload'

import { isManager, opsOnly, selfOrProjectTeam } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: '业务账号',
    plural: '业务账号',
  },
  auth: {
    // 会话 3 天：工作台涉及经费审批，不宜一周免登
    tokenExpiration: 60 * 60 * 24 * 3,
    maxLoginAttempts: 8,
    lockTime: 10 * 60 * 1000,
    cookies: {
      sameSite: 'Lax',
      // 生产环境只走 https，会话 cookie 不在明文链路上传
      secure: process.env.NODE_ENV === 'production',
    },
  },
  hooks: {
    // 停用账号时清掉它的全部会话：已经登录的设备当场失效（不用等 3 天会话过期）
    beforeChange: [
      ({ data, originalDoc }) => {
        if (data?.status === 'disabled' && originalDoc?.status !== 'disabled') {
          return { ...data, sessions: [] }
        }
        return data
      },
    ],
    // 停用的账号登不进来（已登录的会话由 currentUser 拦下）
    beforeLogin: [
      ({ user }) => {
        if ((user as any)?.status === 'disabled') throw new Error('账号已停用，请联系项目组')
        return user
      },
    ],
  },
  admin: {
    useAsTitle: 'name',
    group: '成员与权限',
    defaultColumns: ['name', 'roles', 'program', 'region', 'status'],
  },
  access: {
    // 成员目录不对公众开放；普通成员无需注册即可浏览公开内容
    read: selfOrProjectTeam,
    // 账号只能通过"邀请注册"流程创建，不允许自助注册
    create: () => false,
    // 改资料走服务端动作（updateProfile 校验格式与邮箱查重）；
    // REST 直写只给后台账号——否则本人能不验旧密码就改密码、改加入时间
    update: opsOnly,
    delete: opsOnly,
    admin: ({ req: { user } }) => isManager(user),
    unlock: ({ req: { user } }) => isManager(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: '姓名',
      required: true,
    },
    {
      name: 'roles',
      type: 'select',
      label: '角色',
      hasMany: true,
      required: true,
      defaultValue: ['cohortLead'],
      options: [
        { label: '团长', value: 'cohortLead' },
        { label: '项目组', value: 'projectTeam' },
      ],
      access: {
        // 本人注册时不能自行提权，只能由项目组调整
        create: () => false,
        update: ({ req: { user } }) => isManager(user),
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: '手机号',
      access: {
        // 只有本人与项目组能读；团长看别团时拿不到（REST / 关系填充都会被拦）
        read: ({ req: { user }, id }) => isManager(user) || String(user?.id) === String(id),
      },
    },
    {
      name: 'program',
      type: 'select',
      label: '参与项目',
      defaultValue: 'other',
      options: [
        { label: '加油木兰 · GO Mulan', value: 'go-mulan' },
        { label: 'AI豆计划 · A-Idol', value: 'a-idol' },
        { label: '民宿管家 · Homestay Manager', value: 'homestay-manager' },
        { label: '其他项目', value: 'other' },
      ],
    },
    {
      name: 'region',
      type: 'group',
      label: '所在地',
      admin: {
        description: '省 / 市 / 区县各存一个 6 位 adcode，地图与互助团落位靠它',
      },
      fields: [
        { name: 'province', type: 'text', label: '省 / 自治区 / 直辖市' },
        { name: 'provinceCode', type: 'text', label: '省 adcode' },
        { name: 'city', type: 'text', label: '市' },
        { name: 'cityCode', type: 'text', label: '市 adcode' },
        { name: 'district', type: 'text', label: '区 / 县' },
        { name: 'districtCode', type: 'text', label: '区县 adcode' },
      ],
    },
    {
      name: 'bio',
      type: 'textarea',
      label: '自我介绍',
      maxLength: 300,
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      label: '头像',
    },
    {
      name: 'status',
      type: 'select',
      label: '状态',
      defaultValue: 'active',
      options: [
        { label: '正常', value: 'active' },
        { label: '停用', value: 'disabled' },
      ],
      access: {
        update: ({ req: { user } }) => isManager(user),
      },
    },
    {
      name: 'joinedAt',
      type: 'date',
      label: '加入时间',
      admin: {
        readOnly: true,
      },
    },
  ],
}
