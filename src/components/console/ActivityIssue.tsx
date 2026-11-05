'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * 活动详情页的**处理提示**：提交失败 / 成功，都放到右侧【处理】面板里说，
 * 不再把红色 Alert 塞在左边的申请表下面——
 * 左边是"要填的东西"，右边是"现在什么情况、下一步做什么"。
 *
 * 提示要说清**原因**（缺哪一项、哪一笔），不是只说一句"提交失败"。
 */
export type ActivityIssue = {
  /** 哪一块表单：活动申请 / 活动反馈 */
  scope: 'plan' | 'report'
  ok: boolean
  title: string
  /** 具体原因，一条一行 */
  lines: string[]
}

type ActivityIssueValue = {
  issue: ActivityIssue | null
  setIssue: (issue: ActivityIssue | null) => void
}

const ActivityIssueContext = createContext<ActivityIssueValue>({
  issue: null,
  setIssue: () => {},
})

export function ActivityIssueProvider({ children }: { children: ReactNode }) {
  const [issue, setIssue] = useState<ActivityIssue | null>(null)
  const value = useMemo(() => ({ issue, setIssue }), [issue])
  return <ActivityIssueContext.Provider value={value}>{children}</ActivityIssueContext.Provider>
}

/** 表单里用它把结果报到右侧面板 */
export function useActivityIssue(scope: ActivityIssue['scope']) {
  const { issue, setIssue } = useContext(ActivityIssueContext)
  return {
    issue: issue && issue.scope === scope ? issue : null,
    report: (next: { ok: boolean; title: string; lines?: string[] } | null) =>
      setIssue(next ? { scope, ok: next.ok, title: next.title, lines: next.lines ?? [] } : null),
  }
}

/** 右侧【处理】面板里的提示条 */
export function ActivityIssuePanel({ scope }: { scope: ActivityIssue['scope'] }) {
  const { issue } = useContext(ActivityIssueContext)
  if (!issue || issue.scope !== scope) return null
  return (
    <div
      role="status"
      className={cn(
        'mt-3 rounded-control border px-3 py-2',
        issue.ok ? 'border-success/40 bg-success-soft' : 'border-danger/40 bg-danger-soft',
      )}
    >
      <p className={cn('text-small font-medium', issue.ok ? 'text-success' : 'text-danger')}>
        {issue.title}
      </p>
      {issue.lines.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-small text-fg">
          {issue.lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
