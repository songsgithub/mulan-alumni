'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { updateProfile } from '@/app/(admin)/(workspace)/actions'
import {
  InlineEditHeader,
  InlineFieldControl,
  InlineFieldList,
  InlineFieldRow,
} from '@/components/console/InlineFields'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

/**
 * 个人信息卡：**默认只读，点「修改」才进入编辑**。
 *
 * 查看态与编辑态共用同一套「一行一项」的行骨架（InlineFields）：
 * 编辑时右边换成输入框，行高与卡片高度都不变；注册时间那一行始终只读。
 * 邮箱是登录身份——保存成功后提示「下次登录用新邮箱」。
 */
export function ProfileCard({
  name,
  phone,
  email,
  joinedAt,
}: {
  name: string
  phone: string
  email: string
  joinedAt: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  // 邮箱改没改：改了才要求输入当前密码（服务端同样校验），保存后才提示「下次用新邮箱」
  const [emailDraft, setEmailDraft] = useState(email)
  const [emailChanged, setEmailChanged] = useState(false)
  const changingEmail = emailDraft.trim().toLowerCase() !== email.toLowerCase()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateProfile(data)
      if (result.ok) {
        setError(null)
        setSaved(result.message ?? '已更新')
        setEmailChanged(changingEmail)
        setEditing(false)
        router.refresh()
      } else {
        setSaved(null)
        setError(result.message ?? '保存失败')
      }
    })
  }

  if (editing) {
    return (
      <Card className="p-4 sm:p-6">
        <form onSubmit={submit}>
          <InlineEditHeader
            title="我的信息"
            editing
            pending={pending}
            onEdit={() => setEditing(true)}
            onCancel={() => {
              setError(null)
              setEmailDraft(email)
              setEditing(false)
            }}
          />
          <InlineFieldList className="mt-2">
            <InlineFieldRow label="姓名">
              <InlineFieldControl>
                <Input
                  name="name"
                  defaultValue={name}
                  required
                  maxLength={40}
                  aria-label="姓名"
                  className="w-full text-right"
                />
              </InlineFieldControl>
            </InlineFieldRow>
            <InlineFieldRow label="手机号">
              <InlineFieldControl>
                <Input
                  name="phone"
                  type="tel"
                  defaultValue={phone}
                  maxLength={11}
                  placeholder="选填"
                  aria-label="手机号"
                  className="w-full text-right"
                />
              </InlineFieldControl>
            </InlineFieldRow>
            <InlineFieldRow label="邮箱">
              <InlineFieldControl>
                <Input
                  name="email"
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  required
                  maxLength={120}
                  aria-label="邮箱（登录账号）"
                  className="w-full text-right"
                />
              </InlineFieldControl>
            </InlineFieldRow>
            {changingEmail ? (
              <InlineFieldRow label="当前密码">
                <InlineFieldControl>
                  <Input
                    name="currentPassword"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="改邮箱要确认是你本人"
                    aria-label="当前密码（修改邮箱需要确认）"
                    className="w-full text-right"
                  />
                </InlineFieldControl>
              </InlineFieldRow>
            ) : null}
            <InlineFieldRow label="注册时间">{joinedAt}</InlineFieldRow>
          </InlineFieldList>

          {error ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </Card>
    )
  }

  return (
    <Card className="p-4 sm:p-6">
      <div>
        <InlineEditHeader
          title="我的信息"
          editing={false}
          pending={pending}
          editLabel="修改"
          onEdit={() => {
            setEmailDraft(email)
            setEditing(true)
          }}
          onCancel={() => setEditing(false)}
        />
        {saved ? (
          <Alert className="mt-3">
            <AlertDescription>
              {saved}
              {emailChanged ? '。下次登录请用新邮箱。' : ''}
            </AlertDescription>
          </Alert>
        ) : null}
        <InlineFieldList className="mt-2">
          <InlineFieldRow label="姓名">{name || '—'}</InlineFieldRow>
          <InlineFieldRow label="手机号">{phone || '—'}</InlineFieldRow>
          <InlineFieldRow label="邮箱">{email}</InlineFieldRow>
          <InlineFieldRow label="注册时间">{joinedAt}</InlineFieldRow>
        </InlineFieldList>
      </div>
    </Card>
  )
}
