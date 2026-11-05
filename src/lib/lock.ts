/**
 * 进程内的互斥锁（按键排队）。
 *
 * 审批、核定、提交、凭链接改密码这类"先查状态、再改状态"的动作，
 * 两次并发请求（双击、两个人同时点）会都查到「待审核」然后各写一遍——
 * 重复的审核记录、重复发布两条公开成果。
 * Payload 的按条件更新是"先查再逐条改"，不是数据库层的原子操作，
 * 所以同一个对象的这类动作在这里排队执行，进锁后再查一次状态。
 *
 * ⚠️ 只在单进程内有效（本项目是单实例部署）；多实例时要换成数据库行锁或 Redis 锁。
 */
const tails = new Map<string, Promise<unknown>>()

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => current)
  tails.set(key, tail)
  try {
    await previous.catch(() => undefined)
    return await fn()
  } finally {
    release()
    if (tails.get(key) === tail) tails.delete(key)
  }
}
