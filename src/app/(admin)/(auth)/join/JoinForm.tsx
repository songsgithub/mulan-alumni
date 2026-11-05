'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { BrandMark } from '@/components/console/BrandMark'
import { RegionPicker, type RegionValue } from '@/components/console/RegionPicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatDateTime } from '@/lib/format'
import type { InviteInfo } from '@/lib/invitation'
import { COHORT_CATEGORIES, COHORT_CATEGORY_LABEL } from '@/lib/labels'

const EMPTY_REGION: RegionValue = {
  province: '',
  provinceCode: '',
  city: '',
  cityCode: '',
  district: '',
  districtCode: '',
}

/**
 * 邀请注册页的**表单部分**（客户端）。
 *
 * 链接在服务端已经查过了：有效才会渲染到这里，失效的话那边直接是一句话。
 * 剩下的只有倒计时需要客户端——剩余时间每秒钟走一格，归零即当场失效。
 */
export function JoinForm({
  info,
  token,
  now: initialNow,
}: {
  info: InviteInfo
  token: string
  /** 服务端渲染时刻：首屏与服务端一致，hydration 不会对不上 */
  now: number
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    category: 'go-mulan',
  })
  const [region, setRegion] = useState<RegionValue>(EMPTY_REGION)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(initialNow)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const creating = info.purpose === 'create-cohort'
  const expiresAt = info.expiresAt ? new Date(info.expiresAt).getTime() : null
  const remainMs = expiresAt === null ? null : Math.max(0, expiresAt - now)
  // 有效期一到，链接当场作废（页面自己跟着变）
  const expired = remainMs !== null && remainMs <= 0

  /** 与服务端同一套规则先在本地查一遍，省得填完点提交才被退回 */
  const localProblem = (): string | null => {
    if (!/^1\d{10}$/.test(form.phone.trim())) return '手机号格式不正确（11 位，1 开头）'
    if (form.password.length < 8) return '密码至少 8 位'
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) return '密码要同时包含字母和数字'
    // 建团时地域可以只填到省：填到哪一级，团就落在哪一级
    if (creating && !region.province) return '请选择所在省'
    return null
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    const problem = localProblem()
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...region, token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          res.status === 429
            ? '尝试次数太多，请几分钟后再试'
            : (data?.message ?? '注册失败，请检查信息是否填写完整'),
        )
        setLoading(false)
        return
      }
      // 注册成功：保持「提交中」直到跳转完成（会话 cookie 已下发，整页进入工作台）
      window.location.assign('/')
    } catch {
      setError('网络不太稳定，请稍后再试')
      setLoading(false)
    }
  }

  if (expired) {
    return (
      <div className="container-page py-24">
        <p className="text-center text-lead text-muted">链接不存在或已失效</p>
      </div>
    )
  }

  return (
    <div className="container-page py-16">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        {/* 左：这是什么、接下来会发生什么 */}
        <div className="max-w-xl">
          <div className="mb-8 flex items-center gap-2.5">
            <BrandMark size={40} />
          </div>
          <Badge variant="brand">{creating ? '创建互助团' : '团长转移'}</Badge>
          <h1 className="mt-4 font-display text-auth-title font-semibold tracking-[-0.01em]">
            {creating ? '把互助团建起来' : `接管${info.cohortName ? `「${info.cohortName}」` : '这个互助团'}`}
          </h1>
          <p className="mt-4 text-lead leading-9 text-muted">
            {creating
              ? '填完这几项，你就是新互助团的团长。先把第一次活动办起来，别的以后再说。'
              : '项目组把这个团的团长交给了你。填完你的资料，这个团就归你管了——老团长的任期记录会保留在团里。'}
          </p>

          {/* 有效期：截止时间 + 剩余时间（到时分秒，每秒走一格） */}
          {remainMs !== null && info.expiresAt ? (
            <p className="mt-4 text-label text-muted">
              有效期至 {formatDateTime(info.expiresAt)} · 剩余 {formatRemain(remainMs)}
            </p>
          ) : null}

          {/* 团长转移：把要接管的团摊开给对方看 */}
          {!creating && info.cohortName ? (
            <dl className="mt-8 rounded-card border bg-card p-6">
              <dt className="text-small font-semibold tracking-[0.06em] text-faint">
                你要接管的团
                {info.cohortCategory
                  ? ` · ${COHORT_CATEGORY_LABEL[info.cohortCategory] ?? info.cohortCategory}`
                  : ''}
              </dt>
              <dd className="mt-3 space-y-2.5">
                <p className="text-title font-semibold leading-tight">{info.cohortName}</p>
                {info.cohortPlace ? (
                  <p className="text-body text-muted">所在地域 · {info.cohortPlace}</p>
                ) : null}
              </dd>
            </dl>
          ) : null}

          <h2 className="mt-8 section-title">接下来会发生什么</h2>
          <ol className="mt-3 space-y-2.5">
            {[
              '填好下面的资料，注册一个账号',
              creating ? '互助团同时建成，你自动成为团长' : '这个团的团长换成你，老团长记录保留',
              '直接进入工作台，发起第一场活动',
            ].map((step, index) => (
              <li key={index} className="flex gap-3 text-body leading-8 text-muted">
                <span className="mt-1 grid size-6 shrink-0 place-content-center rounded-full bg-accent-soft text-small font-semibold text-accent">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* 右：表单 */}
        <form onSubmit={onSubmit}>
          <Card className="space-y-8 p-4 sm:p-6">
            <section>
              <h2 className="section-title">你的信息</h2>
              <div className="mt-4 space-y-4">
                <Field label="姓名" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    autoComplete="name"
                  />
                </Field>

                {/* 所在地与项目类别是"新团"的事——团长转移时不问 */}
                {creating ? (
                  <>
                    <Field label="所在地域" required hint="跨地域成立互助团可只选到省或市" group>
                      <RegionPicker value={region} onChange={setRegion} partial />
                    </Field>

                    <Field label="项目类别" required group>
                      {/* 单选组：读屏会读出「项目类别，单选，已选 xx」 */}
                      <div role="radiogroup" aria-label="项目类别" className="flex flex-wrap gap-2">
                        {COHORT_CATEGORIES.map((category) => {
                          const active = form.category === category.value
                          return (
                            <button
                              key={category.value}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setForm((prev) => ({ ...prev, category: category.value }))}
                              className={`inline-flex h-11 items-center rounded-full border px-5 text-label transition-colors ${
                                active
                                  ? 'border-accent bg-accent-soft text-accent'
                                  : 'border-rule bg-card text-muted hover:border-fg hover:text-fg'
                              }`}
                            >
                              {category.label}
                            </button>
                          )
                        })}
                      </div>
                    </Field>
                  </>
                ) : null}
              </div>
            </section>

            <section>
              <h2 className="section-title">联系方式</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="手机号" required>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    required
                    autoComplete="tel"
                  />
                </Field>
                <Field label="邮箱" required>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                    autoComplete="email"
                  />
                </Field>
              </div>
            </section>

            <section>
              <h2 className="section-title">账号</h2>
              <div className="mt-4 space-y-4">
                <Field label="设置密码" required hint="至少 8 位，含字母和数字">
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </Field>
                <p className="text-label leading-7 text-muted">注册完会自动登录，直接进工作台。</p>
              </div>
            </section>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {loading ? '提交中…' : creating ? '创建并成为团长' : '接管这个团'}
            </Button>
          </Card>
        </form>
      </div>
    </div>
  )
}

