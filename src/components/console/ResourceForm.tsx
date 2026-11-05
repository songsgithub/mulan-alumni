'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip } from 'lucide-react'

import { FormSelect } from '@/components/console/FormSelect'
import { createResource, updateResource } from '@/app/(admin)/(workspace)/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatFileSize } from '@/lib/format'

/** 单个文件上限 2GB（一小时的学习视频，720p 约 1GB） */
const MAX_SIZE = 2 * 1024 * 1024 * 1024

/** 分类说这份资源是干什么的 */
const CATEGORY_OPTIONS = [
  { value: 'vi', label: '品牌 VI' },
  { value: 'template', label: '工具模板' },
  { value: 'guide', label: '操作指南' },
  { value: 'policy', label: '政策速查' },
]

/** 能传什么：PDF / 视频 / 图片 / Word / 表格 / 文本 */
const ACCEPT = [
  'application/pdf',
  'video/*',
  'image/*',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',')

/**
 * 上传资源（全部公开，附件对所有人可下载）。
 *
 * ⚠️ 文件**不经过 Server Action**：Server Action 会把整个请求体缓冲进内存，
 * 1GB 的视频会把进程撑爆。改成浏览器**直传**到媒体接口（流式落盘），
 * 再把媒体 id 交给 action —— action 只处理几十字节的元数据。
 */
export interface ResourceInitial {
  id: number | string
  title?: string | null
  summary?: string | null
  category?: string | null
  type?: string | null
  url?: string | null
  fileName?: string | null
  /** 原附件大小（编辑时告诉用户手上这份多大） */
  fileSize?: number | null
  /** 发布时间（只读，编辑时也带着） */
  publishedAt?: string | null
}

/**
 * 资源表单：**上传**与**编辑**共用一套。
 *
 * 编辑时（`mode="edit"`）：
 * - 各字段带出原值；
 * - 附件可以换，也可以**不换**（不选文件 = 保留原附件，不是清空）；
 * - 地址标识（slug）不在这张表里——改了等于换地址，已经发出去的链接会失效。
 */
