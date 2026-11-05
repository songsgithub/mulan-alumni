import type { CollectionConfig } from 'payload'

import { cohortIdsOf, isManager, isOps, opsOnly } from '../access'
import { sniffUpload } from '../lib/file-sniff'

/** 票据只收 PDF 与常见位图（显式列出，不收 SVG） */
export const RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]

/**
 * 财务凭证库（报销发票 / 收据 / 支付截图、付款回执）。
 *
 * SOP 4.3「务实透明」与「每一笔报销均需凭证齐全」要求凭证可追溯，
 * 但凭证属于内部财务材料，不能对未登录用户开放：
 * - 项目组：全部可见；
 * - 核心成员：只看本团凭证；
 * - 公众：完全不可见。
 */
export const FinanceEvidence: CollectionConfig = {
  slug: 'finance-evidence',
  labels: {
    singular: '财务凭证',
    plural: '财务凭证',
  },
  admin: {
    group: '活动与经费',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'kind', 'cohort', 'createdAt'],
  },
  access: {
    read: async (args) => {
      const { user } = args.req
      if (!user) return false
      if (isManager(user)) return true
      const ids = await cohortIdsOf(user, args.req)
      if (!ids.length) return false
      return { cohort: { in: ids } }
    },
    // 凭证只经服务端动作上传（带团归属）；REST 写入只给后台账号——
    // 否则能把别团凭证的 cohort 改成自己团，然后读到别团的发票
    create: opsOnly,
    update: opsOnly,
    delete: opsOnly,
  },
  upload: {
    staticDir: 'finance-evidence',
    // 票据只接受 PDF 或图片（发票电子版 / 收据拍照 / 支付截图）
    mimeTypes: RECEIPT_MIME_TYPES,
    filesRequiredOnCreate: false,
  },
  hooks: {
    // 按文件内容认类型（不信浏览器报的类型与扩展名）
    beforeOperation: [sniffUpload(RECEIPT_MIME_TYPES, '票据', isOps)],
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      label: '凭证类型',
      defaultValue: 'invoice',
      options: [
        { label: '发票', value: 'invoice' },
        { label: '收据', value: 'receipt' },
        { label: '支付截图', value: 'paymentScreenshot' },
        { label: '其他证明材料', value: 'other' },
      ],
      index: true,
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      label: '所属互助团',
      index: true,
    },
    {
      name: 'note',
      type: 'textarea',
      label: '备注',
    },
  ],
}
