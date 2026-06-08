#!/usr/bin/env python3
"""
構造化OCR MD から「文字起こしだけ」の純テキストMDを書き出す。

構造化MD（part別 / slide別に A.テキスト情報 / B.視覚事実 を持つ形式）を読み、
各ブロックの A. セクションの本文だけを抜き出して、視覚事実・分析・画像参照を
落とした読みやすい文字起こしを生成する。LP用・PDFスライド用の両フォーマットに対応。

Usage:
  python3 extract-transcript.py <structured.md> [-o <transcript.md>]

出力を省略すると、入力名の "_structured" を "_transcript" に置換（無ければ末尾に付与）。
"""
import sys
import os
import re
import argparse

# ブロックの先頭行（LP: "## Part 03: Hero" / PDF: "Slide 12"）
BLOCK_RE = re.compile(r'^(##\s*Part\s+\d+.*|Slide\s+\d+.*)$', re.IGNORECASE)
# A. セクション開始（"A. テキスト情報" / "A. 文字情報" など）
A_RE = re.compile(r'^A[\.\s　]')
# 取り込み終了になるセクション（B.視覚事実 / C.DOM補完 など）
STOP_RE = re.compile(r'^[BC][\.\s　]')
# 画像参照行（"画像参照: ..." / "![...](...)"）
IMG_RE = re.compile(r'^\s*(画像参照[:：]|!\[)')
# 分析サマリー等、本文の外側になる見出し
SUMMARY_RE = re.compile(r'^#{1,3}\s*(LP分析サマリー|分析サマリー|サマリー)\b')
# ヘッダー区切り
HR_RE = re.compile(r'^-{3,}\s*$')


def extract(md_text: str) -> str:
    lines = md_text.splitlines()
    out = []
    capturing = False
    seen_summary = False
    header = None  # 直近のブロック見出し

    for raw in lines:
        line = raw.rstrip()

        if SUMMARY_RE.match(line):
            seen_summary = True
            capturing = False
            continue
        if seen_summary:
            continue  # サマリー以降は本文ではないので無視

        m = BLOCK_RE.match(line)
        if m:
            header = m.group(1).strip()
            capturing = False
            continue

        if A_RE.match(line):
            capturing = True
            # "A. テキスト情報" の見出し行自体は出力しない
            if header is not None:
                out.append('')
                out.append(f'## {header}' if not header.startswith('#') else header)
                header = None
            # 「A. テキスト情報なし」のように1行で完結するケース
            tail = re.sub(r'^A[\.\s　]+', '', line).strip()
            if tail and not tail.startswith('テキスト情報') and not tail.startswith('文字情報'):
                out.append(tail)
            continue

        if STOP_RE.match(line):
            capturing = False
            continue

        if capturing:
            if IMG_RE.match(line):
                continue
            out.append(line)

    # 余分な空行を圧縮
    text = '\n'.join(out)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    return text + '\n'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('structured_md')
    ap.add_argument('-o', '--output')
    args = ap.parse_args()

    src = args.structured_md
    if not os.path.exists(src):
        print(f'[Error] not found: {src}', file=sys.stderr)
        return 1

    with open(src, encoding='utf-8') as f:
        md = f.read()

    # 元MDのタイトル行（# ...）を引き継ぐ
    title = ''
    for ln in md.splitlines():
        if ln.startswith('# '):
            title = ln
            break

    body = extract(md)

    out_path = args.output
    if not out_path:
        if '_structured' in src:
            out_path = src.replace('_structured', '_transcript')
        else:
            base, ext = os.path.splitext(src)
            out_path = f'{base}_transcript{ext}'

    parts = []
    if title:
        parts.append(title)
        parts.append('')
        parts.append('（本文テキストのみ。レイアウト説明や分析は構造化MD側にあります）')
        parts.append('')
    parts.append(body)

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(parts))

    n = body.count('\n') + 1
    print(f'[OK] transcript -> {out_path}  ({n} lines)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
