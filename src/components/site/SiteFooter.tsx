import { ArrowUpRight } from 'lucide-react'

/** 公开站页脚：只留「更多 · 蚂蚁公益基金会」与版权行 */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line/80">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-2 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 xl:px-12">
        <p className="flex items-center gap-3 text-[1rem]">
          <span className="text-ink-muted">更多</span>
          <a
            href="https://www.antfoundation.org.cn/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1 font-medium text-ink underline decoration-magnolia/40 underline-offset-4 transition-colors hover:text-magnolia"
          >
            蚂蚁公益基金会
            <ArrowUpRight aria-hidden className="size-4" />
          </a>
        </p>
        <p className="text-[0.9375rem] text-ink-muted sm:pr-16">©{new Date().getFullYear()} 数字木兰校友会</p>
      </div>
    </footer>
  )
}
