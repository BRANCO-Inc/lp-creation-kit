#!/usr/bin/env python3
"""
LP full-page画像を指定高さで分割するスクリプト

Usage:
  python3 split-images.py <lp_dir> [--height 1500]

Example:
  python3 split-images.py ./output/lp/example --height 1500
"""

import sys
import os
import glob
from PIL import Image

def split_full_page(lp_dir, max_height=1500):
    images_dir = os.path.join(lp_dir, 'images')
    full_page = os.path.join(images_dir, 'full-page.png')

    if not os.path.exists(full_page):
        print(f"[Skip] {lp_dir}: full-page.png not found")
        return 0

    # 古いセクション画像を削除
    for old in glob.glob(os.path.join(images_dir, 'section-*.png')):
        os.remove(old)
    for old in glob.glob(os.path.join(images_dir, 'part-*.png')):
        os.remove(old)

    img = Image.open(full_page)
    width, height = img.size

    if height <= max_height:
        # 分割不要
        part_path = os.path.join(images_dir, 'part-01.png')
        img.save(part_path)
        print(f"[OK] {os.path.basename(lp_dir)}: 1 part ({width}x{height})")
        return 1

    parts = []
    y = 0
    idx = 1
    while y < height:
        bottom = min(y + max_height, height)
        part = img.crop((0, y, width, bottom))
        part_name = f'part-{idx:02d}.png'
        part_path = os.path.join(images_dir, part_name)
        part.save(part_path)
        parts.append(part_name)
        y = bottom
        idx += 1

    print(f"[OK] {os.path.basename(lp_dir)}: {len(parts)} parts ({width}x{height} -> {max_height}px each)")
    return len(parts)


def process_all(base_dir, max_height=1500):
    total = 0
    for lp_dir in sorted(glob.glob(os.path.join(base_dir, '*/'))):
        if os.path.isdir(os.path.join(lp_dir, 'images')):
            count = split_full_page(lp_dir.rstrip('/'), max_height)
            total += count
    print(f"\n[Done] Total: {total} parts across all LPs")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 split-images.py <lp_dir_or_base_dir> [--height 1500]")
        sys.exit(1)

    target = os.path.expanduser(sys.argv[1])
    max_h = 1500
    if '--height' in sys.argv:
        idx = sys.argv.index('--height')
        max_h = int(sys.argv[idx + 1])

    if os.path.exists(os.path.join(target, 'images')):
        # 単一LP
        split_full_page(target, max_h)
    else:
        # 全LP一括
        process_all(target, max_h)
