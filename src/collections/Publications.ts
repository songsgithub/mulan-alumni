import type { CollectionConfig } from 'payload'

import { isManager, opsOnly, publicationsRead } from '../access'
import { generateSlug } from '../lib/slug'

/**
 * 精选发布：活动/故事/资源经项目组审核后推到前端，供互联网大众与普通成员观看。
 * 公开站点只读取本集合 + 已发布的公开资源。
 */
export const Publications: CollectionConfig = {
  slug: 'publications',
  labels: {
    // 「精选发布」这一步已取消（报销核定通过即自动发布），这里就是公开站上的活动成果
    singular: '公开成果',
    plural: '公开成果',
  },
  admin: {
    group: '公开内容',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'excerpt', 'featured', 'publishedAt'],
  },
  access: {
    // 公开可读（已到发布时间的条目）
    read: publicationsRead,
    // 精选发布走服务端动作（有「报销已核定」闸门）；REST 直写会绕过闸门，只给后台账号
    create: opsOnly,
    update: opsOnly,
    delete: opsOnly,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: '标题',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: '地址标识',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          '地址栏里的那一段（/资源路径/<标识>）。不透明随机串，不带关键词、拼音或城市。',
      },
    },
    {
      name: 'type',
      type: 'select',
      label: '内容类型',
      defaultValue: 'event',
      options: [
        { label: '活动（Event）', value: 'event' },
        { label: '故事（Story）', value: 'story' },
        { label: '模板（Template）', value: 'template' },
      ],
      index: true,
    },
    {
      name: 'kind',
      type: 'select',
      label: '活动类别',
      // 发布时由活动方案带过来；没有就按标题/摘要回退判断（lib/activity-kind.ts）
      options: [
        { label: '技能提升类', value: '技能提升类' },
        { label: 'AI素养类', value: 'AI素养类' },
        { label: '健康科普类', value: '健康科普类' },
        { label: '生活成长类', value: '生活成长类' },
      ],
    },
    {
      name: 'eventDate',
      type: 'date',
      label: '活动日期',
      admin: {
        description: '公众站展示用。列表按此日期倒序。',
      },
      index: true,
    },
    {
      name: 'eventLocation',
      type: 'text',
      label: '活动地点',
      admin: {
        description: '公众站展示用，例如 Hangzhou · Charity Space',
      },
    },
    {
      name: 'attendeeCount',
      type: 'number',
      label: '参与人数',
      admin: {
        description: '公众站展示用',
      },
    },
    {
      name: 'relatedPlan',
      type: 'relationship',
      relationTo: 'activity-plans',
      label: '关联活动方案',
      admin: {
        description: '内部关联，仅项目组可见；对外只呈现已审核的发布内容',
      },
      access: {
        // 活动方案属内部数据，不得经公开集合泄漏给未登录用户
        read: ({ req: { user } }) => isManager(user),
      },
    },
    {
      name: 'relatedReport',
      type: 'relationship',
      relationTo: 'activity-reports',
      label: '关联活动反馈',
      access: {
        // 活动反馈属内部数据，不得经公开集合泄漏给未登录用户
        read: ({ req: { user } }) => isManager(user),
      },
    },
    {
      name: 'relatedResource',
      type: 'relationship',
      relationTo: 'resources',
      label: '关联资源',
    },
    {
      name: 'relatedCohort',
      type: 'relationship',
      relationTo: 'cohorts',
      label: '关联互助团',
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'media',
      label: '可下载附件',
      admin: {
        description: '模板类成果用它挂可直接下载的文件',
      },
    },
    {
      name: 'byline',
      type: 'text',
      label: '署名',
      admin: {
        description: '成果卡上显示"谁做的"，例如「杭州 AI 互助团 · 林晓」',
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      label: '摘要',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      label: '正文',
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      label: '封面',
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: '首页精选',
      defaultValue: false,
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: '发布时间',
      defaultValue: () => new Date().toISOString(),
      index: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      label: '发布人',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'views',
      type: 'number',
      label: '浏览量',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (!data?.author && req.user) {
          data.author = req.user.id
        }
        return data
      },
    ],
    // 地址标识统一是不透明随机串
    beforeValidate: [generateSlug('publications')],
  },
}
