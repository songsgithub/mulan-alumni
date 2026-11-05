'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ReceiptFile {
  file: File
  /** 这个附件是哪一笔费用的说明（默认自动填「明细项 · 票据 N」，可改） */
  note: string
}

/**
 * 一笔支出的凭证：**可以挂多个**（发票 + 支付截图 + 现场照片…），
 * 每张都要写一句"这是哪一笔的费用"的说明——审核的人一眼就知道这张票对应哪条明细。
 *
 * 真正的文件放在原生 `<input name="receipt-<行号>" multiple>` 里，
 * 用 DataTransfer 把状态里的文件同步回 input，FormData 提交不变。
 */
export function ReceiptPicker({
  rowIndex,
  itemName,
  description,
  existing = [],
  onError,
}: {
  /** 这一笔在明细表里的行号（决定 input 的 name，提交时按行对位） */
  rowIndex: number
  /** 明细项名称，作为附件说明的默认值 */
  itemName: string
  /** 事项说明 */
  description?: string
  /** 已上传的凭证（编辑时保留） */
  existing?: { id?: number | string; filename?: string | null; note?: string | null }[]
  onError?: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<ReceiptFile[]>([])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const transfer = new DataTransfer()
    files.forEach((item) => transfer.items.add(item.file))
    input.files = transfer.files
  }, [files])

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    const next = Array.from(list).map((file, index) => ({
      file,
      note: `${itemName} · 票据 ${files.length + index + 1}`,
    }))
    const bad = next.find((item) => {
      const t = item.file.type
      return !(t === 'application/pdf' || t.startsWith('image/'))
    })
    if (bad) {
      onError?.(`「${bad.file.name}」不是 PDF 或图片，票据只收这两种`)
      return
    }
    setFiles((prev) => [...prev, ...next])
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        name={`receipt-${rowIndex}`}
        accept="application/pdf,image/*"
        multiple
        className="sr-only"
        onChange={(e) => addFiles(e.target.files)}
      />

      {existing.length ? (
        <ul className="mb-1 space-y-0.5">
          {existing.map((item, index) => (
            <li key={item.id ?? index} className="flex items-center gap-1.5 text-small text-muted">
              <Paperclip aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{item.note || item.filename || `附件 ${index + 1}`}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {files.length ? (
        <ul className="mb-2 space-y-1.5">
          {files.map((item, index) => (
            <li key={`${item.file.name}-${index}`} className="rounded-control border border-rule p-1.5">
              <div className="flex items-center gap-1.5">
                <FileText aria-hidden className="size-3.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-small" title={item.file.name}>
                  {item.file.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="shrink-0 text-muted hover:bg-console-accent"
                  aria-label={`移除附件 ${index + 1}`}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <Input
                name={`receiptNote-${rowIndex}`}
                value={item.note}
                onChange={(e) =>
                  setFiles((prev) =>
                    prev.map((row, i) => (i === index ? { ...row, note: e.target.value } : row)),
                  )
                }
                placeholder="这个附件是哪一笔的费用"
                aria-label={`附件 ${index + 1} 对应哪一笔费用`}
                maxLength={60}
                className="mt-1 text-small"
              />
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        className="text-small"
      >
        <Paperclip className="size-4" />
        {files.length || existing.length ? '再加一个附件' : '上传凭证'}
      </Button>
      {!files.length && !existing.length ? (
        <p className="mt-1 text-small text-muted">
          {description ? `${description} · ` : ''}可传多张（发票 / 收据 / 支付截图），每张写清对应哪一笔
        </p>
      ) : null}
    </div>
  )
}
