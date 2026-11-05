import { FORM_COLUMNS } from '@/components/console/kit'
import { ProfileCard } from '@/components/console/ProfileForm'
import { PageHeader } from '@/components/console/PageHeader'
import { PageHelp } from '@/components/console/PageHelp'
import { requireUser } from '@/lib/auth'
import { getClient } from '@/lib/payload'
import { formatDate } from '@/lib/format'

export const metadata = { title: '个人信息' }

/**
 * 个人信息：默认只读，点「修改」才可编辑（入口在顶栏右上角——点自己的名字）。
 *
 * 团长在这页改的姓名 / 手机号 / 邮箱，互助团详情页的「团长」卡读的是同一条用户文档，自动跟着变。
 * 版式与设置页、邀请页同一套表单列（FORM_COLUMNS）；说明只在「帮助」里，不再另放一张说明卡。
 */
export default async function AccountPage() {
  const user = await requireUser()
  const payload = await getClient()
  // CurrentUser 只带 name / email，手机号与注册时间要从库里取完整的文档
  const me = await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
  })

  return (
    <div>
      <PageHeader
        title="个人信息"
        help={
          <PageHelp title="个人信息">
            <p>邮箱就是登录账号：改完请记牢，下次要用新邮箱登录。</p>
            <p>姓名与电话会显示在你带的互助团页面的「团长」一栏。</p>
            <p>手机号与邮箱只有本人与项目组看得到。</p>
          </PageHelp>
        }
      />
      <div className={FORM_COLUMNS}>
        <ProfileCard
          name={String(me.name ?? '')}
          phone={String(me.phone ?? '')}
          email={String(me.email ?? '')}
          joinedAt={formatDate(me.joinedAt ?? me.createdAt)}
        />
      </div>
    </div>
  )
}
