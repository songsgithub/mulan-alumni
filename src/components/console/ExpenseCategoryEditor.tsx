'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { updateExpenseCategories } from '@/app/(admin)/(workspace)/actions'
import { InlineEditHeader } from '@/components/console/InlineFields'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface CategoryRow {
  category: string
}

/**
 * 费用类别维护（项目组，在「设置」页）。
 *
 * 2026-11-01 第三十六轮：费用类别与明细项从代码常量下沉到这里——
 * 以前改一次类别要动代码、发版；现在项目组自己维护。
 *
 * 2026-11-02 第四十一轮：**改成左右两栏（主从式）**。
 * 2026-11-02 第四十三轮：**平时是查看态，点了「编辑」才可改**。
 *
 * 2026-11-03 第五十一轮：**只留一级类别，移除二级明细项**。
 * 二级明细项从来只是「可支持范围」的参考，而「查询可支持项」入口已删除，
 * 留着这一层只剩维护成本。所以这一块现在是**一列类别名**——
 * 不再有左右两栏，卡片宽度与旁边的「活动规则」一致。
 *
 * **为什么这样组织**：
 * - 平时是查看态（一列类别名 + 各自的明细数），点了「编辑」才变成输入框；
 * - 这一页是「设置」，不是「改设置」：一进来就摆一堆输入框，
 *   看的人分不清哪个是改过的、哪个能点。
 *
 * ⚠️ **改了不影响历史数据**：活动方案 / 反馈 / 报销单里存的是**名称快照**，
 * 所以改了类别名、甚至删了某个类别，
 * 已经提交的老记录**照样按当初的写法显示**。
 */
export function ExpenseCategoryEditor({
  categories,
}: {
  categories: CategoryRow[]
}) {
  const [rows, setRows] = useState<CategoryRow[]>(
    categories.length ? categories : [{ category: '' }],
  )
  // 平时是查看态：点了「编辑」才变成输入框
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const update = (index: number, patch: Partial<CategoryRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addRow = () => {
    setRows((prev) => [...prev, { category: '' }])
  }

  const removeRow = (index: number) => {
    if (rows.length === 1) return
    setRows(rows.filter((_, i) => i !== index))
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData()
    rows.forEach((row) => data.append('expenseCategory', row.category))

    startTransition(async () => {
      const result = await updateExpenseCategories(data)
      setMessage({
        ok: result.ok,
        text: result.ok ? '已保存' : result.message ?? '保存失败',
      })
      if (result.ok) {
        const saved = rows
          .map((row) => ({ category: row.category.trim() }))
          .filter((row) => row.category)
        setRows(saved.length ? saved : [{ category: '' }])
        // 存完回到查看态：这一页是「设置」，不是「改设置」
        setEditing(false)
      }
    })
  }

  /* ------------------------------------------------------- 查看态 */
  if (!editing) {
    return (
      <div>
        <InlineEditHeader
          title="费用类别"
          editing={false}
          pending={pending}
          onEdit={() => {
            setMessage(null)
            setEditing(true)
          }}
          onCancel={() => setEditing(false)}
        />
        <p className="mt-2 text-small text-muted">
          共 {rows.length} 个类别。填写活动方案与活动反馈时按这里选；改了不影响已经提交的历史记录。
        </p>

        {rows.length ? (
          <ul className="mt-4 space-y-1.5" role="list">
            {rows.map((row, index) => (
              <li
                key={index}
                className="rounded-control border border-rule bg-card px-3 py-2 text-body text-fg"
              >
                {row.category.trim() || '（未命名类别）'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-control border border-dashed border-rule px-3 py-4 text-small text-muted">
            还没有类别。点右上角「编辑」可以加。
          </p>
        )}

        {message ? (
          <p className={`mt-3 text-small ${message.ok ? 'text-muted' : 'text-danger'}`} role="status">
            {message.text}
          </p>
        ) : null}
      </div>
    )
  }

  /* ------------------------------------------------------- 编辑态 */
  return (
    <form onSubmit={onSubmit}>
      <InlineEditHeader
        title="费用类别"
        editing
        pending={pending}
        onEdit={() => setEditing(true)}
        onCancel={() => {
          setMessage(null)
          setEditing(false)
        }}
      />
      <p className="mt-2 mb-4 text-small text-muted">
        一行一个费用类别。改完点「保存」。
      </p>

      <ul className="space-y-1.5" role="list">
        {rows.map((row, index) => (
          <li key={index}>
            <div
              className={cn(
                'flex items-center gap-1 rounded-control border py-0.5 pr-0.5 pl-3 transition-colors',
                'border-rule bg-card',
              )}
            >
              <Input
                value={row.category}
                onChange={(event) => update(index, { category: event.target.value })}
                placeholder="费用类别，如：活动物料与耗材"
                aria-label={`第 ${index + 1} 个费用类别`}
                maxLength={40}
                className="min-h-11 min-w-0 flex-1"
              />
              {rows.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`删除类别：${row.category.trim() || `第 ${index + 1} 个`}`}
                  onClick={() => removeRow(index)}
                  className="shrink-0 text-muted hover:text-danger"
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" onClick={addRow} className="mt-3 w-full">
        <Plus aria-hidden />
        加一个类别
      </Button>

      {message && !message.ok ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  )
}
