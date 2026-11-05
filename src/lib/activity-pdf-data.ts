import fs from 'node:fs'
import path from 'node:path'

import { createCanvas } from '@napi-rs/canvas'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

import type { PdfData } from '@/components/pdf/ActivityHtml'
import { formatDateTimeCN } from '@/lib/format'
import { FORM_LABEL } from '@/lib/labels'
import { fileToDataUri } from '@/lib/pdf-assets'
import { planHistory, planVersions } from '@/lib/plan-versions'
import { reimbursementHistory } from '@/lib/reimbursement-versions'

/** PDF 票据第一页 → PNG（data URI），按文件大小 + mtime 缓存 */
const receiptPageCache = new Map<string, string>()
async function pdfFirstPageDataUri(filename: string): Promise<string | null> {
  if (!filename) return null
  const full = path.join(process.cwd(), 'finance-evidence', filename)
  try {
    if (!fs.existsSync(full)) return null
    const stat = fs.statSync(full)
    const key = `${filename}:${stat.size}:${stat.mtimeMs}`
    const cached = receiptPageCache.get(key)
    if (cached) return cached

    // 某些依赖给 Array.prototype 加了可枚举方法，pdf.js 会因此拒绝工作
    const randomDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'random')
    if (randomDescriptor?.enumerable) {
      Object.defineProperty(Array.prototype, 'random', { ...randomDescriptor, enumerable: false })
    }

    const data = new Uint8Array(fs.readFileSync(full))
    const doc = await pdfjs.getDocument({
      data,
      useWorkerFetch: false,
      standardFontDataUrl:
        path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/') + '/',
    }).promise
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    await page.render({
      canvasContext: canvas.getContext('2d') as any,
      viewport,
      canvas: canvas as any,
    }).promise
    await (doc as any).destroy?.()

    const png = await canvas.encode('png')
    const uri = `data:image/png;base64,${Buffer.from(png).toString('base64')}`
    receiptPageCache.set(key, uri)
    return uri
  } catch (error) {
    console.error('render pdf receipt failed', filename, error)
    return null
  }
}

/** 把活动 + 反馈 + 报销组装成文档数据（页面预览与 PDF 导出共用） */
/**
 * 打印模式（2026-11-01 第三十六轮）。
 *
 * - `full`（默认）**完整记录**：申请、每一次版本变更与审核记录、反馈、报销审核全过程。
 *   给项目组内部看档用。
 * - `final`**报销存档版**：不管中间过程，只呈现
 *   「最终提交的申请方案 + 活动审核通过 + 活动反馈 + 报销核定通过」，
 *   以及关键时间点（申请最后提交时间 / 最后审核时间 / 反馈提交时间）。
 *   给纸质报销材料归档用——归档材料要的是"最后这一版是什么、谁批的、什么时候批的"。
 */
export type PdfMode = 'full' | 'final'

