/**
 * Lexical 富文本状态构造器。
 *
 * Payload 的 lexical 编辑器在保存前会校验编辑器状态的结构，
 * 手写的 JSON 很容易缺字段（如 text 节点缺 `detail`/`mode`/`style`，
 * paragraph 缺 `textFormat`/`textStyle`，listitem 缺 `value` 且需包一层 paragraph）。
 * 这里统一按 Lexical 的标准序列化结构拼装，避免各处手写出错。
 */
import { buildEditorState } from '@payloadcms/richtext-lexical'

interface LexicalTextOptions {
  bold?: boolean
  italic?: boolean
}

/** 文本节点 */
export const text = (value: string, options: LexicalTextOptions = {}) => ({
  type: 'text',
  detail: 0,
  format: (options.bold ? 1 : 0) | (options.italic ? 2 : 0),
  mode: 'normal',
  style: '',
  text: value,
  version: 1,
})

/** 段落节点 */
export const paragraph = (children: ReturnType<typeof text>[]) => ({
  type: 'paragraph',
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  version: 1,
})

/** 标题节点 */
export const heading = (tag: 'h1' | 'h2' | 'h3', children: ReturnType<typeof text>[]) => ({
  type: 'heading',
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  tag,
  version: 1,
})

/** 无序列表节点 */
export const bulletList = (items: string[]) => ({
  type: 'list',
  children: items.map((item, index) => ({
    type: 'listitem',
    children: [paragraph([text(item)])],
    direction: 'ltr',
    format: '',
    indent: 0,
    value: index + 1,
    version: 1,
  })),
  direction: 'ltr',
  format: '',
  indent: 0,
  listType: 'bullet',
  start: 1,
  tag: 'ul',
  version: 1,
})

/** 组装成 Payload 可接受的编辑器状态 */
export const editorState = (children: unknown[]) =>
  buildEditorState({ nodes: children as never })
