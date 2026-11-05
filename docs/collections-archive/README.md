# 已下线集合的归档

2026-11-05 清理：这两个集合**全仓零读写、库里 0 行**，却会自动生成 REST / GraphQL 端点，
属于「未使用的后端接口」，已从 `payload.config.ts` 注销并写迁移删表。

| 集合 | 用途 | 状态 |
| --- | --- | --- |
| `toolkits` | 互助团经验帖（经验沉淀机制） | 0 行 · 无任何代码读写 · 已删表 |
| `opportunities` | 合作机会（岗位 / 导师 / 资源 / 合作） | 0 行 · 无任何代码读写 · 已删表 |

**这两个是设计文档里规划中的功能**（`docs/系统设计.md` §数据字典），功能上线时要重建：
1. 把本目录下的 `Toolkits.ts.txt` / `Opportunities.ts.txt` 拷回 `src/collections/`（去掉 `.txt` 后缀）；
2. 在 `src/payload.config.ts` 的 `collections` 里重新注册；
3. `npm run migrate:create rebuild-toolkits-opportunities` 写重建迁移并执行；
4. `npm run generate:types`。

原始建表语句在 `src/migrations/20261030_175325_initial.ts` 里也还留着（可参考字段与索引）。

> 注：文件存成 `.ts.txt` 是因为 `tsconfig.json` 的 `include` 是 `**/*.ts`，
> 放在 `docs/` 下的 `.ts` 会被类型检查扫进来（里面的 `../access` 相对路径解析不了）。
