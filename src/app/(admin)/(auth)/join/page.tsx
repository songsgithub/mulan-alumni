import { maskEmail } from '@/lib/format'
import { INVITE_INVALID_MESSAGE, lookupInvitation } from '@/lib/invitation'
import { JoinForm } from './JoinForm'

export const dynamic = 'force-dynamic'

/**
 * 通过**邀请链接**注册（见 docs/设计规范.md §4.6）。
 *
 * - `create-cohort`：注册即成为团长，互助团按「类别互助团」命名建成
 * - `transfer-lead`：注册即接管指定互助团的团长
 *
 * 链接在**服务端**查：首屏渲染出来就是最终状态——
 * 链接没了就只显示一句话，不会先闪一下表单再变成失效。
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = '' } = await searchParams
  const result = await lookupInvitation(token)

  // 链接没了就是没了：只说一句话，别的都不说
  if (!result.ok) {
    return (
      <div className="container-page py-24">
        <p className="text-center text-lead text-muted">{INVITE_INVALID_MESSAGE}</p>
      </div>
    )
  }

  // 完整的受邀邮箱不进客户端（会写进页面 HTML）；表单只用得到打码后的提示
  const info = { ...result.data, email: result.data.email ? maskEmail(result.data.email) : null }
  return <JoinForm info={info} token={token} now={Date.now()} />
}
