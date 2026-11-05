import {
  Award,
  Compass,
  HeartHandshake,
  Sparkles,
  Sprout,
  Star,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { AboutFlow } from '@/components/site/AboutFlow'
import { Heading, PageIntro, Wrap } from '@/components/site/muse'
import { site } from '@/content/site'

export const metadata = { title: '关于数字木兰校友会' }

/** 三个关键词：聚力同行 / 彼此链接 / 持续成长 */
const KEYWORD_ICONS: LucideIcon[] = [Sprout, HeartHandshake, Sparkles]
/** 木兰姐妹可以收获什么：自主成长 / 情感连接 / 能力提升 */
const GAIN_ICONS: LucideIcon[] = [Sprout, HeartHandshake, Star]
/** 数字木兰项目组的支持：活动资金 / 匹配辅导员 / 激励机制 */
const SUPPORT_ICONS: LucideIcon[] = [Wallet, Compass, Award]

/**
 * 关于（公众站）。
 *
 * ⚠️ 页面文字**逐字取自** `docs/SOP/about&contactpages.docx` 的「关于 页面」，
 *    全部来自 `src/content/site.ts` 的 `site.about`（文案唯一来源）。
 *    这里只负责版式，不要在页面里另写文案。
 */
export default function AboutPage() {
  const { about } = site

  return (
    <Wrap className="pt-10 pb-12 sm:pt-14">
      {/* 页头：与资源页同一个格式 —— 第一行大标题，第二行副标题 */}
      <PageIntro title={about.title} subtitle={about.subtitle} subtitleAccent={about.subtitle} />

      {/* 关于数字木兰校友会 */}
      <section className="mt-8">
        <div className="tape rotate-[-0.3deg] rounded-[1.5rem] border border-primrose bg-primrose/60 p-5 shadow-paper sm:p-7">
          <p className="text-[1.0625rem] leading-loose text-ink/90">{about.lead}</p>
        </div>
      </section>

      {/* 聚力同行 / 彼此链接 / 持续成长 */}
      <section className="mt-14">
        <div className="grid gap-4 md:grid-cols-3">
          {about.keywords.map((item, i) => {
            const Icon = KEYWORD_ICONS[i] ?? Sprout
            return (
              <article
                key={item.title}
                className="rounded-[1.5rem] border border-line bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <span
                  className="flex size-11 items-center justify-center rounded-full bg-blush text-magnolia"
                  aria-hidden
                >
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-4 font-display text-[1.5rem] font-semibold text-ink">{item.title}</h2>
                <p className="mt-2 inline-block rounded-full bg-magnolia px-3 py-1 text-[0.9375rem] font-medium text-white">
                  {item.name}
                </p>
                <p className="mt-3 text-[1rem] leading-relaxed text-ink-muted">{item.body}</p>
              </article>
            )
          })}
        </div>
      </section>

      {/* 数字木兰校友会互助团 */}
      <section className="mt-16">
        <Heading size="md">{about.circle.title}</Heading>
        <div className="mt-5">
          <p className="text-[1.0625rem] leading-[1.9] text-ink-muted">{about.circle.body}</p>
        </div>
      </section>

      {/* 木兰姐妹可以收获什么？ */}
      <section className="mt-16">
        <Heading size="md">{about.gains.title}</Heading>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {about.gains.items.map((item, i) => {
            const Icon = GAIN_ICONS[i] ?? Sprout
            return (
              <article
                key={item.title}
                className="rounded-[1.5rem] border border-line bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <span
                  className="flex size-11 items-center justify-center rounded-full bg-blush text-magnolia"
                  aria-hidden
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-3 font-display text-[1.1875rem] font-semibold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-[1rem] leading-relaxed text-ink-muted">{item.body}</p>
              </article>
            )
          })}
        </div>
      </section>

      {/* 数字木兰项目组的支持？ */}
      <section className="mt-16">
        <Heading size="md">{about.support.title}</Heading>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {about.support.items.map((item, i) => {
            const Icon = SUPPORT_ICONS[i] ?? Wallet
            return (
              <li
                key={item.title}
                className="rounded-[1.5rem] border border-line bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <span
                  className="flex size-11 items-center justify-center rounded-full bg-blush text-magnolia"
                  aria-hidden
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-3 font-display text-[1.1875rem] font-semibold text-ink">{item.title}</h3>
                {item.body ? (
                  <p className="mt-1.5 text-[1rem] leading-relaxed text-ink-muted">{item.body}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      {/* 互助团落地路径 */}
      <section id="path" className="mt-16 scroll-mt-24">
        <Heading size="md">{about.path.title}</Heading>
        <div className="mt-6">
          <AboutFlow />
        </div>
      </section>
    </Wrap>
  )
}
