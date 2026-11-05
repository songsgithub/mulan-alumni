import { RootDocument, rootMetadata } from '@/components/RootDocument'

export const metadata = rootMetadata

/** 工作台域的根布局（登录 / 注册与工作台各自再套自己的外壳） */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument>{children}</RootDocument>
}
