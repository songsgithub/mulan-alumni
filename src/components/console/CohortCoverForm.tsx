'use client'

import Image from 'next/image'

/**
 * 互助团主页的大图（公开站团主页 banner 的同一张）——**只读展示**。
 *
 * 2026-11-01 第三十五轮起，换图入口搬到了页头的「编辑资料」面板
 * （`CohortProfileEditor`）：主页图、地域、骨干成员一起改、一次存。
 * 这里只负责把大图摆出来。
 *
 * 只做居中裁切，不提供取景调节。
 */
export function CohortCoverForm({
  name,
  src,
}: {
  cohortId: string
  name: string
  src?: string | null
  canEdit?: boolean
}) {
  return (
    <div className="relative h-40 w-full overflow-hidden bg-brand sm:h-44">
      {src ? (
        <Image src={src} alt={`${name} 主页大图`} fill className="object-cover" sizes="420px" />
      ) : null}
      {src ? (
        <div
          aria-hidden
          className="absolute inset-0 img-shade-soft"
        />
      ) : null}
    </div>
  )
}
