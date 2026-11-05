'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'

import { createActivity } from '@/app/(admin)/(workspace)/actions'
import { Button } from '@/components/ui/button'

/**
 * 「发起活动」按钮：**点一下就有一条自己的活动**，直接进活动详情页。
 *
 * 发起与进度是同一页——在活动详情页的「① 活动方案」里填内容、保存，
 * 再点「提交活动申请」交项目组审批。（原来要先在一个单独的表单页填完、存草稿、
 * 再跳到进度页，多绕一圈。）
 *
 * ⚠️ 表单的 action 必须**引用稳定**（useCallback）并加一道提交锁：
 * 写成内联箭头函数时，组件重渲染会换掉 action 的身份，
 * React 19 可能把动作再跑一遍——一次点击建出两条空草稿就是这么来的。
 */
export function CreateActivityButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const start = useCallback(() => {
    if (started.current) return
    started.current = true
    setError(null)
    startTransition(async () => {
      const result = await createActivity()
      if (result.ok) {
        // 回到活动详情页（发起与进度是同一页），在「① 活动方案」里继续填
        router.push(`/activities/${result.message}`)
        router.refresh()
      } else {
        started.current = false
        setError(result.message ?? '发起失败')
      }
    })
  }, [router])

  return (
    <div className="text-right">
      <form action={start}>
        {/* 团长最主要的一件事：用主按钮 */}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          {pending ? '创建中…' : '发起活动'}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
