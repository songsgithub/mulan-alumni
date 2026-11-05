'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createPasswordReset } from '@/app/(admin)/(workspace)/actions'

/**
 * 「重置密码」：项目组给某个团长生成一条一次性链接。
 *
 * 没有邮件也没有短信，所以团长没法自助重置（谁都能填别人的邮箱要求重置，
 * 等于把账号送人）。项目组生成链接后用微信 / 电话发给本人，
 * 团长点开链接自己设新密码——**项目组从头到尾不知道密码**。
 */
export function PasswordResetButton({
  userId,
  userName,
}: {
  userId: number | string
  userName?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = () => {
    setError(null)
    setLink(null)
    setCopied(false)
    const data = new FormData()
    data.set('user', String(userId))
    startTransition(async () => {
      const result = await createPasswordReset(data)
      if (result.ok) {
        setLink(result.data?.link ?? null)
      } else {
        setError(result.message ?? '生成失败，请重试')
      }
    })
  }

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('复制失败，请手动选中链接复制')
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden />
        重置密码
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>给{userName || '团长'}重置密码</DialogTitle>
            <DialogDescription>
              生成一条一次性链接，团长点开自己设新密码。链接 7 天内有效，用过就失效。
            </DialogDescription>
          </DialogHeader>

          {link ? (
            <div className="space-y-4">
              <div className="rounded-control border border-rule bg-surface px-4 py-3">
                <p className="break-all font-mono text-small text-fg">{link}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={copy}>
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? '已复制' : '复制链接'}
                </Button>
                <span className="text-small text-muted">
                  复制后用微信发给本人；重新生成会让旧链接失效。
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-body leading-relaxed text-muted">
                项目组不会看到新密码——密码由团长自己设。这样即使项目组换了人，
                也不掌握任何团长的登录口令。
              </p>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="button" onClick={generate} disabled={pending}>
                {pending ? '生成中…' : '生成重置链接'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
