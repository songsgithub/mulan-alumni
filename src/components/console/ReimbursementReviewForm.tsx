'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { reviewReimbursement } from '@/app/(admin)/(workspace)/actions'
import { ConfirmDialog } from '@/components/console/ConfirmDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { yuan } from '@/lib/format'
import { cn } from '@/lib/utils'

const QUICK_REASONS = [
  '活动照片不足 3 张或缺少合照',
  '签到表与参与人数对不上',
  '活动总结写得太简单',
  '费用超出标准，或与《经费支出明细表》不符',
  '凭证不清晰 / 与明细对不上',
]

/**
 * 报销审核（项目组）——**只审报销金额**。
 *
 * ⚠️ 2026-11-03 第五十一轮：反馈的审核拆出去了（见 `ReportReviewForm`），
 *    这里只管钱——按《经费支出明细表》核定金额。
 * - 通过：按申请金额核定；
 * - 不通过：意见必填（可点常用原因），报销单驳回，团长改完重新提交会生成新的报销单。
 * 提交前二次确认，说清楚会发生什么。
 */
export function ReimbursementReviewForm({
  reimbursementId,
  total,
}: {
  reimbursementId: string
  total?: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [action, setAction] = useState<'approved' | 'rejected'>('approved')
  const [comment, setComment] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const ask = () => {
    if (action === 'rejected' && !comment.trim()) {
      setError('不通过时，请写清需要团长修改什么')
      return
    }
    setError(null)
    setConfirmOpen(true)
  }

  const doReview = () => {
    startTransition(async () => {
      const data = new FormData()
      data.set('id', reimbursementId)
      data.set('action', action)
      data.set('comment', comment)
      const result = await reviewReimbursement(data)
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
      <div className="flex items-baseline justify-between rounded-control bg-surface px-4 py-3">
        <span className="text-small text-muted">申请报销</span>
        <span className="font-display text-title font-semibold tabular-nums">{yuan(total ?? 0)}</span>
      </div>

      <fieldset>
        <legend className="mb-2 block text-body font-semibold text-fg">审核结果</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'approved', label: '核定通过' },
              { value: 'rejected', label: '不通过' },
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
          placeholder={action === 'rejected' ? '写清需要团长修改什么（反馈材料 / 费用 / 凭证）' : '可写审核要点，留痕备查'}
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
        title={action === 'approved' ? '核定这笔报销？' : '驳回这笔报销？'}
        description={
          action === 'approved'
            ? `按 ${yuan(total ?? 0)} 核定这笔报销。活动的反馈与公开内容已经在上一环节采纳发布，不受这一步影响。`
            : '报销单驳回，团长改完报销明细后重新提交；活动反馈本身不受影响。'
        }
        confirmLabel={action === 'approved' ? '确认核定' : '确认驳回'}
        pending={pending}
        onConfirm={doReview}
      />
    </div>
  )
}
