'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { createInvitationLink } from '@/app/(admin)/(workspace)/actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * 项目组生成**邀请链接**。
 *
 * 对方打开链接填完资料：
 * - `create-cohort`：互助团建成，对方成为团长
 * - `transfer-lead`：对方接管指定互助团的团长
 *
 * 链接用过即失效，固定 7 天有效。
 *
 * 点一下：**生成 → 直接复制到剪贴板 → 按钮变成「已复制」**。
 * 不弹链接框，也不另写有效期文案——按钮本身就是反馈。
 */

/** 复制到剪贴板：优先用异步剪贴板 API，失败退回老办法（选中 + execCommand） */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const input = document.createElement('textarea')
      input.value = text
      input.setAttribute('readonly', '')
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(input)
      return ok
    } catch {
      return false
    }
  }
}

export function InviteCohortForm({
  purpose = 'create-cohort',
  cohortId,
  plain = false,
}: {
  purpose?: 'create-cohort' | 'transfer-lead'
  /** 团长转移时要移交的互助团 */
  cohortId?: number | string
  /** 嵌在别的卡片里用：不再套一层卡片 */
  plain?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [failedLink, setFailedLink] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 「已复制」停两秒多就回到原样，还能再点
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    data.set('purpose', purpose)
    if (cohortId) data.set('cohort', String(cohortId))
    startTransition(async () => {
      const result = await createInvitationLink(data)
      if (result.ok) {
        setError(null)
        setFailedLink(null)
        const link = result.message ?? ''
        const ok = await copyText(link)
        if (ok) {
          setCopied(true)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => setCopied(false), 2500)
        } else {
          // 复制不了就把链接摆出来，让人自己拷
          setFailedLink(link)
        }
        router.refresh()
      } else {
        setError(result.message ?? '生成失败')
        setCopied(false)
      }
    })
  }

  const label = copied ? '已复制' : purpose === 'transfer-lead' ? '复制转移链接' : '生成邀请链接'

  const button = (
    <Button
      type="submit"
      size="sm"
      variant={copied ? 'secondary' : 'default'}
      disabled={pending}
      className="self-start"
    >
      {pending ? '生成中…' : label}
    </Button>
  )

  const fallback = failedLink ? (
    <p className="text-label text-muted">
      自动复制失败，请手动复制：
      <code className="ml-1 break-all rounded-control bg-surface px-2 py-1">{failedLink}</code>
    </p>
  ) : null

  if (plain) {
    // 嵌在卡片里：一行放得下
    return (
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {button}
          {fallback}
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </form>
    )
  }

  return (
    <form onSubmit={submit}>
      <Card className="space-y-4 p-4 sm:p-6">
        {/* 卡片里就一个按钮太空：把「点下去会发生什么」写清楚，
            不用另开一个说明卡（那是上一页左栏的活儿）。 */}
        <p className="text-body leading-relaxed text-muted">
          {purpose === 'transfer-lead'
            ? '生成一条团长转移链接：对方打开填完资料，就接管这个互助团。'
            : '生成一条邀请链接：对方打开填完资料，互助团就建好了，他自动成为团长。'}
        </p>
        {button}
        {fallback}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </Card>
    </form>
  )
}
