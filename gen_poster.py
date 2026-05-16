#!/usr/bin/env python3
"""
Compose Slap Cam 1024×1024 poster from existing head sprites.

Layout:
  - Halftone + gradient comic background
  - HUGE 'SLAP CAM' title (2 stacked lines)
  - 6 character heads scattered below with slight rotation (mix of normal + slapped)
  - 'POW!' speech bubble accent
  - AlterU watermark bottom-right
"""

import os
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

random.seed(42)

ROOT = os.path.dirname(os.path.abspath(__file__))
HEADS_DIR = os.path.join(ROOT, "src/SlapCam/img/heads")
OUT_PATH  = os.path.join(ROOT, "public/poster.png")
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

W, H = 1024, 1024

# Palette (matches game LESS)
INK    = (13, 13, 18)
YELLOW = (255, 212, 0)
PINK   = (255, 61, 163)
CYAN   = (45, 212, 255)
RED    = (255, 45, 61)
ORANGE = (255, 138, 0)
CREAM  = (255, 247, 230)

# Find a fat impact display font (fallback chain)
FONT_PATHS = [
    "/System/Library/Fonts/Supplemental/Impact.ttf",
    "/System/Library/Fonts/Supplemental/Futura.ttc",
    "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]

def find_font(size):
    for p in FONT_PATHS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()


def make_bg() -> Image.Image:
    """Gradient cream→pink→cyan + halftone dots + diagonal speed lines."""
    bg = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / H
        if t < 0.4:
            u = t / 0.4
            r = int(255*(1-u) + 255*u);  g = int(231*(1-u) + 208*u);  b = int(179*(1-u) + 230*u)
        else:
            u = (t - 0.4) / 0.6
            r = int(255*(1-u) + 201*u);  g = int(208*(1-u) + 234*u);  b = int(230*(1-u) + 255*u)
        d.line([(0, y), (W, y)], fill=(r, g, b))

    # Halftone dots — two offset grids
    dot_layer = Image.new("RGBA", (W, H), (0,0,0,0))
    dd = ImageDraw.Draw(dot_layer)
    grid = 28
    for y in range(0, H, grid):
        for x in range(0, W, grid):
            ox = grid // 2 if (y // grid) % 2 else 0
            cx, cy = x + ox, y
            dd.ellipse((cx-2, cy-2, cx+2, cy+2), fill=(0, 0, 0, 40))
    bg = Image.alpha_composite(bg.convert("RGBA"), dot_layer)

    # Diagonal speed lines
    sl = Image.new("RGBA", (W, H), (0,0,0,0))
    sd = ImageDraw.Draw(sl)
    for i in range(-H, W*2, 36):
        sd.line([(i, 0), (i + H, H)], fill=(255, 61, 163, 18), width=2)
    bg = Image.alpha_composite(bg, sl)

    return bg.convert("RGBA")


def draw_text_stroked(draw, xy, text, font, fill, stroke_fill, stroke_w=6, shadow_offset=None, shadow_color=None):
    x, y = xy
    if shadow_offset:
        dx, dy = shadow_offset
        draw.text((x+dx, y+dy), text, font=font, fill=shadow_color,
                  stroke_width=stroke_w, stroke_fill=shadow_color)
    draw.text((x, y), text, font=font, fill=fill,
              stroke_width=stroke_w, stroke_fill=stroke_fill)


def render_title(bg: Image.Image):
    """Render 'SLAP' / 'CAM' on rotated layers and paste onto bg."""
    big_font = find_font(280)
    # SLAP — top line, slight left tilt
    slap = Image.new("RGBA", (900, 360), (0,0,0,0))
    sd = ImageDraw.Draw(slap)
    bbox = sd.textbbox((0,0), "SLAP", font=big_font, stroke_width=12)
    tw = bbox[2] - bbox[0]; th = bbox[3] - bbox[1]
    tx = (slap.width - tw) // 2 - bbox[0]
    ty = (slap.height - th) // 2 - bbox[1]
    # Drop shadow
    sd.text((tx+14, ty+14), "SLAP", font=big_font, fill=PINK + (255,),
            stroke_width=12, stroke_fill=PINK + (255,))
    sd.text((tx, ty), "SLAP", font=big_font, fill=YELLOW + (255,),
            stroke_width=12, stroke_fill=INK + (255,))
    slap_r = slap.rotate(-4, resample=Image.BICUBIC, expand=True)
    bg.alpha_composite(slap_r, ((W - slap_r.width) // 2, 120))

    # CAM — second line, right tilt
    cam = Image.new("RGBA", (800, 360), (0,0,0,0))
    cd = ImageDraw.Draw(cam)
    bbox2 = cd.textbbox((0,0), "CAM", font=big_font, stroke_width=12)
    tw2 = bbox2[2] - bbox2[0]; th2 = bbox2[3] - bbox2[1]
    tx2 = (cam.width - tw2) // 2 - bbox2[0]
    ty2 = (cam.height - th2) // 2 - bbox2[1]
    cd.text((tx2+14, ty2+14), "CAM", font=big_font, fill=CYAN + (255,),
            stroke_width=12, stroke_fill=CYAN + (255,))
    cd.text((tx2, ty2), "CAM", font=big_font, fill=YELLOW + (255,),
            stroke_width=12, stroke_fill=INK + (255,))
    cam_r = cam.rotate(2, resample=Image.BICUBIC, expand=True)
    bg.alpha_composite(cam_r, ((W - cam_r.width) // 2, 360))


def draw_pow_burst(bg: Image.Image, cx: int, cy: int, text: str, color: tuple, rot: float, size: int = 90):
    """Spiky burst shape with text inside."""
    burst = Image.new("RGBA", (450, 450), (0,0,0,0))
    bd = ImageDraw.Draw(burst)
    # 12-spike star
    import math
    spikes = 12
    cx_b, cy_b = 225, 225
    r_out = 200
    r_in = 130
    pts = []
    for i in range(spikes * 2):
        r = r_out if i % 2 == 0 else r_in
        a = (i / (spikes * 2)) * 2 * math.pi - math.pi / 2
        pts.append((cx_b + r * math.cos(a), cy_b + r * math.sin(a)))
    bd.polygon(pts, fill=color + (255,), outline=INK + (255,), width=8)
    # Text
    font = find_font(size)
    bbox = bd.textbbox((0,0), text, font=font, stroke_width=4)
    tw = bbox[2] - bbox[0]; th = bbox[3] - bbox[1]
    bd.text((cx_b - tw//2 - bbox[0], cy_b - th//2 - bbox[1]), text,
            font=font, fill=INK + (255,), stroke_width=4, stroke_fill=color + (255,))
    burst_r = burst.rotate(rot, resample=Image.BICUBIC, expand=True)
    bg.alpha_composite(burst_r, (cx - burst_r.width // 2, cy - burst_r.height // 2))


def paste_head(bg: Image.Image, char_id: str, expr: str, cx: int, cy: int, size: int, rot: float):
    """Paste a character head with drop shadow + rotation."""
    path = os.path.join(HEADS_DIR, f"{char_id}_{expr}.png")
    if not os.path.exists(path):
        print(f"  ⚠ missing {path}, skipping")
        return
    head = Image.open(path).convert("RGBA")
    # Resize keeping aspect
    head.thumbnail((size, size), Image.LANCZOS)
    # Drop shadow
    shadow = head.copy()
    shadow_arr = shadow.split()
    # Replace RGB with black, keep alpha
    black = Image.new("RGBA", head.size, (0, 0, 0, 0))
    black.putalpha(shadow_arr[3])
    shadow = black.filter(ImageFilter.GaussianBlur(4))
    # Rotate together
    head_r = head.rotate(rot, resample=Image.BICUBIC, expand=True)
    shadow_r = shadow.rotate(rot, resample=Image.BICUBIC, expand=True)
    bg.alpha_composite(shadow_r, (cx - shadow_r.width // 2 + 8, cy - shadow_r.height // 2 + 10))
    bg.alpha_composite(head_r, (cx - head_r.width // 2, cy - head_r.height // 2))


def main():
    print("Generating Slap Cam poster…")
    bg = make_bg()

    # Title first (so bursts can sit just behind/beside)
    render_title(bg)

    # POW burst top-left (off the title)
    draw_pow_burst(bg, 130, 140, "POW!", PINK, rot=-15, size=72)

    # WHAM burst top-right (also off the title)
    draw_pow_burst(bg, 920, 130, "WHAM!", CYAN, rot=15, size=56)

    # Character heads — 6 across the bottom half, slight rotations + mix normal/slapped
    HEAD_SIZE = 260
    layout = [
        ("ghostpixel", "slapped",  150,  720, 10),
        ("algram",     "slapped",  380,  860, -8),
        ("jenny",      "normal",   650,  870, 4),
        ("isaya",      "normal",   890,  720, -5),
        ("jmf",        "slapped",  500,  690, -3),
        ("isabel",     "slapped",  150,  920, 6),
    ]
    for char_id, expr, cx, cy, rot in layout:
        paste_head(bg, char_id, expr, cx, cy, HEAD_SIZE, rot)

    # BAM burst near bottom-right
    draw_pow_burst(bg, 880, 940, "BAM!", YELLOW, rot=-10, size=62)

    # AlterU watermark — composite the SVG via inline render
    # SVG-to-raster is annoying; just print a text watermark in dark pill
    wm_font = find_font(28)
    wd = ImageDraw.Draw(bg)
    wm_text = "AlterU"
    wbb = wd.textbbox((0,0), wm_text, font=wm_font)
    wmw = wbb[2] - wbb[0] + 28
    wmh = wbb[3] - wbb[1] + 16
    wd.rounded_rectangle((W - wmw - 24, H - wmh - 24, W - 24, H - 24),
                          radius=wmh // 2, fill=INK + (220,))
    wd.text((W - wmw - 24 + 14 - wbb[0], H - wmh - 24 + 8 - wbb[1]),
            wm_text, font=wm_font, fill=CREAM + (255,))

    # Save
    bg.convert("RGB").save(OUT_PATH, "PNG", optimize=True)
    print(f"  ✓ saved → {OUT_PATH}  ({os.path.getsize(OUT_PATH)//1024} KB)")


if __name__ == "__main__":
    main()
