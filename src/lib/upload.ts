import { MEDIA_MIME_TYPES } from '@/collections/Media'
import { RECEIPT_MIME_TYPES } from '@/collections/FinanceEvidence'

import { getClient } from './payload'

/**
 * 站内上传助手：把工作台表单里的文件落成 Payload 媒体 / 财务凭证记录。
 *
 * 公共媒体（活动照片、学习资料附件）写入 `media`；
 * 财务凭证（报销发票、付款回执）写入 `finance-evidence`（仅项目组与本团可见）。
 *
 * ⚠️ 只能从**已经校验过角色与归属**的服务端动作里调用。
 * 这里走本地 API 且不经集合访问控制（集合的 REST 写入只开给后台账号），
 * 所以文件类型在这里再兜一次。
 */

interface UploadResult {
  id: number | string
  filename?: string
  url?: string
}

export class UploadTypeError extends Error {}

/** 是不是一个真文件（空文件框提交上来的 size=0 不算） */
export const isFile = (value: unknown): value is File =>
  typeof File !== 'undefined' && value instanceof File && value.size > 0

/** 上传公共媒体（封面 / 活动照片 / 学习资料附件） */
export const uploadMedia = async (
  file: File,
  alt: string,
  options: { user?: any; visibility?: 'public' | 'internal'; cohort?: number | string | null } = {},
): Promise<UploadResult> => {
  if (!MEDIA_MIME_TYPES.includes(file.type)) throw new UploadTypeError(`不支持的文件类型：${file.name}`)
  const payload = await getClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const doc = await payload.create({
    collection: 'media',
    data: {
      alt,
      visibility: options.visibility ?? 'public',
      cohort: options.cohort ? Number(options.cohort) : null,
      filename: file.name,
    },
    file: {
      data: buffer,
      mimetype: file.type,
      name: file.name,
      size: file.size,
    },
    ...(options.user ? { user: options.user } : {}),
    overrideAccess: true,
  })
  return { id: doc.id, filename: file.name, url: (doc as any)?.url }
}

/** 上传财务凭证（发票 / 收据 / 支付截图 / 付款回单） */
export const uploadFinanceEvidence = async (
  file: File,
  options: {
    user?: any
    kind?: 'invoice' | 'receipt' | 'paymentScreenshot' | 'other'
    cohort?: number | null
    note?: string
  } = {},
): Promise<UploadResult> => {
  if (!RECEIPT_MIME_TYPES.includes(file.type)) throw new UploadTypeError(`票据必须是 PDF 或图片：${file.name}`)
  const payload = await getClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const doc = await payload.create({
    collection: 'finance-evidence',
    data: {
      kind: options.kind ?? 'invoice',
      cohort: options.cohort ?? null,
      note: options.note ?? '',
      filename: file.name,
    },
    file: {
      data: buffer,
      mimetype: file.type,
      name: file.name,
      size: file.size,
    },
    ...(options.user ? { user: options.user } : {}),
    overrideAccess: true,
  })
  return { id: doc.id, filename: file.name, url: (doc as any)?.url }
}

/** 从 FormData 中取出第一个有效文件 */
export const firstFile = (value: FormDataEntryValue | null): File | null => {
  if (!isFile(value)) return null
  return value
}

/** 从 FormData 中取出全部有效文件 */
export const allFiles = (formData: FormData, key: string): File[] =>
  formData.getAll(key).filter(isFile)

/**
 * 按位置取文件：**每一行一个 `<input type=file>`**，没选文件的行浏览器也会提交一个空文件。
 * 保留位置（空的记成 null），文件才能对上它那一行——
 * 用 `allFiles` 会把空的滤掉，第 3 行的凭证就挂到第 2 行去了。
 */
export const filesByPosition = (formData: FormData, key: string): (File | null)[] =>
  formData.getAll(key).map((value) => (isFile(value) ? value : null))
