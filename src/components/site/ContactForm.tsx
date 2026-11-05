'use client'

import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { site } from '@/content/site'

/**
 * 「留下您信息」表单（公众站 /contact）。
 *
 * ⚠️ 字段名与文案来自 `docs/SOP/about&contactpages.docx` 的「联系我们 页面」，
 *    文案取自 `site.contact`，改文案只改 `src/content/site.ts`。
 *
 * 字段：您的姓名 / 联系方式 / 所属机构 / 您的职位 / 您希望如何参与
 * 提交后由 `/api/contact` 给项目组账号发站内通知。
 */
const REQUIRED = ['name', 'contact', 'organization', 'position', 'participation'] as const
type RequiredField = (typeof REQUIRED)[number]

export function ContactForm() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 哪一项没填：那个框标 aria-invalid，并指向错误说明（不用浏览器自带的英文气泡）
  const [invalid, setInvalid] = useState<RequiredField | null>(null)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const missing = REQUIRED.find((key) => !String(data.get(key) ?? '').trim())
    if (missing) {
      setInvalid(missing)
      setError(`请填写${site.contact.fields[missing].replace(/[：:？?]\s*$/, '')}`)
      form.querySelector<HTMLElement>(`[name="${missing}"]`)?.focus()
      return
    }
    setInvalid(null)
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          contact: data.get('contact'),
          organization: data.get('organization'),
          position: data.get('position'),
          participation: data.get('participation'),
          website: data.get('website'),
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) {
        setError(result?.message ?? site.contact.error)
        return
      }
      setSent(true)
      form.reset()
    } catch {
      setError(site.contact.error)
    } finally {
      setPending(false)
    }
  }

  if (sent) {
    return (
      <Alert>
        <AlertDescription>{site.contact.sent}</AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <label className="block">
          <span className="mb-2 block text-[1.0625rem] font-medium">
            {site.contact.fields.name}
            <span aria-hidden className="text-danger">
              {' '}
              *
            </span>
          </span>
          <Input name="name" required aria-invalid={invalid === 'name' || undefined} aria-describedby={invalid === 'name' ? 'contact-error' : undefined} maxLength={40} autoComplete="name" />
        </label>

        <label className="block">
          <span className="mb-2 block text-[1.0625rem] font-medium">
            {site.contact.fields.contact}
            <span aria-hidden className="text-danger">
              {' '}
              *
            </span>
          </span>
          <Input name="contact" required aria-invalid={invalid === 'contact' || undefined} aria-describedby={invalid === 'contact' ? 'contact-error' : undefined} maxLength={80} autoComplete="email" />
        </label>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[1.0625rem] font-medium">
              {site.contact.fields.organization}
              <span aria-hidden className="text-danger">
                {' '}
                *
              </span>
            </span>
            <Input name="organization" required aria-invalid={invalid === 'organization' || undefined} aria-describedby={invalid === 'organization' ? 'contact-error' : undefined} maxLength={80} autoComplete="organization" />
          </label>
          <label className="block">
            <span className="mb-2 block text-[1.0625rem] font-medium">
              {site.contact.fields.position}
              <span aria-hidden className="text-danger">
                {' '}
                *
              </span>
            </span>
            <Input name="position" required aria-invalid={invalid === 'position' || undefined} aria-describedby={invalid === 'position' ? 'contact-error' : undefined} maxLength={80} autoComplete="organization-title" />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-[1.0625rem] font-medium">
            {site.contact.fields.participation}
            <span aria-hidden className="text-danger">
              {' '}
              *
            </span>
          </span>
          <Textarea name="participation" required aria-invalid={invalid === 'participation' || undefined} aria-describedby={invalid === 'participation' ? 'contact-error' : undefined} rows={5} maxLength={1000} />
        </label>

        {/* 蜜罐：真人看不到，机器人会填 */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

        {error ? (
          <Alert variant="destructive">
            <AlertDescription id="contact-error">{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? '提交中…' : site.contact.submit}
        </Button>
      </form>
      {/* 表单底部的提示（docx「底部提示」） */}
      <p className="mt-4 border-t border-line/70 pt-4 text-[0.9375rem] leading-relaxed text-ink-muted">
        {site.contact.replyNote}
      </p>
    </>
  )
}
