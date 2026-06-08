#!/usr/bin/env python3
"""
PDFの各ページをPNG画像に変換する（Vision OCRの入力用）。

Usage:
  python3 pdf-to-images.py <pdf_path> [--output <dir>] [--scale 0.75]

- 出力先を省略すると ./output/<pdf名>/images/ に保存。
- 既存のPNGはスキップする（再実行で続きから）。
- scale 0.75 ≒ 1080px幅。小さい文字が多い資料は 1.0 まで上げる（1.5以上は2000px制限でOCRが失敗しやすい）。
- 標準出力に総ページ数と推奨バッチ数（20pにつき1）を表示する。

依存: PyMuPDF（`pip install pymupdf`）
"""
import sys
import os
import math
import argparse

try:
    import fitz  # PyMuPDF
except ImportError:
    print('[Error] PyMuPDF が必要です: pip install pymupdf', file=sys.stderr)
    sys.exit(1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf_path')
    ap.add_argument('--output')
    ap.add_argument('--scale', type=float, default=0.75)
    args = ap.parse_args()

    pdf_path = args.pdf_path
    if not os.path.exists(pdf_path):
        print(f'[Error] not found: {pdf_path}', file=sys.stderr)
        return 1

    stem = os.path.splitext(os.path.basename(pdf_path))[0]
    out_dir = args.output or os.path.join('./output', stem)
    images_dir = os.path.join(out_dir, 'images')
    os.makedirs(images_dir, exist_ok=True)

    doc = fitz.open(pdf_path)
    total = len(doc)
    mat = fitz.Matrix(args.scale, args.scale)

    made = 0
    for i in range(total):
        path = os.path.join(images_dir, f'page_{i + 1:04d}.png')
        if not os.path.exists(path):
            doc[i].get_pixmap(matrix=mat).save(path)
            made += 1
    doc.close()

    n_batches = math.ceil(total / 20)
    print(f'[OK] {pdf_path}')
    print(f'  pages: {total}  (new png: {made})')
    print(f'  images: {images_dir}')
    print(f'  推奨バッチ数（20pにつき1 / 並列エージェント数）: {n_batches}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