/** 剩余时长 → 「6 天 23 小时 45 分 12 秒」 */
function formatRemain(ms: number): string {
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return days > 0
    ? `${days} 天 ${pad(hours)} 小时 ${pad(minutes)} 分 ${pad(seconds)} 秒`
    : `${pad(hours)} 小时 ${pad(minutes)} 分 ${pad(seconds)} 秒`
}

function Field({
  label,
  required,
  hint,
  group,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  /** 里面不止一个控件（地域三级下拉 / 类别单选组）：不能用 <label> 包，改成带名字的分组 */
  group?: boolean
  children: React.ReactNode
}) {
  const caption = (
    <span className="mb-1.5 block text-label font-semibold text-fg">
      {label}
      {/* 星号只给眼睛看；读屏读「必填」 */}
      {required ? (
        <>
          <span aria-hidden className="ml-1 text-fg">
            *
          </span>
          <span className="sr-only">（必填）</span>
        </>
      ) : null}
      {hint ? <span className="ml-2.5 font-normal text-faint">{hint}</span> : null}
    </span>
  )
  if (group) {
    return (
      <div role="group" aria-label={label} className="block">
        {caption}
        {children}
      </div>
    )
  }
  return (
    <label className="block">
      {caption}
      {children}
    </label>
  )
}
