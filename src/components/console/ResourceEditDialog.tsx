'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/console/ConfirmDialog'
import { ResourceForm, type ResourceInitial } from '@/components/console/ResourceForm'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/format'
import { deleteResource } from '@/app/(admin)/(workspace)/actions'

/** 资源详情（编辑弹窗要带的全部信息） */
export interface ResourceDetail extends ResourceInitial {
  fileSize?: number | null
  fileKind?: string | null
  publishedAt?: string | null
}

/**
 * 资源编辑弹窗：**查看、改、删都在这一张弹窗里**（2026-11-02 第四十四轮）。
 *
 * 以前资源行里摆着「查看」与「删除」两个按钮：查看进只读详情，改要在详情里再点一次「编辑」，
 * 删是另一个按钮——同一条记录三个意思差不多的入口，看的人要愣一下才敢动手。
 * 现在行里**只留一个「编辑」**，弹窗里把该做的都摆齐：
 * - 顶部一行**只读**的原值摘要（发布时间），改之前先看清楚；
 * - 中间是**表单**（标题 / 分类 / 简介 / 文件 / 外链），各字段带出原值；
 * - 底部左侧「删除这份资源」（二次确认），右侧「取消 / 保存修改」。
 *
 * 资源是**公开内容**：改了立刻上公众站，删了立刻下架——所以删除仍然要问一句。
 *
 * ⚠️ 行内**只有这一个按钮**：「编辑」。查看、删除都从这里进，
 * 免得同一条记录摆三个意思差不多的动作。
 */
export function ResourceEditDialog({
  resource,
  open,
  onOpenChange,
}: {
  resource: ResourceDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const title = resource.title || '这份资源'

  const onDelete = () => {
    setError(null)
    const data = new FormData()
    data.set('id', String(resource.id))
    startTransition(async () => {
      const result = await deleteResource(data)
      if (result.ok) {
        setConfirming(false)
        // 删完就把弹窗一起收了：这一行已经不存在了
        onOpenChange(false)
        router.refresh()
      } else {
        setError(result.message ?? '删除失败')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑资源</DialogTitle>
          <DialogDescription>
            「{title}」
            {resource.publishedAt ? `，发布于 ${formatDate(resource.publishedAt)}` : ''}
            。改完点「保存修改」，公众站立刻生效。
          </DialogDescription>
        </DialogHeader>

        <ResourceForm
          mode="edit"
          initial={resource}
          onDone={() => {
            // 存完收掉弹窗：这一页是「改资源」，改完了回清单
            onOpenChange(false)
            router.refresh()
          }}
          footer={
            <Button
              type="button"
              variant="outline"
              className="text-danger hover:text-danger"
              onClick={() => setConfirming(true)}
              aria-label={`删除这份资源：${title}`}
            >
              <Trash2 aria-hidden />
              删除这份资源
            </Button>
          }
          footerRight={
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
          }
        />
      </DialogContent>

      {/* 删除是撤不回来的操作：先问一句，确认过才真删 */}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="删除这份资源？"
        description={
          <>
            「{title}」会从公众站上消失，已经发出去的链接会失效。
            <span className="mt-1 block text-danger">删了撤不回来。</span>
            {error ? <span className="mt-1 block">{error}</span> : null}
          </>
        }
        confirmLabel="删除"
        tone="danger"
        pending={pending}
        onConfirm={onDelete}
      />
    </Dialog>
  )
}