export function ResourceForm({
  onDone,
  mode = 'create',
  initial,
  footer,
  footerRight,
}: {
  onDone?: () => void
  mode?: 'create' | 'edit'
  /** 编辑模式的初值 */
  initial?: ResourceInitial | null
  /**
   * 表单底部**左侧**的操作位（编辑弹窗里的「删除」就放这儿）。
   * 没有它时，提交按钮照旧贴左，上传弹窗的长相不变。
   */
  footer?: React.ReactNode
  /** 底部**右侧**、提交按钮之前的操作位（编辑弹窗里的「取消」）。 */
  footerRight?: React.ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // 提交成功后重挂表单：让客户端状态与服务端重新渲染保持一致
  const [formKey, setFormKey] = useState(0)
  // 类型跟着文件走：选了视频文件就是视频
  const [type, setType] = useState<'doc' | 'video'>(
    initial?.type === 'video' ? 'video' : 'doc',
  )
  // 已选文件名（给用户看自己选了哪个）
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const editing = mode === 'edit' && Boolean(initial?.id)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const file = data.get('file')
    const title = String(data.get('title') ?? '').trim()

    setError(null)
    if (file instanceof File && file.size > MAX_SIZE) {
      setError('文件超过 2GB，请压缩后再传（一小时视频转成 720p 约 1GB）。')
      return
    }

    startTransition(async () => {
      try {
        // 1) 文件直传媒体接口（流式，不占 action 的内存）
        let mediaId: string | number | null = null
        if (file instanceof File && file.size > 0) {
          const payload = new FormData()
          payload.append('file', file)
          payload.append('alt', title)
          payload.append('visibility', 'public')
          const uploaded = await fetch('/api/media', { method: 'POST', body: payload })
          if (!uploaded.ok) {
            const detail = await uploaded.json().catch(() => null)
            setError(detail?.errors?.[0]?.message ?? '文件上传失败')
            return
          }
          const doc = await uploaded.json()
          mediaId = doc?.doc?.id ?? doc?.id ?? null
        }

        // 2) 元数据交给 action
        data.delete('file')
        if (mediaId) data.set('mediaId', String(mediaId))
        if (editing) data.set('id', String(initial?.id ?? ''))
        const result = editing ? await updateResource(data) : await createResource(data)
        if (result.ok) {
          setFormKey((k) => k + 1)
          // 重挂表单时把已选文件也清掉：不然文件名还挂着，input 里却已经没有文件了
          setFileName(null)
          if (fileRef.current) fileRef.current.value = ''
          router.refresh()
          onDone?.()
        } else {
          setError(result.message ?? '上传失败')
        }
      } catch {
        setError('上传失败，请重试')
      }
    })
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="标题" required>
          <Input
            name="title"
            required
            defaultValue={initial?.title ?? ''}
            placeholder="例如：AI 工具入门"
          />
        </Field>
        <Field label="分类" required>
          <FormSelect
            name="category"
            defaultValue={initial?.category ?? 'guide'}
            options={CATEGORY_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        </Field>
      </div>

      <Field label="简介" required>
        <Textarea
          name="summary"
          required
          rows={2}
          defaultValue={initial?.summary ?? ''}
          placeholder="一句话说清能用来做什么"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          as="div"
          label="文件（≤2GB）"
          hint={
            editing
              ? initial?.fileName
                ? `当前：${initial.fileName}${initial.fileSize ? `（${formatFileSize(initial.fileSize)}）` : ''}`
                : '当前：无附件'
              : undefined
          }
        >
          {/* 文件选择：**不用浏览器原生那个按钮**。
              原生按钮的文案（「选择文件」「未选择任何文件」）由系统语言决定——
              英文系统上会露出英文，不是全站中文；它也塞在输入框里，
              按钮贴着上沿、跟输入框的边框对不齐。
              这里改成「隐藏的原生 input + 真正的按钮 + 文件名」，
              跟照片上传、凭证上传是同一套做法（见 PhotoUploader / ReceiptPicker）。 */}
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept={ACCEPT}
            aria-label="文件（≤2GB）"
            className="sr-only"
            onChange={(e) => {
              // 选了视频文件，类型自动跟着走
              const picked = e.target.files?.[0]
              if (picked) {
                setType(picked.type.startsWith('video/') ? 'video' : 'doc')
                setFileName(picked.name)
              } else {
                setFileName(null)
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="rounded-control"
            >
              <Paperclip aria-hidden className="size-4" />
              {fileName ? '重新选择文件' : '选择文件'}
            </Button>
            <span className="min-w-0 flex-1 truncate text-small text-muted">
              {fileName ?? (editing ? '不选则保留原附件' : '还没选文件')}
            </span>
          </div>
        </Field>
        <Field label="外链（视频在线版这类）">
          <Input name="url" defaultValue={initial?.url ?? ''} placeholder="https://" />
        </Field>
      </div>

      {/* 类型是文件形态，不是人的选择：传了视频就是视频，其余都是文档 */}
      <input type="hidden" name="type" value={type} />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {footer || footerRight ? (
        // 底部一行：左边放危险操作（删除），右边放「取消 / 保存」
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">{footer}</div>
          <div className="flex items-center gap-2">
            {footerRight}
            <Button type="submit" disabled={pending}>
              {pending ? (editing ? '保存中…' : '上传中…') : editing ? '保存修改' : '上传'}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="submit" disabled={pending}>
          {pending ? (editing ? '保存中…' : '上传中…') : editing ? '保存修改' : '上传'}
        </Button>
      )}
    </form>
  )
}

function Field({
  label,
  required,
  hint,
  children,
  as = 'label',
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
  /** 文件那一栏用 div：里面装的是按钮，不是输入框，包在 label 里会怪 */
  as?: 'label' | 'div'
}) {
  const Tag = as
  return (
    <Tag className="block">
      <span className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-label font-semibold text-fg">
        <span>
          {label}
          {required ? <span className="ml-1 text-fg">*</span> : null}
        </span>
        {hint ? <span className="font-normal text-faint">{hint}</span> : null}
      </span>
      {children}
    </Tag>
  )
}
