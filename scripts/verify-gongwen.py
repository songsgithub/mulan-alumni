#!/usr/bin/env python3
"""
活动材料 PDF 的公文规范核验（GB/T 9704-2012）。

用法：python3 scripts/verify-gongwen.py <pdf路径>

核验的是 **PDF 本身**：
  ① 页面尺寸 A4 = 210mm × 297mm
  ② 版心宽 176mm（页边距 上15 下15 左17 右17；左右为表格留宽，上下第三十八轮之五收紧）
  ③ 嵌入字体是真字体（Type0），没有 Type3 位图兜底
  ④ 字号层级：文件标题 22pt / 正文 16pt / 表格 14pt
  ⑤ 字体族：Noto Serif SC（与网站正文同一款），标题层级用真 Bold 字重
  ⑥ 正文行距接近规范的固定值 28.9pt
  ⑦ 页码格式「— N —」
  ⑧ 上白边 15mm（第三十八轮之五起：上下白边由公文的 37/35mm 收紧到 15/15mm）

⚠️ ③ 是最要紧的一项：字体加载失败时 Chromium **不报错**，
   只是静默换用兜底字体，中文在 PDF 里落成 Type3 位图路径
   （文本不可选、放大发虚）。只看 CSS 声明是验不出来的，只能验 PDF。

输出末尾打印 FAILED=<数量>，供上层脚本汇总。
"""
import sys

import pymupdf

PT2MM = 25.4 / 72.0

failures = 0


def check(ok: bool, label: str, detail: str = "") -> None:
    global failures
    if ok:
        print(f"  ✓ {label}")
    else:
        failures += 1
        print(f"  ✗ {label}" + (f" — {detail}" if detail else ""))


def main(path: str) -> None:
    doc = pymupdf.open(path)
    page = doc[0]

    # ① 页面尺寸
    w_mm = page.rect.width * PT2MM
    h_mm = page.rect.height * PT2MM
    check(abs(w_mm - 210) < 1 and abs(h_mm - 297) < 1, f"① 页面尺寸 A4（{w_mm:.1f}×{h_mm:.1f}mm）")

    # ② 版心宽度：正文块的左右边界
    blocks = [b for b in page.get_text("blocks") if b[4].strip()]
    if blocks:
        x0 = min(b[0] for b in blocks)
        x1 = max(b[2] for b in blocks)
        # 页码在页脚区，单独排除掉
        body = [b for b in blocks if b[1] < page.rect.height * 0.85]
        if body:
            x0 = min(b[0] for b in body)
            x1 = max(b[2] for b in body)
        width_mm = (x1 - x0) * PT2MM
        check(abs(width_mm - 176) < 3, f"② 版心宽度 {width_mm:.1f}mm（目标 176mm）")
        left_mm = x0 * PT2MM
        check(abs(left_mm - 17) < 3, f"② 左白边 {left_mm:.1f}mm（目标 17mm）")
        # ⑧ 上白边：第三十八轮之五把上下白边由公文的 37/35mm 收紧到 15/15mm，
        #    这里把它固化成断言（否则以后改页边距没人会发现）。
        top_mm = min(b[1] for b in body) * PT2MM
        check(abs(top_mm - 15) < 6, f"⑧ 上白边 {top_mm:.1f}mm（目标 15mm）")
    else:
        check(False, "② 版心测量", "首页没有文字块")

    # ③ 嵌入字体类型
    fonts = []
    for p in doc:
        for f in p.get_fonts(full=True):
            fonts.append((f[3], f[2]))
    type3 = [n for n, t in fonts if t == "Type3"]
    check(not type3, f"③ 无 Type3 位图兜底字体（共 {len(fonts)} 个嵌入字体）", f"仍有 {len(type3)} 个")

    # ④⑤ 字号与字体族
    spans = []
    for p in doc:
        for b in p.get_text("dict")["blocks"]:
            if "lines" not in b:
                continue
            for line in b["lines"]:
                for s in line["spans"]:
                    if s["text"].strip():
                        spans.append((s["font"], round(s["size"], 1), s["text"]))
    sizes = sorted({s[1] for s in spans})
    families = sorted({s[0].split("+")[-1] for s in spans})
    print(f"    实际字号：{sizes}")
    print(f"    实际字体：{families}")

    check(22.0 in sizes, "④ 文件标题 22pt（二号）")
    check(16.0 in sizes, "④ 正文 16pt（三号）")
    check(14.0 in sizes, "④ 表格 14pt（四号）")

    def has_family(key: str) -> bool:
        return any(key.lower() in f.lower() for f in families)

    # 字体族：全站统一用 Noto Serif SC（网站正文的同一款字体）
    check(has_family("NotoSerifSC"), "⑤ 正文与标题用 Noto Serif SC（与网站一致）", f"实际：{families}")
    check(
        has_family("NotoSerifSC-Bold"),
        "⑤ 标题层级用真 Bold 字重（Noto Serif SC Bold）",
        "未嵌入 Bold：层级可能靠合成粗体，会落成位图",
    )

    # ⑥ 行距：正文行的基线间距
    # ⚠️ 必须只取**字号相同**的行来量：表格里 14pt 的行与 16pt 的正文行混在一起，
    #    算出来的间距是「行高差 + 行距」，会把 28.9pt 量成 70+pt。
    # ⚠️ 首页多是标题与表格，正文行少——所以要**跨所有页**收集，再取众数。
    ys = []
    for p in doc:
        for b in p.get_text("dict")["blocks"]:
            if "lines" not in b:
                continue
            for line in b["lines"]:
                line_spans = line["spans"]
                if not line_spans:
                    continue
                # 一行内字号一致才收（混排行不参与）
                sizes_in_line = {round(s["size"], 1) for s in line_spans}
                if sizes_in_line != {16.0}:
                    continue
                ys.append((p.number, round(line["bbox"][1], 1)))
    gaps = []
    by_page: dict[int, list[float]] = {}
    for num, y in ys:
        by_page.setdefault(num, []).append(y)
    for num, page_ys in by_page.items():
        page_ys = sorted(set(page_ys))
        for i in range(len(page_ys) - 1):
            gaps.append(round(page_ys[i + 1] - page_ys[i], 1))
    if gaps:
        # 取**中位数**：段落之间、标题前后、表格前后都会出现大间距，
        # 众数会被这些异常值带偏；中位数只反映「行与行之间」的典型间距。
        ordered = sorted(gaps)
        median = ordered[len(ordered) // 2]
        tight = [g for g in gaps if g < 40]
        check(
            abs(median - 28.9) < 3 or (tight and abs(min(tight) - 28.9) < 3),
            f"⑥ 正文行距 {median}pt（规范固定值 28.9pt）",
            f"全部间距：{sorted(set(gaps))[:8]}",
        )
    else:
        check(False, "⑥ 正文行距测量", "PDF 里没有 16pt 的正文行")

    # ⑦ 页码
    pnums = [s for s in spans if "—" in s[2] and any(ch.isdigit() for ch in s[2])]
    check(bool(pnums), "⑦ 页码存在", "没找到「— N —」形式的页码")
    if pnums:
        print(f"    页码样例：{pnums[0][2]!r}（{pnums[0][0]} {pnums[0][1]}pt）")

    print(f"    总页数：{doc.page_count}")
    print(f"\nFAILED={failures}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "tmp/gongwen.pdf")
