import { RichText } from '@payloadcms/richtext-lexical/react'

/**
 * 正文渲染器：使用 @payloadcms/richtext-lexical 3.92 官方的 `RichText` 转换器。
 *
 * 说明：Payload 3.92 的 `@payloadcms/richtext-lexical/react` 不再导出旧版的
 * `ReactRenderer` / `ReactRendererContextProvider`，官方渲染入口是 `RichText`：
 * 它把 Lexical 的序列化状态直接转成 JSX，可安全地在 React Server Component 中使用，
 * 不需要把 Payload 配置打进客户端包。
 *
 * 排版由 `.prose-mulan` 统一控制（globals.css）。
 */
export function RichTextBlock({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object') return null

  return (
    <div className="prose-mulan">
      <RichText data={data as never} />
    </div>
  )
}
