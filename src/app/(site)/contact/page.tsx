import { Mail } from 'lucide-react'

import { ContactForm } from '@/components/site/ContactForm'
import { PageIntro, Wrap } from '@/components/site/muse'
import { site } from '@/content/site'

export const metadata = { title: '联系我们' }

/**
 * 联系我们（公众站）。
 *
 * ⚠️ 页面文字**逐字取自** `docs/SOP/about&contactpages.docx` 的「联系我们 页面」，
 *    全部来自 `src/content/site.ts` 的 `site.contact`（文案唯一来源）。
 *    这里只负责版式，不要在页面里另写文案。
 */
export default function ContactPage() {
  const { contact } = site

  return (
    <Wrap className="pt-10 pb-12 sm:pt-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start lg:gap-14">
        <div className="min-w-0">
          {/* 页头：与资源页同一个格式 —— 第一行大标题，第二行副标题 */}
          <PageIntro title={contact.title} subtitle={contact.subtitle} subtitleAccent={contact.subtitleAccent} />

          <p className="mt-6 text-[1.0625rem] leading-[1.9] text-ink-muted">{contact.lead}</p>

          {/* lead 之后的两段（2026-11-03 第四十九轮）：一段邀请语 + 一句口号 */}
          <p className="mt-4 text-[1.0625rem] leading-[1.9] text-ink-muted">{contact.leadExtra}</p>
          <p className="mt-4 font-display text-[1.375rem] leading-snug font-medium text-ink">{contact.slogan}</p>

          {/* 三种参与方式 */}
          <ul className="mt-8 divide-y divide-line border-t border-line">
            {contact.ways.map((way) => (
              <li key={way.title} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4">
                <h2 className="w-28 shrink-0 font-display text-[1.125rem] font-semibold text-ink">
                  {way.title}
                </h2>
                <p className="text-[1rem] leading-relaxed text-ink-muted">{way.body}</p>
              </li>
            ))}
          </ul>

          {/* 联系人：姓名 + 邮箱（2026-11-03 第四十九轮），不显示电话 */}
          <div className="mt-8 rounded-[1.5rem] border border-line bg-white p-5 shadow-card sm:p-6">
            <p className="text-[0.9375rem] text-ink-muted">{contact.person.label}</p>
            <p className="mt-1 font-display text-[1.375rem] font-semibold text-ink">
              {contact.person.name}
            </p>
            <p className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[1rem] text-ink-muted">
              <a
                href={`mailto:${contact.person.email}`}
                className="inline-flex min-h-11 items-center gap-2 transition-colors hover:text-magnolia"
              >
                <Mail aria-hidden className="size-4 shrink-0 text-magnolia/80" />
                {contact.person.email}
              </a>
            </p>
          </div>
        </div>

        {/* 留下您信息 */}
        <aside className="min-w-0 lg:sticky lg:top-24">
          <div className="rounded-[1.5rem] border border-line bg-white p-6 shadow-card sm:p-8">
            <h2 className="font-display text-[1.375rem] font-semibold text-ink">{contact.formTitle}</h2>
            <div className="mt-5">
              <ContactForm />
            </div>
          </div>
        </aside>
      </div>
    </Wrap>
  )
}
