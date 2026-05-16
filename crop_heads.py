#!/usr/bin/env python3
"""
Post-process AI-generated images to extract head-only crops.

Pipeline:
  1. Take top portion of image (where head lives)
  2. Find bbox of non-transparent pixels in that region
  3. Tight-crop, pad to square, save

Run after gen_heads.py finishes. Overwrites in place.
"""

import os
import sys
from PIL import Image

HEADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src/SlapCam/img/heads")
TOP_FRACTION = 0.58   # take top 58% of image as the head region (rest is shoulders/body)
PADDING_FRAC = 0.05   # 5% transparent padding around head bbox

def head_only(in_path: str, out_path: str | None = None):
    out_path = out_path or in_path
    img = Image.open(in_path).convert("RGBA")
    w, h = img.size

    # Take top portion
    top = img.crop((0, 0, w, int(h * TOP_FRACTION)))

    # Find non-transparent bbox
    bbox = top.getbbox()
    if not bbox:
        print(f"  ⚠ {os.path.basename(in_path)}: no opaque pixels in top region, leaving as-is")
        return

    head = top.crop(bbox)
    hw, hh = head.size

    # Pad to square with small extra padding
    side = max(hw, hh)
    pad = int(side * PADDING_FRAC)
    final = Image.new("RGBA", (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
    final.paste(head, ((side - hw) // 2 + pad, (side - hh) // 2 + pad))

    final.save(out_path, "PNG")
    print(f"  ✓ {os.path.basename(out_path)}  (was {w}x{h}, head bbox {hw}x{hh}, out {final.size[0]}x{final.size[1]})")


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    files = sorted(f for f in os.listdir(HEADS_DIR) if f.endswith(".png") and ("_normal" in f or "_slapped" in f))
    print(f"Processing {len(files)} files in {HEADS_DIR}")
    for fname in files:
        if only and only not in fname:
            continue
        path = os.path.join(HEADS_DIR, fname)
        head_only(path)


if __name__ == "__main__":
    main()
