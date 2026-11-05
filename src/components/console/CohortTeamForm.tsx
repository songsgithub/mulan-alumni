'use client'

import { InlineFieldList, InlineFieldRow } from '@/components/console/InlineFields'

interface TeamValues {
  viceLeader?: string | null
  resourceLiaison?: string | null
  materials?: string | null
  media?: string | null
}

const ROLES: { key: keyof TeamValues; label: string }[] = [
  { key: 'viceLeader', label: '副团长' },
  { key: 'resourceLiaison', label: '资源对接员' },
  { key: 'materials', label: '材料整理员' },
  { key: 'media', label: '拍摄宣传员' },
]

/**
 * 骨干成员（**只读展示**）。
 *
 * 2026-11-01 第三十五轮起，骨干成员的编辑入口搬到了页头的
 * 「编辑资料」面板（`CohortProfileEditor`）——主页图、地域、骨干成员一起改、一次存。
 * 所以这个组件不再自带编辑态，只负责把四个名字摆出来。
 *
 * 名字会出现在公开站互助团主页的「骨干成员」里。
 */
export function CohortTeamForm({ values }: { values: TeamValues }) {
  return (
    <div>
      <h2 className="section-title">骨干成员</h2>
      <InlineFieldList className="mt-2">
        {ROLES.map((role) => (
          <InlineFieldRow key={role.key} label={role.label}>
            {values[role.key] || '—'}
          </InlineFieldRow>
        ))}
      </InlineFieldList>
    </div>
  )
}
