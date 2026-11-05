'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2 } from 'lucide-react'

import { setCohortBudget, setDefaultBudget } from '@/app/(admin)/(workspace)/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * 「统一设置」年度预算（项目组）。
 *
 * 一改就作用于这一年度**所有没有单独设过额度**的互助团；
 * 哪个团要不一样，去表格里单独改那一个。
 */
export function DefaultBudgetDialog({
  year,
  defaultAmount,
  note,
}: {
  year: number
  defaultAmount: number
  note?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('year', String(year))
    setError(null)
    setDone(null)
    startTransition(async () => {
      const result = await setDefaultBudget(data)
      if (result.ok) {
        setDone(result.message ?? '已保存')
        router.refresh()
      } else {
        setError(result.message ?? '保存失败，请重试')
      }
    })
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Settings2 aria-hidden />
        统一设置
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{year} 年统一年度预算</DialogTitle>
            <DialogDescription>
              一次性设定这一年度所有互助团通用的预算额度。之后哪个团要不一样，
              在下面的表里单独改那一个——单独设过的团不受这里影响。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-label font-semibold text-fg">
                每个团的年度预算（元）
              </span>
              <Input
                name="amount"
                type="number"
                min={0}
                step={100}
                required
                defaultValue={defaultAmount || undefined}
                placeholder="例如：5000"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-label font-semibold text-fg">备注</span>
              <Textarea
                name="note"
                rows={2}
                defaultValue={note ?? ''}
                placeholder="例如：这一年的重点是返乡就业专项"
              />
            </label>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {done ? (
              <Alert>
                <AlertDescription>{done}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" disabled={pending}>
              {pending ? '保存中…' : '保存'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * 「单独设置」某个互助团的年度预算（项目组）。
 *
 * 这一条**覆盖**该年度的统一额度，只对这个团生效。
 */
export function CohortBudgetDialog({
  year,
  cohortId,
  cohortName,
  amount,
  note,
  defaultAmount,
}: {
  year: number
  cohortId: number | string
  cohortName: string
  amount: number
  note?: string | null
  /** 该年度的统一额度（用来提示"现在是跟着统一的"） */
  defaultAmount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('year', String(year))
    data.set('cohort', String(cohortId))
    setError(null)
    setDone(null)
    startTransition(async () => {
      const result = await setCohortBudget(data)
      if (result.ok) {
        setDone(result.message ?? '已保存')
        router.refresh()
      } else {
        setError(result.message ?? '保存失败，请重试')
      }
    })
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        单独设置
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{cohortName} · {year} 年预算</DialogTitle>
            <DialogDescription>
              这一条覆盖该年度的统一额度（现在统一额度是 {defaultAmount} 元），只对这个团生效。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-label font-semibold text-fg">
                这个团的年度预算（元）
              </span>
              <Input
                name="amount"
                type="number"
                min={0}
                step={100}
                required
                defaultValue={amount || undefined}
                placeholder="例如：8000"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-label font-semibold text-fg">备注</span>
              <Textarea
                name="note"
                rows={2}
                defaultValue={note ?? ''}
                placeholder="为什么给这个团单独设一个数（可选）"
              />
            </label>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {done ? (
              <Alert>
                <AlertDescription>{done}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" disabled={pending}>
              {pending ? '保存中…' : '保存'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
