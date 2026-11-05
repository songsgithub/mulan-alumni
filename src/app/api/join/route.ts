import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { formatPlace } from '@/lib/format'
import { z } from 'zod'

import config from '@payload-config'

import { COHORT_CATEGORY_LABEL } from '@/lib/labels'

/**
 * adcode（6 位）：建团时地域可以只填到省，市 / 区县留空时前端传的是空字符串，
 * 这里把空串一并收成 undefined，别把"没填"当成"填错了"。
 */
const adcode = z
  .union([z.literal(''), z.string().regex(/^\d{6}$/, '地域不正确')])
  .optional()
  .transform((value) => (value ? value : undefined))
const JoinSchema = z.object({
  token: z.string().min(4, '邀请链接不正确').max(64, '邀请链接不正确'),
  name: z.string().trim().min(1, '请填写姓名').max(32, '姓名太长了'),
  email: z.string().trim().toLowerCase().email('邮箱格式不正确').max(120, '邮箱太长了'),
  phone: z.string().trim().regex(/^1\d{10}$/, '手机号格式不正确'),
  // 上限防止超长密码拖慢哈希
  password: z
    .string()
    .min(8, '密码至少 8 位')
    .max(72, '密码最多 72 位')
    .regex(/[A-Za-z]/, '密码要同时包含字母和数字')
    .regex(/\d/, '密码要同时包含字母和数字'),
  /** 地域：省 / 市 / 区县（名字 + 6 位 adcode）；建团时只要省，市 / 区县可留空 */
  province: z.string().max(32).optional(),
  provinceCode: adcode,
  city: z.string().max(32).optional(),
  cityCode: adcode,
  district: z.string().max(32).optional(),
  districtCode: adcode,
  /** 项目类别：加油木兰（GO Mulan）/ AI豆计划（A-Idol）/ 民宿管家（Homestay Manager） */
  category: z.enum(['go-mulan', 'a-idol', 'homestay-manager']).optional(),
})

/**
 * 通过**邀请链接**注册（见 docs/设计规范.md §4.6）。
 *
 * 两种用途：
 * - `create-cohort`：填资料 → 互助团建成，注册人自动成为团长
 * - `transfer-lead`：填资料 → 直接接管指定互助团的团长（老团长的任期记录保留）
 *
 * 链接用过即失效。
 */
