'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { reviewReport } from '@/app/(admin)/(workspace)/actions'
import { ConfirmDialog } from '@/components/console/ConfirmDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const QUICK_REASONS = [
  '活动照片不足 3 张或缺少合照',
  '签到表与参与人数对不上',
  '活动总结写得太简单',
  '费用超出标准，或与《经费支出明细表》不符',
  '凭证不清晰 / 与明细对不上',
]

/**
 * 活动反馈审核（项目组）——**采纳 / 退回**（2026-11-03 第五十一轮）。
 *
 * 链路改成四段：活动申请 → 活动审核 → **活动反馈（采纳）** → 报销审核。
 *
 * - **采纳**：反馈标记为已采纳 → 活动**自动发布到公开站** → **推到报销环节**
 *   （由《经费支出明细表》生成报销单，等报销审核负责人核定）。
 * - **退回**：意见必填，反馈退回团长补充，团长改完重新提交。
 *
 * 谁能审：**活动审核负责人**（这个位置不会被置空，反馈环节永远有人管）。
 */
export function ReportReviewForm({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [action, setAction] = useState<'approved' | 'rejected'>('approved')
  const [comment, setComment] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const ask = () => {
    if (action === 'rejected' && !comment.trim()) {
      setError('退回时，请写清需要团长补充什么')
      return
    }
    setError(null)
    setConfirmOpen(true)
  }

  const doReview = () => {
    startTransition(async () => {
      const data = new FormData()
      data.set('id', reportId)
      data.set('action', action)
      data.set('comment', comment)
      const result = await reviewReport(data)
      setConfirmOpen(false)
      if (result.ok) {
        setError(null)
        setMessage(result.message ?? null)
        router.refresh()
      } else {
        setError(result.message ?? '操作失败')
      }
    })
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 block text-body font-semibold text-fg">审核结果</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'approved', label: '采纳并发布' },
              { value: 'rejected', label: '退回补充' },
            ] as const
          ).map((opt) => {
            const selected = action === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setAction(opt.value)}
                className={cn(
                  'min-h-11 rounded-control border px-3 text-body font-medium transition-colors',
                  selected
                    ? opt.value === 'approved'
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-danger bg-danger-soft text-danger'
                    : 'border-rule bg-card text-fg hover:border-accent/40',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-body font-semibold text-fg">
          审核意见{action === 'rejected' ? '（必填）' : '（可选填）'}
        </span>
        {action === 'rejected' ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setComment((prev) => (prev.includes(reason) ? prev : prev ? `${prev}\n${reason}` : reason))}
                className="rounded-full border border-rule bg-card px-3 py-1.5 text-small text-fg transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger"
              >
                + {reason}
              </button>
            ))}
          </div>
        ) : null}
        <Textarea
          rows={3}
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={action === 'rejected' ? '写清需要团长补充什么' : '可写审核要点，留痕备查'}
        />
      </label>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert role="status">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="button" onClick={ask} disabled={pending} className="w-full">
        {pending ? '提交中…' : '提交审核结果'}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone={action === 'rejected' ? 'danger' : 'default'}
        title={action === 'approved' ? '采纳反馈并发布活动？' : '退回反馈给团长？'}
        description={
          action === 'approved'
            ? '反馈采纳后，活动主题、总结与现场照片会发布到公开站，任何人都能看到；同时会推到报销环节等待核定。'
            : '反馈退回团长修改；团长改完重新提交后，再来审核。'
        }
        confirmLabel={action === 'approved' ? '确认采纳并发布' : '确认退回'}
        pending={pending}
        onConfirm={doReview}
      />
    </div>
  )
}
