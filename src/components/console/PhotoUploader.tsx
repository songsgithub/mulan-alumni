'use client'

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PhotoItem {
  file: File
  url: string
  note: string
}

/**
 * 活动照片上传：选完即时预览、可写一句说明；提交前不落库，刷新即丢。
 * 真正的文件仍放在原生 <input name="photos"> 里，保证 FormData 提交不变。
 */
export function PhotoUploader({
  existing = [],
  min = 3,
  max = 5,
}: {
  existing?: { url?: string | null; note?: string | null }[]
  min?: number
  max?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<PhotoItem[]>([])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const transfer = new DataTransfer()
    items.forEach((item) => transfer.items.add(item.file))
    input.files = transfer.files
  }, [items])

  useEffect(
    () => () => {
      items.forEach((item) => URL.revokeObjectURL(item.url))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    const next = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({ file, url: URL.createObjectURL(file), note: '' }))
    setItems((prev) => [...prev, ...next].slice(0, max))
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = (index: number) => {
    setItems((prev) => {
      URL.revokeObjectURL(prev[index].url)
      return prev.filter((_, i) => i !== index)
    })
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        name="photos"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => addFiles(e.target.files)}
      />

      {existing.length ? (
        <div className="mb-4">
          <p className="mb-2 text-small text-muted">
            已上传 {existing.length} 张（不重新选择则保留原照片与说明）
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {existing.map((photo, index) => (
              <figure key={photo.url ?? index} className="m-0">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={photo.note || `照片 ${index + 1}`}
                    className="aspect-[4/3] w-full border border-rule object-cover"
                  />
                ) : null}
                <figcaption className="mt-1 line-clamp-2 text-small text-muted">
                  {photo.note || `照片 ${index + 1}`}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      {items.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item, index) => (
            <div key={item.url} className="rounded-control border border-rule p-2">
              <div className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={`活动照片 ${index + 1}`}
                  className="aspect-[4/3] w-full bg-surface object-contain"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="absolute right-1 top-1 bg-white/90 text-fg shadow-soft hover:bg-white"
                  aria-label={`移除照片 ${index + 1}`}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-small text-muted">照片 {index + 1}</span>
                <Input
                  name="photoNote"
                  value={item.note}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, note: e.target.value } : row)),
                    )
                  }
                  placeholder="这一张的说明（可选）"
                  aria-label={`第 ${index + 1} 张照片的说明`}
                  maxLength={60}
                  className="flex-1 text-small"
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={items.length >= max}
        >
          <ImagePlus className="size-4" />
          {items.length ? '继续添加照片' : '选择活动照片'}
        </Button>
        <span className="text-small text-muted">
          {min}-{max} 张，要有全体合影 · 已选 {items.length} 张
          {items.length < min ? `（还差 ${min - items.length} 张）` : ''}
        </span>
      </div>


    </div>
  )
}
