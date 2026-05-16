#!/usr/bin/env python3
"""
Detect and crop necks/shoulders from head PNGs.

Heuristic:
  - Find the widest row in the lower 60% of the bbox (the chin/face widest point)
  - Find the LAST row from there going down that's still ≥ 60% as wide
  - Crop the image just below that row (= just below chin)
  - Neck and shoulders are narrower than the chin, so they get trimmed

Skips heads that are already head-only (h/w < 1.04).
"""

import os
import sys
from PIL import Image
import numpy as np

HEADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src/SlapCam/img/heads")


def crop_neck(img: Image.Image) -> Image.Image:
    arr = np.array(img.convert("RGBA"))
    alpha = arr[:, :, 3]
    H_, W_ = alpha.shape

    bbox = img.getbbox()
    if not bbox:
        return img
    L, T, R, B = bbox
    bh = B - T
    bw = R - L
    if bh / max(bw, 1) < 1.04:
        # already roughly square / head-only — skip
        return img

    # Per-row content widths
    widths = []
    for y in range(H_):
        cols = np.where(alpha[y] > 30)[0]
        widths.append(int(cols[-1] - cols[0]) if len(cols) > 0 else 0)

    # Look at LOWER 70% of bbox for the face — skip hair-top noise
    mid_start = T + int(bh * 0.30)
    mid_end   = T + int(bh * 0.95)
    if mid_end <= mid_start:
        return img
    face_widths = widths[mid_start:mid_end]
    max_w = max(face_widths) if face_widths else 0
    if max_w == 0:
        return img

    # LAST row in the bbox that is at least 60% as wide as max — that row is the chin
    threshold = max_w * 0.60
    chin_y = mid_start + max(i for i, w in enumerate(face_widths) if w >= threshold)

    # Crop with small padding below chin
    pad = max(int(bh * 0.03), 4)
    crop_y = min(H_, chin_y + pad)
    if crop_y >= B:
        return img
    return img.crop((0, 0, W_, crop_y))


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    files = sorted(f for f in os.listdir(HEADS_DIR)
                   if f.endswith(".png") and ("_normal" in f or "_slapped" in f))
    print(f"Processing {len(files)} heads in {HEADS_DIR}")
    for fname in files:
        if only and only not in fname:
            continue
        path = os.path.join(HEADS_DIR, fname)
        img = Image.open(path).convert("RGBA")
        bbox_before = img.getbbox()
        cropped = crop_neck(img)
        bbox_after = cropped.getbbox()
        if cropped.size == img.size:
            print(f"  · {fname}: already head-only ({bbox_before[2]-bbox_before[0]}×{bbox_before[3]-bbox_before[1]})")
        else:
            cropped.save(path, "PNG")
            print(f"  ✓ {fname}: cropped {img.size[0]}×{img.size[1]} → {cropped.size[0]}×{cropped.size[1]}")


if __name__ == "__main__":
    main()
