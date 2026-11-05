import { redirect } from 'next/navigation'

import { BrandMark } from '@/components/console/BrandMark'
import { LoginForm } from '@/components/console/LoginForm'
import { Card } from '@/components/ui/card'
import { site } from '@/content/site'
import { currentUser } from '@/lib/auth'

export const metadata = { title: '数字木兰校友会 登录' }

/**
 * 工作台登录页。
 *
 * 宽屏：左边品牌渐变面（标识同款紫 → 蓝），右边登录表单；
 * 窄屏：只留表单，品牌标识压缩成表单上方的一行。
 * 渐变上只放大字（对比度只够 AA 大字标准，见 globals.css 的 bg-brand 说明）。
 */
export default async function LoginPage() {
  // 已经登录 → 直接进工作台首页，不停在登录页
  const user = await currentUser()
  if (user) redirect('/')

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] bg-bg lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-brand lg:flex lg:flex-col lg:justify-between lg:p-14">
        {/* 柔光：让大面积渐变不显得平 */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 size-[28rem] rounded-full bg-white/15 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[30rem] rounded-full bg-brand-to/40 blur-3xl"
        />
        <div className="relative flex items-center gap-2.5">
          <BrandMark size={44} className="brightness-0 invert" />
        </div>
        <div className="relative max-w-[30rem]">
          <p className="text-hero font-semibold tracking-tight">一起把互助团办好</p>
          <p className="mt-5 text-hero-sub font-medium opacity-95">
            活动申请 · 审核 · 反馈 · 报销，一个平台走完
          </p>
        </div>
        <p className="relative text-hero-sub font-medium opacity-90">DIGITAL MULAN</p>
      </aside>

      <main className="console-page flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[24rem]">
          <div className="flex items-center gap-2.5 lg:hidden">
            <BrandMark size={40} />
          </div>
          {/* 表单也住在一张卡里：与工作台里其他页面同一套「白卡浮在柔光底上」的版式 */}
          <Card className="mt-10 gap-0 p-6 shadow-card lg:mt-0 lg:p-8">
            <h1 className="font-display text-auth-title font-semibold tracking-[-0.02em]">
              登录工作台
            </h1>
            <p className="mt-2 text-body text-muted">团长与项目组请用受邀邮箱登录</p>
            <div className="mt-8">
              <LoginForm />
            </div>
            <p className="mt-6 text-small text-muted">
              忘记密码？找项目组要一条重置链接，在这条链接上自己设新密码。
            </p>
          </Card>
          <p className="mt-12 text-small text-muted">
            © {new Date().getFullYear()} {site.footer.copyright}
          </p>
        </div>
      </main>
    </div>
  )
}
