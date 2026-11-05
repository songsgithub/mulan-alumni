import type { CollectionConfig, Where } from 'payload'

import { cohortIdsOf, isManager, opsOnly } from '../access'
import { sniffUpload } from '../lib/file-sniff'

/**
 * 允许的文件类型：**显式列出**，不用 `image/*`——那会放进 SVG，
 * 而 SVG 里能写脚本，同源打开就能拿项目组的登录态（存储型 XSS）。
 */
export const MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'text/plain',
  'text/csv',
]

/**
 * 公共媒体库（封面、头像、活动照片、学习资料附件）。
 *
 * 读取规则：
 * - 未登录用户只能看到 visibility = public 的文件（学习资料要能匿名下载）；
 * - 团长另外能看到**自己团**的内部文件（还没发布的活动照片、视频、签到表）；
 * - 项目组可看全部。
 * 活动照片提交时是内部文件，报销审核通过、活动自动发布到公开站时才转为公开（见 actions.ts 的 publishReport）。
 *
 * 财务凭证不放这里，见 `FinanceEvidence`。
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: '媒体文件',
    plural: '媒体文件',
  },
  admin: {
    group: '系统',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'visibility', 'alt', 'createdAt'],
  },
  access: {
    // 公开文件人人可看；内部文件（还没发布的活动照片等）只给项目组与**所属团的团长**。
    // 文件下载地址 /api/media/file/<名> 也走这条规则
    read: async (args) => {
      const { user } = args.req
      if (isManager(user)) return true
      const isPublic: Where = { visibility: { equals: 'public' } }
      if (!user) return isPublic
      const ids = await cohortIdsOf(user, args.req)
      if (!ids.length) return isPublic
      return { or: [isPublic, { cohort: { in: ids } }] }
    },
    // REST 直传只给项目组（资源页的大文件上传）；团长的照片经服务端动作上传
    create: ({ req: { user } }) => isManager(user),
    // 改文件 / 改可见范围只给后台账号：否则能替换公开站封面、把内部视频翻成公开
    update: opsOnly,
    delete: opsOnly,
  },
  upload: {
    // 本地开发写入 ./media（生产用 S3 适配器，见 payload.config.ts）
    staticDir: 'media',
    mimeTypes: MEDIA_MIME_TYPES,
    filesRequiredOnCreate: false,
  },
  hooks: {
    // 按文件内容认类型（不信浏览器报的类型与扩展名），扩展名改成真实类型的
    beforeOperation: [sniffUpload(MEDIA_MIME_TYPES, '文件', isManager)],
    // 单个文件上限 2GB（与 payload.config.ts 的 upload.limits、资源上传表单一致）
    beforeValidate: [
      ({ data }) => {
        const size = Number((data as any)?.filesize ?? 0)
        if (size > 2 * 1024 * 1024 * 1024) {
          throw new Error('文件超过 2GB 上限')
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: '替代文字',
      admin: {
        description: '供读屏软件使用，例如"第 3 期工作坊合照"。',
      },
    },
    {
      name: 'visibility',
      type: 'select',
      label: '可见范围',
      defaultValue: 'public',
      options: [
        { label: '公开（所有人可见 / 可下载）', value: 'public' },
        { label: '仅内部', value: 'internal' },
      ],
      index: true,
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      label: '所属互助团',
      index: true,
      admin: {
        description: '活动照片等内部文件归属哪个团：这个团的团长能看，活动发布到公开站后转为公开',
      },
    },
  ],
}
