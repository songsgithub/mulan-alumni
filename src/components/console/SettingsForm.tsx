'use client'

import { useState, useTransition } from 'react'

import { updateActivityRules } from '@/app/(admin)/(workspace)/actions'
import { FormSelect } from '@/components/console/FormSelect'
import {
  InlineEditHeader,
  InlineFieldControl,
  InlineFieldList,
  InlineFieldRow,
} from '@/components/console/InlineFields'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'

export interface MemberOption {
  value: string
  label: string
}

interface Values {
  budgetMax: number
  participantsMin: number
  planReviewerId: number | null
  reimbursementReviewerId: number | null
}

/**
 * 活动设置（项目组）。默认只读，点「编辑」才出现控件；保存成功后回到只读。
 * 编辑态与查看态同一套行骨架（InlineFields），卡片高度不变。两位负责人可以是同一个人。
 */
export function SettingsForm(props: Values & { members: MemberOption[] }) {
  const { members } = props
  const [values, setValues] = useState<Values>({
    budgetMax: props.budgetMax,
    participantsMin: props.participantsMin,
    planReviewerId: props.planReviewerId,
    reimbursementReviewerId: props.reimbursementReviewerId,
  })
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const nameOf = (id: number | null) => members.find((m) => m.value === String(id))?.label ?? '未设置'

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await updateActivityRules(data)
      setResult({ ok: r.ok, text: r.message ?? (r.ok ? '已保存' : '保存失败') })
      if (r.ok) {
        setValues({
          budgetMax: Number(data.get('budgetMax') ?? 0),
          participantsMin: Number(data.get('participantsMin') ?? 0),
          planReviewerId: Number(data.get('planReviewer') ?? 0) || null,
          reimbursementReviewerId: Number(data.get('reimbursementReviewer') ?? 0) || null,
        })
        setEditing(false)
      }
    })
  }

  if (!editing) {
    return (
      <div>
        <InlineEditHeader
          title="活动规则"
          editing={false}
          pending={pending}
          onEdit={() => setEditing(true)}
          onCancel={() => setEditing(false)}
        />
        <InlineFieldList className="mt-2">
          <InlineFieldRow label="预算合计上限">
            {values.budgetMax} 元
          </InlineFieldRow>
          <InlineFieldRow label="预计参与人数下限">
            {values.participantsMin} 人
          </InlineFieldRow>
          <InlineFieldRow label="活动审核负责人">
            {nameOf(values.planReviewerId)}
          </InlineFieldRow>
          <InlineFieldRow label="报销审核负责人">
            {nameOf(values.reimbursementReviewerId)}
          </InlineFieldRow>
        </InlineFieldList>

        {result ? (
          <p
            className={`mt-3 text-small ${result.ok ? 'text-muted' : 'text-danger'}`}
            role="status"
          >
            {result.text}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <InlineEditHeader
        title="活动规则"
        editing
        pending={pending}
        onEdit={() => setEditing(true)}
        onCancel={() => {
          setResult(null)
          setEditing(false)
        }}
      />

      <InlineFieldList className="mt-2">
        <InlineFieldRow label="预算合计上限">
          <InlineFieldControl>
            <Input
              name="budgetMax"
              type="number"
              step="0.01"
              required
              defaultValue={values.budgetMax}
              aria-label="预算合计上限（元）"
              className="w-full text-right"
            />
          </InlineFieldControl>
        </InlineFieldRow>
        <InlineFieldRow label="预计参与人数下限">
          <InlineFieldControl>
            <Input
              name="participantsMin"
              type="number"
              step={1}
              required
              defaultValue={values.participantsMin}
              aria-label="预计参与人数下限（人）"
              className="w-full text-right"
            />
          </InlineFieldControl>
        </InlineFieldRow>
        <InlineFieldRow label="活动审核负责人">
          <InlineFieldControl>
            <FormSelect
              name="planReviewer"
              defaultValue={values.planReviewerId ? String(values.planReviewerId) : ''}
              options={members}
              placeholder="请选择项目组成员"
              required
              className="w-full"
            />
          </InlineFieldControl>
        </InlineFieldRow>
        <InlineFieldRow label="报销审核负责人">
          <InlineFieldControl>
            <FormSelect
              name="reimbursementReviewer"
              defaultValue={values.reimbursementReviewerId ? String(values.reimbursementReviewerId) : ''}
              options={members}
              placeholder="请选择项目组成员"
              // 2026-11-04：可以设为空——「不设置」是**真的一个选项**（不是 placeholder）。
              // 置空 = 暂不开展报销核定：反馈照样被采纳、照样发布到公开站，
              // 报销单照样生成并显示「已提交，待审核」，但不推送、不进待办、无人能审。
              clearable="不设置"
              required={false}
              className="w-full"
            />
          </InlineFieldControl>
        </InlineFieldRow>
      </InlineFieldList>

      {result && !result.ok ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{result.text}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  )
}
