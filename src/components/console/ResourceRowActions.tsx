'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'

import { ResourceEditDialog, type ResourceDetail } from '@/components/console/ResourceEditDialog'
import { Button } from '@/components/ui/button'

/**
 * 资源清单里的一行操作：**只有一个「编辑」**（2026-11-02 第四十四轮）。
 *
 * 以前是「查看」+「删除」两个按钮：查看进只读详情，改要在详情里再点一次「编辑」，
 * 删是另一个按钮——同一条记录三个意思差不多的入口，看的人要愣一下才敢动手。
 * 现在行里**只留一个「编辑」**：点开就是一张弹窗，
 * 里面原值摘要、编辑表单、删除（二次确认）全都在。
 *
 * ⚠️ 行内**只有这一个按钮**。查看与删除都从这里进——
 * 免得同一条记录摆三个意思差不多的动作，只会让人犹豫。
 */
export function ResourceRowActions({ resource }: { resource: ResourceDetail }) {
  const [editing, setEditing] = useState(false)

  return (
    <>
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          aria-label={`编辑：${resource.title ?? ''}`}
        >
          <Pencil aria-hidden />
          编辑
        </Button>
      </div>

      <ResourceEditDialog resource={resource} open={editing} onOpenChange={setEditing} />
    </>
  )
}
