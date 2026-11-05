import Link from 'next/link'

import { EmptyState } from '@/components/console/EmptyState'
import { Button } from '@/components/ui/button'

/**
 * 工作台域的 404。
 *
 * **不能落到全局那个**（`src/app/not-found.tsx`）——那带的是公众站的页头页尾，
 * 在工作台里点进一个已删除的活动，导航会整个换成公众站的，人就找不到北了。
 * 放在这个路由组里，工作台的顶栏由 layout 渲染，导航一直在。
 */
export default function WorkspaceNotFound() {
  return (
    <EmptyState
      className="py-16"
      title="这个页面不存在"
      hint="活动可能已经被删除，或者链接不对。"
      actions={
        <>
          <Button render={<Link href="/" />}>回到活动列表</Button>
          <Button variant="outline" render={<Link href="/circles" />}>互助团网络</Button>
        </>
      }
    />
  )
}
