import { Check } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** 环节状态：done 已完成 / active 进行中（待处理）/ pending 还没到 / stop 被驳回、需补充 */
export type StatusTone = 'done' | 'active' | 'pending' | 'stop'

const VARIANT = {
  done: 'success',
  active: 'brand',
  pending: 'muted',
  stop: 'danger',
} as const

/**
 * 全站统一的状态徽标：颜色只表达状态（绿 = 完成、紫 = 进行中、灰 = 未开始、红 = 驳回），
 * 已完成的再带一个打勾——不用读字也知道走到哪了，色弱的人也分得清。
 */
export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string
  tone: StatusTone
  className?: string
}) {
  return (
    <Badge variant={VARIANT[tone]} className={cn('py-0.5 font-medium', className)}>
      {tone === 'done' ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
      {status}
    </Badge>
  )
}
