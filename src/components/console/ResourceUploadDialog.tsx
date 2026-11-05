'use client'

import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

import { ResourceForm } from './ResourceForm'

/**
 * 「上传资源」：点开一个弹窗，填完就传。
 *
 * 上传是**偶尔做的事**，资源清单才是这一页的正事——
 * 所以表单收进弹窗，页面留给清单。
 */
export function ResourceUploadDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>上传资源</Button>} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>上传资源</DialogTitle>
          {/* 描述只给读屏软件，不占版面 */}
          <DialogDescription className="sr-only">上传资源</DialogDescription>
        </DialogHeader>
        <ResourceForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
