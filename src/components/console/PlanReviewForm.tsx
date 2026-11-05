'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { reviewPlan } from '@/app/(admin)/(workspace)/actions'
import { ConfirmDialog } from '@/components/console/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

/**
 * 活动审批表单（项目组）。
 *
 * 审核结果默认【审核通过】；不通过时审核意见必填。
 * 点「提交审核结果」先弹**二次确认**，确认后才真正提交。
 */
export function PlanReviewForm({ planId }: { planId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<'approved' | 'rejected'>('approved')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const doReview = () => {
    startTransition(async () => {
      const form = document.getElementById(`plan-review-${planId}`) as HTMLFormElement | null
      const data = new FormData(form ?? undefined)
      data.set('id', planId)
      data.set('action', action)
      const result = await reviewPlan(data)
      setConfirmOpen(false)
      if (result.ok) {
        setError(null)
        router.refresh()
      } else {
        setError(result.message ?? '操作失败')
      }
    })
  }

  return (
    <form id={`plan-review-${planId}`} onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 block text-body font-semibold text-fg">审核结果</legend>
          <div className="flex gap-2">
            {(
              [
                { value: 'approved', label: '审核通过' },
                { value: 'rejected', label: '审核不通过' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-4 text-body font-medium transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40',
                  action === opt.value
                    ? opt.value === 'approved'
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-danger bg-danger-soft text-danger'
                    : 'border-rule bg-card text-fg hover:border-accent/40',
                )}
              >
                <input
                  type="radio"
                  name="action"
                  value={opt.value}
                  checked={action === opt.value}
                  onChange={() => setAction(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-body font-semibold text-fg">
            审核意见{action === 'rejected' ? '（必填）' : '（可选填）'}
          </span>
          <Textarea
            name="comment"
            rows={3}
            required={action === 'rejected'}
            placeholder={action === 'rejected' ? '写清不通过的原因' : '可写审批要点，留痕备查'}
          />
        </label>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="button"
          onClick={() => {
            // 不通过必须写原因：在弹确认之前就拦下，别让人点完确认才被服务端退回
            const form = document.getElementById(`plan-review-${planId}`) as HTMLFormElement | null
            const comment = String(new FormData(form ?? undefined).get('comment') ?? '').trim()
            if (action === 'rejected' && !comment) {
              setError('审核不通过时，请写清原因')
              return
            }
            setError(null)
            setConfirmOpen(true)
          }}
          disabled={pending}
        >
          {pending ? '提交中…' : '提交审核结果'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone={action === 'rejected' ? 'danger' : 'default'}
        title={action === 'approved' ? '通过这份活动申请？' : '不通过这份活动申请？'}
        description={
          action === 'approved'
            ? '通过后团长就可以开展活动，审核结果会通知团长并留痕。'
            : '申请会退回给团长修改后重新提交，审核意见会通知团长并留痕。'
        }
        confirmLabel={action === 'approved' ? '确认通过' : '确认不通过'}
        pending={pending}
        onConfirm={doReview}
      />
    </form>
  )
}
