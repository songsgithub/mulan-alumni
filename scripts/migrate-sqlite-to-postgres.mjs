/**
 * 一次性搬库：SQLite（mulan_alumni.db）→ PostgreSQL（DATABASE_URI）。
 *
 * 前提：PostgreSQL 里已经 `npm run migrate` 建好表（空表）。
 * 做法：按 PostgreSQL 的表与列为准，从 SQLite 同名表同名列取数，按列类型转换后写入；
 *       写入期间关掉外键检查（session_replication_role = replica），写完把自增序列对齐到最大 id。
 * 用法：node --env-file=.env scripts/migrate-sqlite-to-postgres.mjs [sqlite文件]
 *
 * 只读 SQLite，不改它；PostgreSQL 里已有数据的表会被清空重灌（可重复执行）。
 */
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'

const file = process.argv[2] ?? 'mulan_alumni.db'
const lite = new DatabaseSync(file, { readOnly: true })
const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
await client.connect()

// 这些是 Payload 的运行时表（迁移记录、编辑锁、后台偏好），不搬
const SKIP = new Set(['payload_migrations', 'payload_locked_documents', 'payload_locked_documents_rels', 'payload_preferences', 'payload_preferences_rels', 'payload_kv'])

const liteTables = new Set(lite.prepare("select name from sqlite_master where type='table'").all().map((r) => r.name))
const { rows: pgTables } = await client.query(
  "select table_name from information_schema.tables where table_schema = current_schema() and table_type='BASE TABLE' order by table_name",
)

await client.query('BEGIN')
await client.query("SET session_replication_role = 'replica'")

const report = []
for (const { table_name: table } of pgTables) {
  if (SKIP.has(table)) continue
  if (!liteTables.has(table)) {
    report.push([table, 0, '（SQLite 里没有这张表，保持空表）'])
    continue
  }
  const { rows: cols } = await client.query(
    'select column_name, data_type, udt_name from information_schema.columns where table_schema = current_schema() and table_name = $1 order by ordinal_position',
    [table],
  )
  const liteCols = new Set(lite.prepare(`pragma table_info("${table}")`).all().map((c) => c.name))
  const shared = cols.filter((c) => liteCols.has(c.column_name))
  const missing = cols.filter((c) => !liteCols.has(c.column_name)).map((c) => c.column_name)

  await client.query(`DELETE FROM "${table}"`)
  const data = lite.prepare(`select ${shared.map((c) => `"${c.column_name}"`).join(', ')} from "${table}"`).all()

  const convert = (value, col) => {
    if (value === null || value === undefined) return null
    if (col.data_type === 'boolean') return value === 1 || value === true || value === '1' || value === 'true'
    if (col.data_type === 'jsonb' || col.data_type === 'json') {
      return typeof value === 'string' ? value : JSON.stringify(value)
    }
    if (col.data_type.startsWith('timestamp') && typeof value === 'number') return new Date(value).toISOString()
    return value
  }

  const names = shared.map((c) => `"${c.column_name}"`).join(', ')
  for (const row of data) {
    const values = shared.map((c) => convert(row[c.column_name], c))
    const params = values.map((_, i) => `$${i + 1}`).join(', ')
    await client.query(`INSERT INTO "${table}" (${names}) VALUES (${params})`, values)
  }
  report.push([table, data.length, missing.length ? `新列留空：${missing.join(', ')}` : ''])
}

// 自增序列对齐到最大 id（否则下一条新建会撞主键）
const { rows: seqs } = await client.query(`
  select c.table_name, c.column_name, pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) as seq
  from information_schema.columns c
  where c.table_schema = current_schema() and c.column_default like 'nextval%'`)
for (const { table_name, column_name, seq } of seqs) {
  if (!seq) continue
  await client.query(
    `select setval('${seq}', coalesce((select max("${column_name}") from "${table_name}"), 0) + 1, false)`,
  )
}

await client.query("SET session_replication_role = 'origin'")
await client.query('COMMIT')
await client.end()

for (const [table, count, note] of report) console.log(`${String(count).padStart(6)}  ${table}  ${note}`)
console.log('搬库完成')
