/**
 * 隐藏 Payload 后台的登出按钮。
 *
 * 挂在前台 `admin.components.logout.Button`：Payload 渲染它时会用这个组件
 * 替换默认的 Logout 按钮（它有 Fallback），返回 null 即不显示。
 *
 * 后台是给运维长期开着的工具，登出按钮在这里没有意义（会话也不跨域共享）。
 */
export function HideLogoutButton(_props: any) {
  return null
}

export default HideLogoutButton
