#!/usr/bin/env node
/**
 * 检查「模板字符串内部的注释里出现反引号」这种坑。
 *
 * 为什么要有这个脚本（2026-11-02 第三十八轮）：
 * 本项目的 CSS（docCss）与打印脚本大量用模板字符串（反引号）包起来。
 * 一旦**模板字符串内部的注释**里写了反引号（比如 `width: 100%`），
 * 模板字符串会提前闭合，后面整段代码被当成普通 JS 解析——
 * 报错信息还很难看出真凶在注释里。本轮为改 PDF 版式，同一类错误踩了三次。
 *
 * 注意：普通注释（不在模板字符串里的）里的反引号是**完全合法**的，
 * 本脚本只管模板字符串内部的。
 *
 * 用法：node scripts/check-template-backticks.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOTS = ['src', 'scripts']
const EXT = new Set(['.ts', '.tsx', '.mjs', '.js'])

/**
 * 找出所有模板字符串的范围（起始与结束的反引号位置）。
 * 扫描时跳过普通字符串与注释（它们内部的反引号不算模板串界定符）。
 */
function templateRanges(src) {
  const ranges = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '"' || ch === "'") {
      const quote = ch
      i++
      while (i < src.length) {
        if (src[i] === '\\') i++
        else if (src[i] === quote) break
        i++
      }
      i++
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (ch === '`') {
      const start = i
      i++
      let depth = 0
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue }
        if (src[i] === '$' && src[i + 1] === '{') {
          // 进入插值：插值内部允许嵌套模板串，交给递归处理
          depth++
          i += 2
          while (i < src.length && depth > 0) {
            if (src[i] === '{') depth++
            else if (src[i] === '}') depth--
            else if (src[i] === '`') {
              // 插值里的嵌套模板串：粗略跳过（内部注释问题由 tsc 兜底）
              i++
              while (i < src.length && src[i] !== '`') {
                if (src[i] === '\\') i++
                i++
              }
            }
            i++
          }
          continue
        }
        if (src[i] === '`') {
          ranges.push([start, i])
          i++
          break
        }
        i++
      }
      continue
    }
    i++
  }
  return ranges
}

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      walk(full, out)
    } else if (EXT.has(extname(name))) {
      out.push(full)
    }
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(r))
const bad = []

for (const file of files) {
  const src = readFileSync(file, 'utf-8')
  const ranges = templateRanges(src)
  for (const [start, end] of ranges) {
    const body = src.slice(start + 1, end)
    // 模板串内部：找注释里的反引号
    const lines = body.split('\n')
    let offset = start + 1
    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      const isComment = trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')
      if (isComment && line.includes('`')) {
        bad.push({ file, line: src.slice(0, offset).split('\n').length, text: trimmed })
      }
      offset += line.length + 1
    })
  }
}

if (bad.length) {
  console.log(`✗ 发现 ${bad.length} 处「模板字符串内注释里的反引号」——模板字符串会提前闭合：\n`)
  for (const b of bad) {
    console.log(`  ${b.file}:${b.line}`)
    console.log(`    ${b.text.slice(0, 100)}`)
  }
  console.log('\n修法：模板字符串内的注释不要用反引号（写 width: 100% 而不是 `width: 100%`）。')
  process.exit(1)
}

console.log(`✓ 模板字符串反引号检查通过（扫了 ${files.length} 个文件）`)
