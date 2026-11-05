#!/usr/bin/env python3
"""
公文 PDF 的分页质量分析（2026-11-02 第三十八轮）。

用法：python3 scripts/verify-pagination.py <pdf路径>

看的是**排版质量**，不是规范合规（那是 verify-gongwen.py 的事）。三项：

  ① 每页空白率：正文块占用的版心高度 vs 版心高（267mm）
     —— 一页里一张图占 90mm、下面留 130mm，就是「留白过多」。
  ② 文字断行：标签/单元格内容被拆成多行的位置
     —— 公文材料里「计划活动时间」断成「计划活动」+「时间」很扎眼。
  ③ 图片分布：每页几张图、图的尺寸与位置
     —— 2026-11-02 第三十八轮之五起，规则是「版心高固定分 2 份」：
        一页最多 2 张图、每张图不超过一个槽位、没顶到高度上限的图必须满宽。

输出末尾打印 FAILED=<数量>，供上层脚本汇总。
"""
import sys

import pymupdf

PT2MM = 25.4 / 72.0

# 版心（mm）：A4 210×297，页边距 上15 下15 左17 右17
# ⚠️ 上下白边是第三十八轮之五从公文的 37/35mm 收紧到 15/15mm 的（用户要求「上下边距也要调小」），
#    所以版心高由 225mm 变成 267mm——这里的常量必须跟着改，否则空白率会算错。
PAGE_W, PAGE_H = 210.0, 297.0
MARGIN_TOP, MARGIN_BOTTOM, MARGIN_L, MARGIN_R = 15.0, 15.0, 17.0, 17.0
BODY_W = PAGE_W - MARGIN_L - MARGIN_R   # 176mm
BODY_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM  # 267mm

# 图片槽位（2026-11-02 第四十轮）：
#   版心高 267mm ÷ 2 = 一个槽位 133.5mm；扣掉图注与间距后，
#   打印脚本给单图的高度上限是 **118mm**（留足余量，保证两张装得下一页）。
#   规则：**满宽 176mm + 等高 + 不裁剪**（用户明说「可以压缩高度变形」）。
SLOT_H = BODY_H / 2                  # 133.5mm：一个槽位（图 + 图注 + 间距）
IMG_MAX_H = 118.0                    # 118mm：单图高度上限（打印脚本的 SLOT_H_MM）
# ⚠️ 图片有 0.6pt 边框，画在图片**外侧**：PyMuPDF 量到的是图片内容框，
#    比脚本写进去的尺寸小两个边框（2×0.21mm）。
#    判「是否顶到高度上限」时必须把这点差值算进去，否则每张满高的图都会被误判成
#    「没顶到上限、却又不是满宽」。
BORDER_MM = 0.6 * PT2MM
IMG_MAX_H_PDF = IMG_MAX_H - 2 * BORDER_MM   # 117.6mm：PDF 里量到的满高值
FULL_W_PDF = BODY_W - 2 * BORDER_MM          # 175.6mm：PDF 里量到的满宽值

failures = 0
# 单页空白率超过这个比例就记一次问题（章节天然收尾的页由调用方判断）
BLANK_WARN = 0.35


def check(ok: bool, label: str, detail: str = "") -> None:
    global failures
    if ok:
        print(f"  ✓ {label}")
    else:
        failures += 1
        print(f"  ✗ {label}" + (f" — {detail}" if detail else ""))


def _cell_lines(page, table_row, col_index, cell_text):
    """按**几何位置**取出某个单元格里的视觉行。

    为什么不能直接用 PyMuPDF 的 cell 文本：它抽取时会把同一行内的
    字间距也写成换行（「横幅一份」→「横幅 份」+「一」），据此判断会全是假阳性。
    真正的换行是**不同 y 坐标**的文字行，所以这里按 y 分组。
    """
    cells = table_row.cells
    if col_index >= len(cells) or cells[col_index] is None:
        return []
    rect = cells[col_index]

    # 取落在该矩形内的文字行
    raw = page.get_text("dict", clip=rect)
    lines = []
    for b in raw.get("blocks", []):
        for line in b.get("lines", []):
            text = "".join(s["text"] for s in line.get("spans", [])).strip()
            if text:
                lines.append((round(line["bbox"][1], 1), text))
    if not lines:
        return []
    # 按 y 聚类：同一行内 y 差小于 6pt（约半个字高）算同一行
    lines.sort()
    merged = []
    for y, text in lines:
        if merged and abs(y - merged[-1][0]) < 6:
            merged[-1][1] += text
        else:
            merged.append([y, text])
    return [text for _, text in merged]


