import Link from 'next/link'

import { Sprig, Wrap, museButton } from '@/components/site/muse'
import { site } from '@/content/site'

/**
 * 404：中文、给出路，不出现登录入口。
 * 版式与公开站空状态（muse EmptyState）同一款：柔光面板 + 木兰花饰；文案在 site.notFound。
 */
export function NotFoundContent() {
  const t = site.notFound
  return (
    <Wrap className="pt-10 pb-16 sm:pt-14">
      <div className="glow-panel flex flex-col items-center rounded-[1.5rem] border border-line px-6 py-16 text-center shadow-card">
        <span
          className="flex size-24 items-center justify-center rounded-full bg-white text-magnolia shadow-card"
          aria-hidden
        >
          <Sprig className="size-12" />
        </span>
        <h1 className="mt-5 font-display text-[1.75rem] font-medium text-ink">{t.title}</h1>
        <p className="mt-2 max-w-sm text-[1.0625rem] leading-relaxed text-ink-muted">{t.lead}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={t.action.href} className={museButton('default', 'lg')}>
            {t.action.label}
          </Link>
          <Link href={t.secondary.href} className={museButton('secondary', 'lg')}>
            {t.secondary.label} →
          </Link>
        </div>
      </div>
    </Wrap>
  )
}
