import type { CollectionConfig } from 'payload'

import { cohortsRead, opsOnly } from '../access'
import { generateSlug } from '../lib/slug'

export const Cohorts: CollectionConfig = {
  slug: 'cohorts',
  labels: {
    singular: '互助团',
    plural: '互助团',
  },
  admin: {
    group: '互助团',
    useAsTitle: 'name',
    defaultColumns: ['name', 'region', 'category', 'leader', 'status'],
  },
  access: {
    // 公开可见的团（isPublic 且在运行中）+ 自己所在的团；
    // 公开页面仍统一走 src/lib/public-data.ts 精确取用
    read: cohortsRead,
    // 建团（邀请注册）、换团长、改状态都走服务端；REST 直写只给后台账号
    create: opsOnly,
    update: opsOnly,
    delete: opsOnly,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: '团名',
      required: true,
      admin: {
        description: '中文人话，页面上显示的就是它（如「杭州 AI 互助团」）。',
      },
    },
    {
      name: 'slug',
      type: 'text',
      label: '地址标识',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: '地址栏里的那一段（/circles/<标识>）。不透明随机串，不带编号、拼音或城市。',
      },
    },
    {
      name: 'region',
      type: 'text',
      label: '地域',
    },
    {
      name: 'category',
      type: 'select',
      label: '类别',
      required: true,
      defaultValue: 'go-mulan',
      index: true,
      admin: {
        description:
          '工作台地图按类别筛选：加油木兰（GO Mulan）/ AI豆计划（A-Idol）/ 民宿管家（Homestay Manager）',
      },
      options: [
        { label: '加油木兰 · GO Mulan', value: 'go-mulan' },
        { label: 'AI豆计划 · A-Idol', value: 'a-idol' },
        { label: '民宿管家 · Homestay Manager', value: 'homestay-manager' },
      ],
    },
    {
      name: 'location',
      type: 'group',
      label: '所在地（地图定位）',
      admin: {
        description: '区县级 6 位 adcode 是地图定位的关键：省 / 市 / 区县各存一个 adcode，地图才能逐级下钻。',
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
      name: 'theme',
      type: 'text',
      label: '主题',
      admin: {
        description: '例如：AI 工具共学、返乡就业互助、新媒体运营',
      },
    },
    {
      name: 'tags',
      type: 'array',
      label: '标签',
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'leader',
      type: 'relationship',
      relationTo: 'users',
      label: '团长',
    },
    {
      name: 'team',
      type: 'group',
      label: '骨干成员',
      admin: {
        description:
          '只填名字（不解释职责）；这些名字会显示在公开站互助团主页的「骨干成员」里。团长由上面的账号带入。',
      },
      fields: [
        { name: 'viceLeader', type: 'text', label: '副团长' },
        { name: 'resourceLiaison', type: 'text', label: '资源对接员' },
        { name: 'materials', type: 'text', label: '材料整理员' },
        { name: 'media', type: 'text', label: '拍摄宣传员' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      label: '状态',
      defaultValue: 'active',
      options: [
        { label: '运行中', value: 'active' },
        { label: '解散', value: 'closed' },
      ],
    },
    {
      name: 'dissolvedAt',
      type: 'date',
      label: '解散时间',
      admin: {
        description: '状态切到「解散」时记录；切回「运行中」清空。',
      },
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      label: '公开展示',
      defaultValue: true,
      admin: {
        description: '关闭后不在公众站展示（工作台的网络视图仍然可见）',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: '简介',
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      label: '主页 Banner 大图',
      admin: {
        description:
          '公开站互助团主页顶部的大图（工作台「团信息」卡片顶部显示同一张）。不传则用最近一场活动的现场照片。',
      },
    },
    {
      name: 'leaderTerms',
      type: 'array',
      label: '团长任期',
      admin: {
        description: '每一任团长与在任时间区间；团长更替时老记录保留',
      },
      fields: [
        {
          name: 'user',
          type: 'relationship',
          relationTo: 'users',
          label: '团长',
          required: true,
        },
        {
          name: 'from',
          type: 'date',
          label: '上任时间',
          required: true,
        },
        {
          name: 'to',
          type: 'date',
          label: '卸任时间',
          admin: {
            description: '在任中留空',
          },
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      // 地址标识统一是不透明随机串
      generateSlug('cohorts'),
    ],
    beforeChange: [
      async ({ data, originalDoc }) => {
        // 团长换了人：老任期收口、新任期开始（历史保留）
        const nextLeader = data?.leader
        const nextLeaderId = typeof nextLeader === 'object' && nextLeader ? nextLeader.id : nextLeader
        const oldLeader =
          typeof originalDoc?.leader === 'object' && originalDoc?.leader
            ? originalDoc.leader.id
            : originalDoc?.leader
        if (!nextLeaderId || !originalDoc || String(oldLeader) === String(nextLeaderId)) {
          return data
        }

        const now = new Date().toISOString()
        const terms = (originalDoc.leaderTerms ?? []).map((term: any) => ({
          user: typeof term.user === 'object' && term.user ? term.user.id : term.user,
          from: term.from,
          to: term.to ?? now,
        }))
        terms.push({ user: nextLeaderId, from: now, to: null })
        data.leaderTerms = terms
        return data
      },
    ],
  },
}