def main(path: str) -> None:
    doc = pymupdf.open(path)

    print("=== ① 每页空白率 ===")
    worst = []
    text_only_pages = []
    for p in doc:
        # 元组统一为 (类型, x0, y0, x1, y1, 文本)，坐标一律 pt
        items = []
        for b in p.get_text("blocks"):
            if b[4].strip():
                items.append(("text", b[0], b[1], b[2], b[3], b[4].strip()))
        for img in p.get_images(full=True):
            for r in p.get_image_rects(img[0]):
                items.append(("image", r.x0, r.y0, r.x1, r.y1, ""))
        # 去掉页脚页码（在版心之下），只用版心内的内容算占用
        body = [it for it in items if it[4] < p.rect.height - 40] or items
        if not body:
            print(f"  第{p.number+1}页: 空白")
            worst.append((1.0, p.number + 1, 0))
            text_only_pages.append(p.number + 1)
            continue
        top = min(it[2] for it in body)
        bottom = max(it[4] for it in body)
        used_mm = (bottom - top) * PT2MM
        blank_mm = BODY_H - used_mm
        ratio = max(0.0, blank_mm) / BODY_H
        n_img = sum(1 for it in body if it[0] == "image")
        print(
            f"  第{p.number+1}页: 用 {used_mm:6.1f}/{BODY_H:.0f}mm  空白 {blank_mm:6.1f}mm "
            f"({ratio*100:4.1f}%)  图{n_img}"
        )
        worst.append((ratio, p.number + 1, n_img))
        if n_img == 0:
            text_only_pages.append(p.number + 1)
    total_blank = sum(r * BODY_H for r, _, _ in worst)
    print(f"  总页数 {len(worst)}，总空白 {total_blank:.0f}mm")

    # 总页数：照片按「版心高固定分 2 份」排版后，一页能放两张，
    # 加上上下边距收紧（版心高 225 → 267mm），页数应该明显少于上一版。
    # 超过 12 页说明有内容被挤散开。
    check(len(worst) <= 12, f"① 总页数 {len(worst)}（≤12）")

    # 单页空白率：
    #   - 含图页：照片/票据独占一页时居中留白是正常的，但不应超过 60%
    #   - 纯文字页：内容收尾是正常的，但不应超过 75%（否则是排版被挤断）
    over_text = [(num, r) for r, num, n in worst if n == 0 and r > 0.75]
    over_img = [(num, r) for r, num, n in worst if n > 0 and r > 0.60]
    check(
        not over_text,
        "① 纯文字页空白率 ≤75%",
        "第 " + "、".join(f"{n}页({r*100:.0f}%)" for n, r in over_text),
    )
    check(
        not over_img,
        "① 含图页空白率 ≤60%",
        "第 " + "、".join(f"{n}页({r*100:.0f}%)" for n, r in over_img),
    )

    # ② 断行：用表格结构判断「单元格内容是否被拆成多行」
    #    靠文本长度猜会把「序号」「合计」这类正常短标签全误报。
    print("\n=== ② 表格单元格断行检查 ===")
    broken = []
    for p in doc:
        for t in p.find_tables().tables:
            extracted = t.extract()
            for ri, row in enumerate(t.rows):
                if ri >= len(extracted):
                    continue
                for ci, cell in enumerate(extracted[ri]):
                    if not cell:
                        continue
                    # ⚠️ 不能只看 cell 文本里的 "\n"：PyMuPDF 抽取时会把
                    # 同一行内的字间距也写成换行（「横幅一份」→ 「横幅 份」+「一」）。
                    # 判据必须是**几何**：同一单元格内不同 y 坐标的文字行。
                    lines = _cell_lines(p, row, ci, cell)
                    if len(lines) < 2:
                        continue
                    merged = "".join(ln.strip() for ln in lines)
                    # 只判「短内容被拆行」：短标签（≤8 字）被拆成两行很难看；
                    # 长段落按需换行是正常的。
                    if len(merged) <= 8:
                        broken.append((p.number + 1, merged, lines))
    if broken:
        for num, merged, lines in broken:
            print(f"  第{num}页  {merged!r}  ← 拆成 {len(lines)} 行：{lines}")
        print(f"  （共 {len(broken)} 处短内容被拆行）")
        check(False, "② 短内容不被拆行", f"{len(broken)} 处短标签/短文本被拆行")
    else:
        print("  未发现短内容被拆行")
        check(True, "② 短内容不被拆行")

    # ③ 图片分布
    print("\n=== ③ 图片分布 ===")
    imgs = []
    for p in doc:
        for img in p.get_images(full=True):
            for r in p.get_image_rects(img[0]):
                w = r.width * PT2MM
                h = r.height * PT2MM
                imgs.append((p.number + 1, w, h))
                print(
                    f"  第{p.number+1}页: {w:6.1f}×{h:6.1f}mm  "
                    f"y={r.y0*PT2MM:6.1f}mm  占版心高 {h/BODY_H*100:4.1f}%"
                )

    # 规则（2026-11-02 第四十轮，用户要求「一页两份等高度图片 + 都是宽屏的图片」）：
    #   - 每页最多 2 张图
    #   - 每张图不超过一个槽位的高度（118mm）
    #   - 每张图不超过版心宽
    #   - **每张图都是满宽**（宽屏）：宽 = 版心宽 − 边框
    #   - **同一页上的两张图等高**（高度差 ≤ 1mm）
    #   - 至少有一页真的放了两张图（证明这条规则落到了地上）
    per_page: dict[int, list] = {}
    for num, w, h in imgs:
        per_page.setdefault(num, []).append((w, h))

    over_count = [(n, len(v)) for n, v in per_page.items() if len(v) > 2]
    check(
        not over_count,
        "③ 每页图片 ≤2 张（版心高固定分 2 份）",
        "第 " + "、".join(f"{n}页({c}张)" for n, c in over_count),
    )

    too_tall = [(n, h) for n, w, h in imgs if h > IMG_MAX_H_PDF + 0.5]
    check(
        not too_tall,
        f"③ 每张图高度 ≤ 一个槽位（{IMG_MAX_H:.0f}mm）",
        "第 " + "、".join(f"{n}页({h:.1f}mm)" for n, h in too_tall),
    )

    too_wide = [(n, w) for n, w, h in imgs if w > BODY_W + 1]
    check(
        not too_wide,
        f"③ 图不超版心宽（{BODY_W:.0f}mm）",
        "第 " + "、".join(f"{n}页({w:.1f}mm)" for n, w in too_wide),
    )

    # 满宽（用户要「都是宽屏的图片」）：宽 = 版心宽 − 边框
    not_full = [(n, w, h) for n, w, h in imgs if w < FULL_W_PDF - 0.5]
    check(
        not not_full,
        f"③ 每张图都是满宽（{FULL_W_PDF:.1f}mm）",
        "第 " + "、".join(f"{n}页({w:.1f}×{h:.1f}mm)" for n, w, h in not_full),
    )

    # 等高（用户要「两份等高度图片」）：同一页上的两张图高度必须一致
    unequal = []
    for num, v in per_page.items():
        if len(v) == 2:
            diff = abs(v[0][1] - v[1][1])
            if diff > 1.0:
                unequal.append((num, v[0][1], v[1][1]))
    check(
        not unequal,
        "③ 同一页上的两张图等高",
        "第 " + "、".join(f"{n}页({a:.1f}mm vs {b:.1f}mm)" for n, a, b in unequal),
    )

    two_on_a_page = sorted(n for n, v in per_page.items() if len(v) == 2)
    check(
        bool(two_on_a_page),
        "③ 至少一页放了两张图",
        "没有任何一页放满两张" if not two_on_a_page else "",
    )
    if two_on_a_page:
        print(f"    两张同页的页码：第 {'、'.join(str(n) for n in two_on_a_page)} 页")

    print(f"\nFAILED={failures}")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "tmp/gongwen.pdf")
