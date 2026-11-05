import { createHash } from 'node:crypto'

/**
 * 不透明标识（URL 里的那一段）。
 *
 * 国际惯例：**展示名（name / title）与地址标识（slug / id）分离**——
 * 页面上看到的永远是中文人话，地址栏里是认不出来的随机串。
 *
 * 为什么要随机串（而不是 `policy-notes` 这种语义串）：
 * - 防枚举：语义串能被顺序爬（`/resources/policy-notes-2`…），随机串不行；
 * - 防泄漏：URL 会进浏览器历史、访问日志、Referer、截图、群转发，
 *   语义串等于对外广播"哪个城市有什么团"；
 * - 名称会变、标识不能变：名字改了语义 slug 就失效，链接已经被转发和收录；
 * - 免重名：人工起 slug 必然撞车，随机码自带唯一性检查。
 *
 * 代价：URL 不再自带关键词，搜索引擎的收录信号靠页面 title / meta（已保留中文语义）。
 */

/**
 * 小写字母 + 数字，去掉了容易看错的几个：
 * 0 / o、1 / l / i（以及大写 I 与小写 l）。
 */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** 默认长度：14 位（够长不可枚举，又短到能口头念出来） */
const CODE_LENGTH = 14

/** 生成一串随机字符 */
const randomCode = (length = CODE_LENGTH): string => {
  const out: string[] = []
  const buf = new Uint8Array(length * 2)
  // 拒绝采样：丢掉 >= 256 - (256 % 字符集长度) 的字节，避免取模偏差
  const limit = 256 - (256 % CODE_ALPHABET.length)
  while (out.length < length) {
    crypto.getRandomValues(buf)
    for (const byte of buf) {
      if (byte < limit) {
        out.push(CODE_ALPHABET[byte % CODE_ALPHABET.length])
        if (out.length === length) break
      }
    }
  }
  return out.join('')
}

/**
 * 生成一串**没被占用**的随机字符。
 *
 * slug 是唯一字段，撞了就换一个（`taken` 返回 true 表示已被占用）。
 */
export const uniqueCode = async (
  taken: (code: string) => Promise<boolean>,
  length = CODE_LENGTH,
): Promise<string> => {
  for (let i = 0; i < 20; i++) {
    const code = randomCode(length)
    if (!(await taken(code))) return code
  }
  throw new Error('无法生成唯一标识，请重试')
}

/**
 * 由**固定键**推出一串字符：同一个键永远得到同一串。
 *
 * 给演示数据用——种子脚本要能重复运行（同一个团不能每次都新建），
 * 但人看过去仍然只是一串认不出来的字符。
 *
 * ⚠️ 这里必须用 sha256，不能用「线性同余 + 取低位」那类写法：
 * 线性同余在模 2 的幂下低位的周期极短（取 % 32 时周期就是 32），
 * 结果是字符只有 32 种取值，第 33 个团必然撞码。
 */
export const deterministicCode = (seed: string, length = CODE_LENGTH): string => {
  const digest = createHash('sha256').update(seed).digest()
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[digest[i % digest.length] % CODE_ALPHABET.length]
  }
  return out
}
