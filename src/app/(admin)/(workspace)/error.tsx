'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RotateCcw } from 'lucide-react'

import { EmptyState } from '@/components/console/EmptyState'
import { Button } from '@/components/ui/button'

/**
 * 工作台出错时的兜底页：说清「出了什么事、能做什么」，给重试与回首页两个出口。
 * 不把内部报错信息给用户看（可能含路径、字段名），只在控制台留一笔，附带 digest 便于排查。
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('工作台页面出错', error)
  }, [error])

  return (
    <div className="mx-auto max-w-2xl">
      <EmptyState
        className="py-16"
        title="这一页暂时没能打开"
        hint="可能是网络不稳定，或者服务刚好在更新。你填过但还没保存的内容不会提交。"
        actions={
          <>
            <Button onClick={reset}>
              <RotateCcw aria-hidden />
              重新加载
            </Button>
            <Button variant="outline" render={<Link href="/" />}>
              回到活动
            </Button>
          </>
        }
      />
      {error.digest ? <p className="text-center text-small text-muted">错误编号：{error.digest}</p> : null}
    </div>
  )
}
