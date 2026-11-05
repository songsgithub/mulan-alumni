import Link from 'next/link'

import { BrandMark } from '@/components/console/BrandMark'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { lookupPasswordReset } from '@/lib/password-reset'

import { ResetPasswordForm } from './ResetPasswordForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: '重置密码' }

/**
 * 团长忘记密码时用的页面（**凭项目组发来的一次性链接**）。
 *
 * 没有邮件也没有短信，所以自助重置做不了（谁都能填别人的邮箱要求重置，
 * 等于把账号送人）——这一页只在项目组发了链接之后才有意义。
 *
 * 链接状态**在服务端查**：首屏渲染出来就是最终状态，
 * 不会先闪一下表单再变成"链接已失效"。
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = '' } = await searchParams
  const { status, emailHint } = await lookupPasswordReset(token)

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] bg-bg lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-brand lg:flex lg:flex-col lg:justify-between lg:p-14">
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
          <p className="text-hero font-semibold tracking-tight">换个密码，继续</p>
          <p className="mt-5 text-hero-sub font-medium opacity-95">
            设好之后，用新密码回到工作台
          </p>
        </div>
        <p className="relative text-hero-sub font-medium opacity-90">DIGITAL MULAN</p>
      </aside>

      <main className="console-page flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[24rem]">
          <div className="flex items-center gap-2.5 lg:hidden">
            <BrandMark size={40} />
          </div>

          <Card className="mt-10 gap-0 p-6 shadow-card lg:mt-0 lg:p-8">
            <h1 className="font-display text-auth-title font-semibold tracking-[-0.02em]">
              重置密码
            </h1>

            {status === 'ok' ? (
              <>
                <p className="mt-2 text-body text-muted">
                  设一个只有你知道的新密码。这条链接用过一次就失效。
                </p>
                <div className="mt-8">
                  <ResetPasswordForm token={token} emailHint={emailHint} />
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-body text-muted">
                  {status === 'used'
                    ? '这条链接已经用过了。'
                    : status === 'expired'
                      ? '这条链接过期了。'
                      : '这条链接不存在。'}
                  请找项目组重新发一条。
                </p>
                <div className="mt-8">
                  <Button variant="outline" render={<Link href="/login" />}>
                    回到登录
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}
