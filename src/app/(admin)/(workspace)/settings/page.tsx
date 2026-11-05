import { redirect } from 'next/navigation'

import { EmptyState } from '@/components/console/EmptyState'
import { FORM_COLUMNS, SectionTitle } from '@/components/console/kit'
import { ExpenseCategoryEditor } from '@/components/console/ExpenseCategoryEditor'
import { SettingsForm, type MemberOption } from '@/components/console/SettingsForm'
import { PageHeader } from '@/components/console/PageHeader'
import { PageHelp } from '@/components/console/PageHelp'
import { Card } from '@/components/ui/card'
import { getActivityRules } from '@/lib/activity-rules'
import { isProjectTeam, requireUser } from '@/lib/auth'
import { formatDateTimeCN } from '@/lib/format'
import { getClient } from '@/lib/payload'

export const metadata = { title: '设置' }

/**
 * 活动设置（仅项目组）：预算上限、预计参与人数下限、两个审核环节的负责人。
 * 负责人只能从项目组成员中选；未被设为负责人的项目组成员只能查看与打印。
 *
 * 左边原来是一张重复「帮助」内容的规则说明卡，换成了**修改记录**：
 * 审核负责人决定谁能批钱，谁在什么时候换了人，要能查到。
 */
export default async function SettingsPage() {
  const user = await requireUser()
  if (!isProjectTeam(user)) redirect('/')

  const payload = await getClient()
  const rules = await getActivityRules(payload)
  const settings: any = await payload.findGlobal({ slug: 'activity-settings' as any, depth: 0, overrideAccess: true })
  const changeLog = (Array.isArray(settings?.changeLog) ? settings.changeLog : []).slice(-20).reverse()
  const members = (
    await payload.find({
      collection: 'users',
      where: { roles: { contains: 'projectTeam' } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
  ).docs as { id: number | string; name?: string | null; email: string }[]

  const options: MemberOption[] = members.map((m) => ({
    value: String(m.id),
    label: m.name || m.email,
  }))

  // 费用类别清单（2026-11-03 第五十一轮）：**只有一级**，从设置里读，读不到用内置兜底
  const categoryRows = rules.expenseCategories.map((cat) => ({
    category: cat.name,
  }))

  return (
    <div>
      <PageHeader
        title="设置"
        help={
          <PageHelp title="设置">
            <p>预算合计上限：一场活动的预算合计不能超过这个数，超了申请就提交不了。</p>
            <p>预计参与人数下限：活动方案里的预计参与人数至少要到这个数，才够提交。</p>
            <p>审核负责人：活动审核与报销审核各一位，只能从项目组成员里选，可以是同一个人；其他项目组成员只能查看与打印。</p>
            <p>
              费用类别：活动方案与反馈里的《经费预算明细表》《经费支出明细表》按这里的清单选。
              <strong className="font-medium text-fg">改了不影响已经提交的历史记录</strong>
              （历史记录里存的是当时的名称）。
            </p>
            <p>快照规则：每场活动建立时记下当时的规则；之后改设置，不影响已经存在的活动。</p>
            <p>一个团一整年能用多少，不在这里，在「经费」页。</p>
          </PageHelp>
        }
      />

      <div className={FORM_COLUMNS}>
        {/*
          左栏：活动规则 + 费用类别，上下紧挨着。
          ⚠️ 2026-11-04：以前这两张卡和右边的「修改记录」是**三个平级的兄弟**，
          费用类别排在第三位 → 被右栏那张很高的修改记录**顶到下面**，
          左栏中间空出一大片（活动规则卡结束到费用类别卡开始之间什么都没有）。
          现在把左栏包成一个容器，两张卡紧挨着，右栏多高都不影响左栏。
        */}
        <div className="min-w-0 space-y-6">
          <Card className="p-4 sm:p-6">
            <SettingsForm
              budgetMax={rules.budgetMax}
              participantsMin={rules.participantsMin}
              planReviewerId={rules.planReviewerId}
              reimbursementReviewerId={rules.reimbursementReviewerId}
              members={options}
            />
          </Card>

          {/* 费用类别：**跟「活动规则」同一栏、同样宽**（2026-11-02 第四十四轮）。
              第四十一轮曾把它拉成一整个窗口（左右两列），但这一页是「设置」，
              左边一栏读设置、右边一栏看记录，费用类别跟活动规则是同一类东西，
              摆在一起更好读。卡片自己的标题与「编辑」按钮由组件内部管
              （跟「活动规则」一个口径）。 */}
          <Card className="p-4 sm:p-6">
            <ExpenseCategoryEditor categories={categoryRows} />
          </Card>
        </div>

        <Card className="gap-0 p-4 sm:p-6">
          <SectionTitle>修改记录</SectionTitle>
          {changeLog.length ? (
            <ol className="mt-3 divide-y divide-rule">
              {changeLog.map((row: any, index: number) => (
                <li key={index} className="py-3">
                  <p className="text-small text-faint">
                    {formatDateTimeCN(row.at)} · {row.byName || '—'}
                  </p>
                  <p className="mt-1 text-body leading-relaxed text-fg">{row.summary}</p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState compact title="还没有修改记录" hint="在左边保存一次设置，这里就会记下改了什么、谁改的" />
          )}
        </Card>
      </div>
    </div>
  )
}