export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ message: '请求格式不正确' }, { status: 400 })
  }

  const parsed = JoinSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? '信息填写有误' },
      { status: 400 },
    )
  }

  const data = parsed.data
  const payload = await getPayload({ config })

  try {
    const links = await payload.find({
      collection: 'invitation-links',
      where: { token: { equals: data.token } },
      limit: 1,
      overrideAccess: true,
    })
    const link = links.docs[0]

    if (!link) {
      return NextResponse.json({ message: '邀请链接不存在，请向项目组确认' }, { status: 400 })
    }
    if (link.status === 'revoked') {
      return NextResponse.json({ message: '该邀请链接已被撤销' }, { status: 400 })
    }
    if (link.status === 'used') {
      return NextResponse.json({ message: '该邀请链接已使用，请直接登录' }, { status: 400 })
    }
    if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ message: '邀请链接已过期，请向项目组申请新的' }, { status: 400 })
    }
    if (link.status !== 'active') {
      return NextResponse.json({ message: '邀请链接不存在或已失效' }, { status: 400 })
    }
    if (link.email && String(link.email).toLowerCase() !== data.email) {
      return NextResponse.json(
        { message: '邮箱与邀请记录不一致，请使用受邀邮箱' },
        { status: 400 },
      )
    }

    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: data.email } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length) {
      return NextResponse.json({ message: '该邮箱已注册，请直接登录' }, { status: 400 })
    }

    const isCreatingCohort = link.purpose === 'create-cohort'

    if (isCreatingCohort) {
      // 地域可以只填到省：填到哪一级，团就落在哪一级（地图按省 / 市 / 区县逐级下钻）
      if (!data.province || !data.provinceCode) {
        return NextResponse.json({ message: '请填写所在省' }, { status: 400 })
      }
    } else if (!link.cohort) {
      return NextResponse.json({ message: '该邀请链接没有指定互助团，请联系项目组' }, { status: 400 })
    } else if ((link.cohort as any)?.status === 'closed') {
      // 已解散的团不能靠接管链接"复活"：恢复运行是项目组的决定
      return NextResponse.json({ message: '这个互助团已解散，链接不能使用，请联系项目组' }, { status: 400 })
    }

    // 项目类别：建团时是本人选的；团长转移时**跟着那个团**（表单里不问她）
    const cohortOfLink = link.cohort as any
    const category =
      isCreatingCohort
        ? (data.category ?? 'go-mulan')
        : ((cohortOfLink?.category as 'go-mulan' | 'a-idol' | 'homestay-manager') ??
          'go-mulan')

    const now = new Date().toISOString()

    // 先「占用」链接再建账号：只把仍是 active 的这一条改成 used。
    // 两个人同时用同一条链接提交时，只有先占到的那个能继续；后面任何一步失败都把链接还回去。
    const claimed = await payload.update({
      collection: 'invitation-links',
      where: { and: [{ id: { equals: link.id } }, { status: { equals: 'active' } }] },
      data: { status: 'used', usedAt: now } as never,
      overrideAccess: true,
    })
    if (!claimed.docs?.length) {
      return NextResponse.json({ message: '该邀请链接已使用，请直接登录' }, { status: 400 })
    }
    const releaseLink = () =>
      payload
        .update({
          collection: 'invitation-links',
          id: link.id,
          data: { status: 'active', usedAt: null } as never,
          overrideAccess: true,
        })
        .catch((err) => console.error('release invitation link failed', err))

    let user: any
    try {
      user = await payload.create({
      collection: 'users',
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        phone: data.phone,
        program: category,
        region: {
          province: data.province || null,
          provinceCode: data.provinceCode || null,
          city: data.city || null,
          cityCode: data.cityCode || null,
          district: data.district || null,
          districtCode: data.districtCode || null,
        },
        roles: ['cohortLead'],
        joinedAt: now,
      } as never,
      overrideAccess: true,
    })
    } catch (err) {
      await releaseLink()
      throw err
    }

    let cohortId: number | string | null = null

    try {
    if (isCreatingCohort) {
      // 团名就是团名（不带区县——所在地在页面上单独一行三级显示）；
      // 地址标识（网址里那一段）是不透明随机串，由集合钩子自动生成。
      const name = `${COHORT_CATEGORY_LABEL[category] ?? '互助'}互助团`
      const cohort = await payload.create({
        collection: 'cohorts',
        data: {
          name,
          region: formatPlace(data.province, data.city),
          category,
          location: {
            province: data.province,
            provinceCode: data.provinceCode,
            // 只填到省时，市 / 区县留空——团就落在省一级
            city: data.city || null,
            cityCode: data.cityCode || null,
            district: data.district || null,
            districtCode: data.districtCode || null,
          },
          leader: user.id,
          leaderTerms: [{ user: user.id, from: now, to: null }],
          status: 'active',
          isPublic: true,
          tags: [],
        } as never,
        overrideAccess: true,
      })
      cohortId = cohort.id
    } else {
      // 团长转移：老团长任期收口，新团长接管；老团长的信息保留在任期记录里
      const targetId =
        typeof link.cohort === 'object' && link.cohort ? link.cohort.id : (link.cohort as number | string)
      const current: any = await payload.findByID({
        collection: 'cohorts',
        id: targetId,
        depth: 1,
        overrideAccess: true,
      })

      const terms = (current?.leaderTerms ?? []).map((term: any) => ({
        user: typeof term.user === 'object' && term.user ? term.user.id : term.user,
        from: term.from,
        to: term.to ?? now,
      }))
      terms.push({ user: user.id, from: now, to: null })

      await payload.update({
        collection: 'cohorts',
        id: targetId,
        data: {
          leader: user.id,
          leaderTerms: terms,
          status: 'active',
        } as never,
        overrideAccess: true,
      })

      cohortId = targetId
    }
    } catch (err) {
      // 建团 / 接管失败：删掉刚建的账号、把链接还回去，不留半成品
      await payload.delete({ collection: 'users', id: user.id, overrideAccess: true }).catch(() => {})
      await releaseLink()
      throw err
    }

    await payload.update({
      collection: 'invitation-links',
      id: link.id,
      data: {
        status: 'used',
        usedBy: user.id,
        usedAt: now,
      } as never,
      overrideAccess: true,
    })

    // 成功后直接建立会话，省去"注册完还要再登录一次"
    const { token, exp } = await payload.login({
      collection: 'users',
      data: { email: data.email, password: data.password },
    })

    const response = NextResponse.json({
      ok: true,
      userId: user.id,
      createdCohort: isCreatingCohort,
      tookOver: !isCreatingCohort,
    })
    if (token) {
      response.cookies.set({
        name: `${payload.config.cookiePrefix}-token`,
        value: token,
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        expires: exp ? new Date(exp * 1000) : undefined,
      })
    }
    return response
  } catch (err) {
    console.error('join failed', err)
    return NextResponse.json({ message: '注册失败，请稍后再试或联系项目组' }, { status: 500 })
  }
}
