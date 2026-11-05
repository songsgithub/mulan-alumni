/**
 * 种子脚本的运行环境补丁（**必须最先 import**）。
 *
 * Payload 在开发模式下初始化时会自动 push schema（`pushDevSchema`），
 * 而本地刚跑完 `payload migrate` 的数据库里索引已经存在，
 * 两者会撞车：`index learning_resources_slug_idx already exists`。
 *
 * 种子脚本只需要读写数据、不需要改结构，所以以 production 模式初始化 Payload，
 * 让它跳过 dev 的 schema push，直接使用迁移建好的表。
 */
// Next 的类型把 NODE_ENV 标成只读，这里走类型擦除写入
;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
// 标记「这是本地脚本」：payload.config.ts 的生产密钥检查据此放行（脚本不对外提供登录）
;(process.env as Record<string, string | undefined>).MULAN_LOCAL_SCRIPT = '1'
