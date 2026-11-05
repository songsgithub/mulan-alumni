import { NextResponse } from 'next/server'

import { getClient } from '@/lib/payload'

/**
 * 公众站「联系我们」表单。
 *
 * 只做一件事：给每个项目组账号发一条站内通知，内容包含姓名、联系方式、机构、职位与参与意向。
 * 字段对应 `docs/SOP/about&contactpages.docx` 的「联系我们 页面」。
 */
export async function POST(request: Request) {
  let body: any = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式不正确' }, { status: 400 })
  }

  // 蜜罐字段：被填了就直接当作成功，不落通知
  if (String(body?.website ?? '').trim()) {
    return NextResponse.json({ ok: true })
  }

  const name = String(body?.name ?? '').trim()
  const contact = String(body?.contact ?? '').trim()
  const organization = String(body?.organization ?? '').trim()
  const position = String(body?.position ?? '').trim()
  // 「您希望如何参与」：旧版本用的是 message，这里两个名字都收
  const participation = String(body?.participation ?? body?.message ?? '').trim()

  if (!name || !contact || !organization || !position || !participation) {
    return NextResponse.json(
      { ok: false, message: '请把姓名、联系方式、所属机构、职位和参与意向填完' },
      { status: 400 },
    )
  }
  if (
    name.length > 40 ||
    organization.length > 80 ||
    position.length > 80 ||
    contact.length > 80 ||
    participation.length > 1000
  ) {
    return NextResponse.json({ ok: false, message: '填写内容过长' }, { status: 400 })
  }

  const payload = await getClient()
  const team = await payload.find({
    collection: 'users',
    where: { roles: { in: ['projectTeam'] } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const title = [
    '合作联系',
    name,
    organization,
    position,
    contact,
    participation.slice(0, 180),
  ]
    .filter(Boolean)
    .join('｜')

  try {
    for (const user of team.docs as any[]) {
      await payload.create({
        collection: 'notifications',
        data: { recipient: user.id, title, read: false },
        overrideAccess: true,
      })
    }
  } catch (error) {
    console.error('contact notification failed', error)
    return NextResponse.json({ ok: false, message: '发送失败，请稍后再试' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
