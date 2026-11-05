/**
 * 「跳到主要内容」（WCAG 2.4.1）：平时看不见，键盘按 Tab 第一下出现在左上角。
 * 键盘用户不用每一页都先 Tab 过整条导航。
 *
 * 公开站与工作台共用；目标是页面里的 `<main id="main" tabIndex={-1}>`。
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-fg focus:px-5 focus:text-small focus:font-medium focus:text-inverse-fg focus:shadow-elegant"
    >
      跳到主要内容
    </a>
  )
}