export async function buildActivityPdfData(
  plan: any,
  report: any,
  reimbursement: any,
  mode: PdfMode = 'full',
): Promise<PdfData> {
  const photos = ((report?.photos ?? []) as any[])
    .map((photo: any) => ({
      src: fileToDataUri('media', photo?.filename) ?? '',
      alt: String(photo?.alt ?? ''),
    }))
    .filter((photo) => photo.src)

  const expenseItems = (report?.expenseItems ?? []) as any[]
  const expenseTotal = expenseItems.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

  const receipts: NonNullable<PdfData['receipts']> = []
  for (const row of expenseItems) {
    // 一笔支出可以附多个凭证（每张都写清是哪一笔的费用）
    const list = Array.isArray(row.receipt) ? row.receipt : row.receipt ? [row.receipt] : []
    for (const entry of list) {
      const receipt = typeof entry === 'object' && entry ? entry : null
      const mime = String(receipt?.mimeType ?? '')
      const filename = String(receipt?.filename ?? '')
      const isPdf = mime === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')
      const src = isPdf
        ? await pdfFirstPageDataUri(filename)
        : fileToDataUri('finance-evidence', filename)
      receipts.push({
        kind: src ? 'image' : 'pdf',
        src: src ?? undefined,
        name: filename,
        item: String(row.item ?? ''),
        note: String(receipt?.note ?? ''),
      })
    }
  }

  /**
   * 存档版（final）：只留最终结果。
   *
   * - 申请方案取**最后一版**的快照（versions 里 no 最大的那一版）；
   *   没有留档快照时退回当前内容（提交后内容已锁定，当前就是最后那版）。
   * - 活动审核只留**最后一次审核通过**；报销审核只留**最后一次核定通过**。
   * - 版本变更过程（history）不打印——那是中间过程，纸质归档不需要。
   */
  const allVersions = planVersions(plan)
  const lastVersion = allVersions.length ? allVersions[allVersions.length - 1] : null
  const lastApproved = ((plan?.reviews ?? []) as any[])
    .filter((row) => row?.action === 'approved')
    .slice(-1)[0]
  const reimburseApproved = ((reimbursement?.reviews ?? []) as any[])
    .filter((row) => row?.action === 'approved')
    .slice(-1)[0]
  const finalSnapshot = mode === 'final' ? lastVersion?.snapshot : null
  const finalBudgetItems =
    mode === 'final' && finalSnapshot ? finalSnapshot.budgetItems : (plan.budgetItems ?? [])

  return {
    /**
     * 活动编号（2026-11-01 第三十六轮）：用地址里的那段随机串。
     * 它唯一、稳定、对外可查——纸质材料归档时靠它对得上系统里的记录。
     */
    activityNo: String(plan.slug ?? ''),
    plan: {
      title: String(plan.title ?? ''),
      slug: String(plan.slug ?? ''),
      status: String(plan.status ?? ''),
      cohortName: String(plan.cohort?.name ?? ''),
      theme: String(plan.theme ?? ''),
      kind: String(plan.kind ?? ''),
      formLabel: FORM_LABEL[plan.form] ?? '',
      plannedAt: plan.plannedAt ?? undefined,
      location: String(plan.location ?? ''),
      participants: Number(plan.participants ?? 0),
      applicantName: String(plan.applicantName ?? ''),
      submittedAt:
        mode === 'final' && lastVersion?.submittedAt
          ? lastVersion.submittedAt
          : plan.submittedAt ?? undefined,
      budgetTotal: Number(finalSnapshot?.budgetTotal ?? plan.budgetTotal ?? 0),
      budgetItems: finalBudgetItems as any[],
      // 存档版不打版本变更过程
      history: mode === 'final' ? [] : planHistory(plan),
      /** 存档版：最后一次活动审核通过（时间 / 审核人 / 结论） */
      finalReview:
        mode === 'final' && lastApproved
          ? {
              at: String(lastApproved.at ?? ''),
              reviewerName: String(lastApproved.reviewerName ?? lastApproved.reviewer?.name ?? ''),
              comment: String(lastApproved.comment ?? ''),
            }
          : undefined,
    },
    report: report
      ? {
          theme: String(report.theme ?? ''),
          location: String(report.location ?? ''),
          actualAt: report.actualAt ?? undefined,
          actualStart: report.actualStart ?? undefined,
          actualEnd: report.actualEnd ?? undefined,
          summary: String(report.summary ?? ''),
          highlights: String(report.highlights ?? ''),
          /** 反馈提交时间（第三十六轮）：《活动反馈表》里要显示的那一行 */
          submittedAt: report.submittedAt ?? undefined,
          photos,
          expenseItems,
          expenseTotal,
          attendees: (report.attendees ?? []) as any[],
          status: String(report.status ?? ''),
        }
      : undefined,
    reimbursement: reimbursement
      ? {
          status: String(reimbursement.status ?? ''),
          total: Number(reimbursement.total ?? 0),
          approvedAmount: Number(reimbursement.approvedAmount ?? 0),
          reviews:
            mode === 'final'
              ? reimburseApproved
                ? [
                    {
                      reviewerName:
                        reimburseApproved.reviewerName || reimburseApproved.reviewer?.name || '',
                      action: reimburseApproved.action,
                      comment: reimburseApproved.comment,
                      at: reimburseApproved.at,
                    },
                  ]
                : []
              : ((reimbursement.reviews ?? []) as any[]).map((review) => ({
                  reviewerName: review.reviewerName || review.reviewer?.name || '',
                  action: review.action,
                  comment: review.comment,
                  at: review.at,
                })),
          // 存档版不打版本变更过程
          history: mode === 'final' ? [] : reimbursementHistory(reimbursement),
          /** 存档版：最后一次报销核定通过 */
          finalApproval:
            mode === 'final' && reimburseApproved
              ? {
                  at: String(reimburseApproved.at ?? ''),
                  reviewerName:
                    String(reimburseApproved.reviewerName ?? reimburseApproved.reviewer?.name ?? ''),
                  comment: String(reimburseApproved.comment ?? ''),
                }
              : undefined,
        }
      : undefined,
    receipts,
    generatedAt: formatDateTimeCN(new Date()),
  }
}
