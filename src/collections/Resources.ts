import type { CollectionConfig } from 'payload'

import { opsOnly } from '../access'
import { generateSlug } from '../lib/slug'

/**
 * 资源（项目 VI、视频、文本、图片、文件）。
 *
 * **全部公开**——没有"内部资源"这一说（见 docs/设计规范.md §4.7）。
 * 公众站与工作台看到的是同一批资源。
 */
export const Resources: CollectionConfig = {
  slug: 'resources',
  labels: {
    singular: '资源',
    plural: '资源',
  },
  admin: {
    group: '资源',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'category', 'publishedAt', 'featured'],
  },
  access: {
    // 资源全部公开
    read: () => true,
    // 写入一律走服务端动作（工作台「资源」页的编辑 / 删除）：
    // 项目组在那里逐条校验身份与字段白名单。
    // REST / GraphQL 直写只给后台账号——否则任何登录用户都能
    // 直接 PATCH /api/resources/<id> 改掉公众站上正在展示的资料。
    create: opsOnly,
    update: opsOnly,
    delete: opsOnly,
  },
  hooks: {
    // 地址标识统一是不透明随机串
    beforeValidate: [generateSlug('resources')],
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
      // 类型只说**文件形态**：文档 / 视频。
      // docx / PDF / PPTX / CDR / PS / 图片……都算"文档"，
      // 具体是什么格式由附件的 mimetype 决定（页面上显示 PDF / Word / 表格…）。
      name: 'type',
      type: 'select',
      label: '类型',
      required: true,
      defaultValue: 'doc',
      index: true,
      options: [
        { label: '文档', value: 'doc' },
        { label: '视频', value: 'video' },
      ],
    },
    {
      name: 'category',
      type: 'select',
      label: '分类',
      required: true,
      defaultValue: 'guide',
      options: [
        { label: '品牌 VI', value: 'vi' },
        { label: '工具模板', value: 'template' },
        { label: '操作指南', value: 'guide' },
        { label: '政策速查', value: 'policy' },
      ],
    },
    {
      name: 'summary',
      type: 'textarea',
      label: '一句话说明',
    },
    {
      name: 'body',
      type: 'richText',
      label: '正文',
    },
    {
      name: 'url',
      type: 'text',
      label: '外链',
      admin: {
        description: '视频、VI 在线版这类放外链；留空则用下面的文件',
      },
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'media',
      label: '附件',
      admin: {
        description: '可下载的文件（docx / PDF / PPTX / CDR / PS / 图片…）',
      },
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      label: '封面图',
    },
    {
      name: 'tags',
      type: 'array',
      label: '标签',
      fields: [
        {
          name: 'tag',
          type: 'text',
          label: '标签',
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: '发布时间',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'relatedCohort',
      type: 'relationship',
      relationTo: 'cohorts',
      label: '贡献的互助团',
      admin: {
        description: '填了就会出现在该团的公开页面上',
      },
      index: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      label: '上传人',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'downloads',
      type: 'number',
      label: '下载次数',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: '首页推荐',
      defaultValue: false,
    },
  ],
}
