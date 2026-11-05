'use client'


import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/console/EmptyState'
import { ResourceRowActions } from '@/components/console/ResourceRowActions'
import { Pager } from '@/components/console/Pager'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ListToolbar } from '@/components/console/kit'
import { LinkTabs } from '@/components/console/LinkTabs'
import { formatDate, formatFileSize } from '@/lib/format'
import { RESOURCE_CATEGORY_LABEL, RESOURCE_TYPE_LABEL } from '@/lib/labels'
import { resourceHref, type ResourceTypeFilter } from '@/lib/resource-filter'

export interface ResourceRow {
  id: number | string
  slug?: string | null
  title: string
  summary?: string | null
  category?: string | null
  /** 文件形态：doc 文档 / video 视频 */
  type?: string | null
  fileName?: string | null
  fileSize?: number | null
  fileKind?: string | null
  url?: string | null
  publishedAt?: string | null
}

const TYPE_OPTIONS: { value: ResourceTypeFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'doc', label: '文档' },
  { value: 'video', label: '视频' },
]

/**
 * 资源清单：**一张表**，按类型分页签（全部 / 文档 / 视频）。
 *
 * 表格比卡片更适合"管理"——标题、分类、类型、文件、大小、发布时间一行看完，
 * 不用点开才知道是什么。
 *
 * 类型分页签与页码**都写进 URL**（`?type=doc&page=2`）：表格是**服务端分页**，
 * 前端只拿到当前这一页，所以筛选条件必须在地址里跟着走。
 */
export function ResourceBrowser({
  rows,
  counts,
  activeType,
  page,
  totalPages,
  total,
  pageSize,
  publicHref,
}: {
  rows: ResourceRow[]
  /** 三种类型各有多少份（服务端算） */
  counts: Record<ResourceTypeFilter, number>
  /** 当前选中的类型（来自地址） */
  activeType: ResourceTypeFilter
  page: number
  totalPages: number
  total: number
  pageSize: number
  /** 公开站地址（标题链过去就是公开页） */
  publicHref: string
}) {
  return (
    <>
      <ListToolbar>
        <LinkTabs
          value={activeType}
          ariaLabel="资源类型"
          items={TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
            count: counts[option.value],
            href: resourceHref(option.value, 1),
          }))}
        />
      </ListToolbar>

      {rows.length ? (
        <div className="px-3">
          <Table className="resp-table">
            <TableHeader>
              <TableRow>
                {/* 标题列吃掉剩余宽度，右侧各列定宽靠右——
                    否则标题一短，右边就空出一大片（页面看着不平衡）。 */}
                <TableHead className="w-full">标题</TableHead>
                <TableHead className="w-[7rem]">分类</TableHead>
                <TableHead className="w-[5rem]">类型</TableHead>
                <TableHead className="w-[16rem]">文件</TableHead>
                <TableHead className="w-[6rem] text-right">大小</TableHead>
                <TableHead className="w-[9rem] text-right">发布时间</TableHead>
                <TableHead className="w-[7rem] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[34em] whitespace-normal" data-label="标题">
                    {row.slug ? (
                      <a
                        href={`${publicHref}/resources/${row.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold underline decoration-rule underline-offset-[5px] transition-colors hover:text-accent hover:decoration-accent"
                      >
                        {row.title}
                      </a>
                    ) : (
                      <span className="font-semibold">{row.title}</span>
                    )}
                    {row.summary ? (
                      <p className="mt-0.5 line-clamp-1 text-small text-muted">{row.summary}</p>
                    ) : null}
                  </TableCell>
                  <TableCell data-label="分类">{RESOURCE_CATEGORY_LABEL[row.category ?? ''] ?? '—'}</TableCell>
                  <TableCell data-label="类型">
                    <Badge variant="outline">{RESOURCE_TYPE_LABEL[row.type ?? ''] ?? row.type}</Badge>
                  </TableCell>
                  <TableCell className="text-small text-muted" data-label="文件">
                    {row.fileName ? (
                      <span title={row.fileKind ?? undefined}>{row.fileName}</span>
                    ) : row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        title={row.url}
                        className="font-medium text-accent"
                      >
                        外链
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted" data-label="大小">
                    {row.fileSize ? formatFileSize(row.fileSize) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted" data-label="发布时间">
                    {row.publishedAt ? formatDate(row.publishedAt) : '—'}
                  </TableCell>
                  {/* 改 / 删都在弹窗里：行内只留一个「编辑」入口 */}
                  <TableCell className="text-right" data-label="操作">
                    <ResourceRowActions
                      resource={{
                        id: row.id,
                        title: row.title,
                        summary: row.summary,
                        category: row.category,
                        type: row.type,
                        url: row.url,
                        fileName: row.fileName,
                        fileSize: row.fileSize,
                        fileKind: row.fileKind,
                        publishedAt: row.publishedAt,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          compact
          title={activeType === 'all' ? '还没有上传资源' : '这一类还没有资源'}
          hint="上传之后，公众站的资料库里立刻能看到，也能直接下载。"
        />
      )}

      <div className="px-6 pb-5">
        <Pager
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          hrefFor={(n) => resourceHref(activeType, n)}
        />
      </div>
    </>
  )
}
