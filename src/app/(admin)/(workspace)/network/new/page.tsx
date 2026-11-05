import { notFound } from 'next/navigation'

import { isProjectTeam, requireUser } from '@/lib/auth'

import { InviteCohortForm } from '@/components/console/InviteCohortForm'
import { FORM_COLUMNS } from '@/components/console/kit'
import { PageHeader } from '@/components/console/PageHeader'
import { PageHelp } from '@/components/console/PageHelp'

export const metadata = { title: '邀请创建互助团' }

/**
 * 项目组：生成**邀请链接**创建互助团。
 * 对方打开链接填完资料，团就建好了，他自动成为团长。
 *
 * 说明全在「帮助」里（原来左边还有一张重复帮助内容的说明卡，已删）。
 */
export default async function InviteCohortPage() {
  const user = await requireUser()
  // 建团只由项目组发起：团长没有这个入口，直接访问地址也当不存在
  if (!isProjectTeam(user)) notFound()

  return (
    <div>
      <PageHeader
        title="邀请创建互助团"
        help={
          <PageHelp title="邀请创建互助团">
            <p>点一下生成一条链接，发给对方；对方填完资料，互助团就建好了，他自动成为团长。</p>
            <p>对方要填：姓名、所在地域、项目类别、手机号、邮箱与密码。地域可以只填到省，也可以填到市、区县；团名按「类别」自动生成。</p>
            <p>链接自生成起 7 天有效，对方注册成功立刻失效；同一时间只有一条有效链接，再生成一条旧的就作废。</p>
          </PageHelp>
        }
      />
      <div className={FORM_COLUMNS}>
        <InviteCohortForm purpose="create-cohort" />
      </div>
    </div>
  )
}
