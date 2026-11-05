'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * 把登录失败翻成能照着做的话：
 * 密码错 / 被锁定 / 已停用 / 太频繁，各说各的——否则被锁定的人会一直重试。
 */
const failureMessage = (status: number, message: string) => {
  if (status === 429) return '尝试次数太多，请几分钟后再试'
  if (/locked/i.test(message)) return '密码连续输错，账号已暂时锁定，请 10 分钟后再试'
  if (/停用/.test(message)) return message
  return '邮箱或密码不正确'
}

type Field = 'email' | 'password'

/**
 * 本地校验：用中文说清是哪一项（不用浏览器自带的气泡——英文系统上是英文，
 * 而且读屏不一定读得到）。出错的那个框标 aria-invalid，并用 aria-describedby 指向错误文字。
 */
const localProblem = (email: string, password: string): { field: Field; text: string } | null => {
  if (!email.trim()) return { field: 'email', text: '请填写邮箱' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { field: 'email', text: '邮箱格式不正确' }
  if (!password) return { field: 'password', text: '请填写密码' }
  return null
}

/** 工作台登录：邮箱 + 密码。没有注册入口，也没有找回密码（由项目组 / 运维重置）。 */
export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<Field | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) return
    const problem = localProblem(email, password)
    if (problem) {
      setInvalid(problem.field)
      setError(problem.text)
      document.getElementById(`login-${problem.field}`)?.focus()
      return
    }
    setInvalid(null)
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message = String(body?.errors?.[0]?.message ?? body?.message ?? '')
        setError(failureMessage(res.status, message))
        setLoading(false)
        return
      }
      // 成功后保持「登录中」直到跳转完成，避免重复点击
      window.location.assign('/')
    } catch {
      setError('网络不太稳定，请稍后再试')
      setLoading(false)
    }
  }

  const describedBy = (field: Field) => (invalid === field && error ? 'login-error' : undefined)

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <label className="block">
        <span className="mb-1.5 block text-label font-semibold text-fg">邮箱</span>
        <Input
          id="login-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (invalid === 'email') setInvalid(null)
          }}
          aria-invalid={invalid === 'email' || undefined}
          aria-describedby={describedBy('email')}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-label font-semibold text-fg">密码</span>
        <span className="relative block">
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (invalid === 'password') setInvalid(null)
            }}
            aria-invalid={invalid === 'password' || undefined}
            aria-describedby={describedBy('password')}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-control text-muted transition-colors hover:text-accent"
          >
            {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </span>
      </label>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription id="login-error">{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        {loading ? '登录中…' : '登录'}
      </Button>
    </form>
  )
}
