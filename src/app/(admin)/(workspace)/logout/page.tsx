'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    // Payload 的登出端点是 POST /api/users/logout
    fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
      .catch(() => undefined)
      .finally(() => {
        router.push('/')
        router.refresh()
      })
  }, [router])

  return (
    <div className="py-16 text-center text-label text-muted">正在退出…</div>
  )
}
