'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'

import { resetPassword } from '@/app/(admin)/(auth)/reset-password/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * 设置新密码（凭重置链接）。
 *
 * 规则与注册时一致：至少 8 位、字母 + 数字、最多 72 位。
 * 提交后链接立刻作废——同一条链接不能改第二次。
 */
export function ResetPasswordForm({ token, emailHint }: { token: string; emailHint?: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('token', token)
    setError(null)
    startTransition(async () => {
      const result = await resetPassword(data)
      if (result.ok) {
        setDone(true)
      } else {
        setError(result.message ?? '重置失败，请重试')
      }
    })
  }

  if (done) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>密码已改好，现在可以用新密码登录了。</AlertDescription>
        </Alert>
        <Button render={<Link href="/login" />}>去登录</Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {emailHint ? (
        <p className="text-body text-muted">
          这条链接给的是 <span className="font-semibold text-fg">{emailHint}</span>。
        </p>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-label font-semibold text-fg">新密码</span>
        <Input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="至少 8 位，字母 + 数字"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-label font-semibold text-fg">再输一遍</span>
        <Input
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          placeholder="确认新密码"
        />
      </label>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? '提交中…' : '设好新密码'}
      </Button>
    </form>
  )
}
