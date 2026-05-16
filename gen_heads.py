#!/usr/bin/env python3
"""
Generate head-only comic-book-pop-art portraits for Slap Cam.

Pipeline per char × {normal, slapped}:
  1. Square-crop the head region from the existing AlterU sprite as ref
  2. Composite ref on green (#00FF00)
  3. Upload to 0x0.st
  4. Call img2img API with comic pop art prompt
  5. Download, strip green background, save to src/SlapCam/img/

Style: Comic book pop art (bold outlines, halftone shading, flat colors).
Framing: FLOATING HEAD ONLY — no neck, no shoulders, no body.
Reactions:
  - cartoon: Algram / Jenny / ghostpixel  → X eyes, stars, swirls, red handprint
  - elegant: JM·F / Isaya / Isabel        → wide shocked eyes, mouth open, red cheek

Run:  ~/miniconda3/bin/python3 gen_heads.py
"""

import datetime
import hashlib
import hmac
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from PIL import Image

# ────────────────────────────────────────────────────────────────────────────
# CONFIG
# ────────────────────────────────────────────────────────────────────────────

API_URL     = "http://aiservice.wdabuliu.com:8019/genl_image"
API_TIMEOUT = 360
RATE_WAIT   = 78
USER_ID     = 7777001    # numeric (memory says string can return code=100)

# Cloudflare R2 — aigram bucket, public via images.aiwaves.tech
R2_ACCOUNT_ID = "bdccd2c68ff0d2e622994d24dbb1bae3"
R2_ACCESS_KEY = "b203adb7561b4f8800cbc1fa02424467"
R2_SECRET_KEY = "e7926e4175b7a0914496b9c999afd914cd1e4af7db8f83e0cf2bfad9773fa2b0"
R2_BUCKET     = "aigram"
R2_PUBLIC     = "https://images.aiwaves.tech"

OUT_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src/SlapCam/img/heads")
REF_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src/SlapCam/img/_refs")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(REF_DIR, exist_ok=True)

CS_DIR   = "/Users/yin/code/games/convenience-store-v2/src/ConvenienceStore/img"
SP_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src/SlapCam/img/heads_sp_backup")

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

# ────────────────────────────────────────────────────────────────────────────
# STYLE PROMPTS
# ────────────────────────────────────────────────────────────────────────────

STYLE_BASE = (
    "CHIBI SD anime style, super-deformed Q-version cute character, "
    "the head is a BIG ROUND OVAL shape — wider than tall or square — completely smooth round contour, "
    "NO realistic jaw, NO chin definition, NO cheekbone detail, NO neck, NO shoulders, NO body, NO clothing, "
    "the head shape itself is the entire image — like a round emoji or sticker, "
    "LARGE simple anime eyes (round circles with sparkle highlights, NOT detailed), "
    "tiny dot nose OR no nose at all, "
    "small simple curved mouth, "
    "soft round baby-like face, kawaii cute aesthetic, "
    "clean cel-shaded soft colors, vibrant but soft anime palette, "
    "bold simple black outline, polished Q-version sticker quality, "
    "respect the character's specified gender, hair color, hair shape, and accessories EXACTLY, "
    "NOT realistic, NOT detailed anatomy, NOT photorealistic, NOT South Park flat geometric, NOT adult anime portrait, "
    "EXTREME CLOSE-UP — the round head fills the entire frame, touches all 4 edges, "
    "BACKGROUND: solid flat bright green #00FF00 covering everything around the round head, "
    "NO frame, NO border, NO panel, NO speech bubble"
)

NEUTRAL_EXPR = (
    "neutral calm expression, classic pie-cut eyes (white circles with small black pie slice), "
    "small wobbly hand-inked smile, vintage cartoon mood"
)

CARTOON_SLAPPED = (
    "extreme cartoon slapstick KO face, "
    "LITERAL X-SHAPED CROSS EYES (two black X marks where the pupils were), "
    "open O-shaped mouth, tongue lolling out to the side, "
    "bright red handprint mark on cheek, "
    "spiral daze lines on forehead, "
    "small cartoon birds and stars spinning around head, "
    "head visibly tilted from impact, exaggerated comedy"
)

ELEGANT_SLAPPED = (
    "shocked stunned reaction, "
    "wide eyes with tiny contracted pupils, mouth agape in surprise, "
    "single bright red handprint mark visible on cheek, "
    "eyebrows raised high, flushed pink cheeks, "
    "horizontal motion lines suggesting head jerked sideways, "
    "still recognizable face, refined but caught off-guard"
)

# ────────────────────────────────────────────────────────────────────────────
# CHARACTERS
# crop_box_frac: (cx, cy, half) as fractions of (w, h, min(w,h))
# describes the square crop around the head in the source sprite
# ────────────────────────────────────────────────────────────────────────────

CHARS = [
    {
        "id": "algram",
        "src": f"{CS_DIR}/guitarist_normal.png",
        "crop_frac": (0.50, 0.16, 0.18),
        "style": "cartoon",
        "desc": (
            "Asian teenage boy, brown spiky messy short hair, "
            "tan skin, dark brown eyes, mischievous smile"
        ),
    },
    {
        "id": "jenny",
        "src": f"{CS_DIR}/coder_normal.png",
        "crop_frac": (0.50, 0.18, 0.22),
        "style": "cartoon",
        "desc": (
            "young woman, short brown bob hair, "
            "round black-frame glasses, bright green eyes, "
            "fair skin, slight smile"
        ),
    },
    {
        "id": "jmf",
        "src": f"{CS_DIR}/hacker_normal.png",
        "crop_frac": (0.50, 0.19, 0.22),
        "style": "elegant",
        "desc": (
            "Asian man in his 30s, masculine, side-parted short black hair, "
            "light black stubble on chin and upper lip, "
            "thin black-frame round glasses, calm intelligent dark eyes"
        ),
    },
    {
        "id": "ghostpixel",
        "src": f"{CS_DIR}/ghost_normal.png",
        "crop_frac": (0.50, 0.28, 0.30),
        "style": "cartoon",
        "desc": (
            "cute cartoon white ghost head (rounded blob shape, slightly translucent), "
            "two big black oval eyes with small white highlights, "
            "small simple mouth, just the ghost head — no body sheet visible"
        ),
    },
    {
        "id": "isaya",
        "src": f"{CS_DIR}/customers/isaya_normal.png",
        "crop_frac": (0.50, 0.16, 0.20),
        "style": "elegant",
        "desc": (
            "young woman, long straight blue hair parted in the middle, NO BANGS, "
            "forehead visible, pale skin, soft blue eyes, "
            "large black over-ear headphones on top of head"
        ),
    },
    {
        "id": "isabel",
        "src": f"{CS_DIR}/customers/isabel_normal.png",
        "crop_frac": (0.50, 0.17, 0.20),
        "style": "elegant",
        "desc": (
            "young woman, silver-grey wavy medium hair, "
            "olive skin, dark eyes, refined elegant look"
        ),
    },
]

# ────────────────────────────────────────────────────────────────────────────
# CROPPING
# ────────────────────────────────────────────────────────────────────────────

def make_square_ref(char) -> str:
    """Crop a square around the head, composite on green, return path to ref PNG."""
    img = Image.open(char["src"]).convert("RGBA")
    w, h = img.size
    cx_f, cy_f, half_f = char["crop_frac"]
    cx = int(cx_f * w)
    cy = int(cy_f * h)
    half = int(half_f * min(w, h))

    # Clamp to image bounds (shift box if it goes off-edge)
    left   = max(0, cx - half)
    right  = min(w, cx + half)
    top    = max(0, cy - half)
    bottom = min(h, cy + half)
    # Force square by trimming the longer side
    side = min(right - left, bottom - top)
    cx2 = (left + right) // 2
    cy2 = (top + bottom) // 2
    left   = cx2 - side // 2
    top    = cy2 - side // 2
    right  = left + side
    bottom = top + side

    crop = img.crop((left, top, right, bottom))

    # Composite on green
    bg = Image.new("RGBA", crop.size, (0, 255, 0, 255))
    bg.paste(crop, mask=crop.split()[3])
    ref = bg.convert("RGB")

    # Upscale small refs for better API quality
    if side < 512:
        ref = ref.resize((512, 512), Image.LANCZOS)

    path = os.path.join(REF_DIR, f"ref_{char['id']}.png")
    ref.save(path, "PNG")
    print(f"  ✓ ref crop: {path}  ({side}x{side} → {ref.size[0]}x{ref.size[1]})")
    return path

# ────────────────────────────────────────────────────────────────────────────
# API CALLS
# ────────────────────────────────────────────────────────────────────────────

def _sign(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def upload(path: str) -> str:
    """Upload to Cloudflare R2 (aigram bucket) and return public URL with cache-bust."""
    obj_key = f"refs/slap_cam_{int(time.time()*1000)}_{os.path.basename(path)}"
    with open(path, "rb") as f:
        data = f.read()
    host = f"{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    region, service, method = "auto", "s3", "PUT"
    content_type = "image/png"
    canon_uri = "/" + R2_BUCKET + "/" + urllib.parse.quote(obj_key, safe="/")
    canon_headers = (
        f"content-type:{content_type}\n"
        f"host:{host}\n"
        f"x-amz-content-sha256:UNSIGNED-PAYLOAD\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"
    canon_req = f"{method}\n{canon_uri}\n\n{canon_headers}\n{signed_headers}\nUNSIGNED-PAYLOAD"
    scope = f"{date_stamp}/{region}/{service}/aws4_request"
    string2sign = (
        f"AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n"
        f"{hashlib.sha256(canon_req.encode()).hexdigest()}"
    )
    k = _sign(_sign(_sign(_sign(("AWS4" + R2_SECRET_KEY).encode(),
                                 date_stamp), region), service), "aws4_request")
    sig = hmac.new(k, string2sign.encode(), hashlib.sha256).hexdigest()
    auth = (
        f"AWS4-HMAC-SHA256 Credential={R2_ACCESS_KEY}/{scope}, "
        f"SignedHeaders={signed_headers}, Signature={sig}"
    )
    req = urllib.request.Request(
        f"https://{host}/{R2_BUCKET}/{urllib.parse.quote(obj_key, safe='/')}",
        data=data, method="PUT",
        headers={
            "Content-Type": content_type,
            "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
            "x-amz-date": amz_date,
            "Authorization": auth,
        },
    )
    urllib.request.urlopen(req, timeout=60, context=_SSL_CTX)
    url = f"{R2_PUBLIC}/{obj_key}"
    print(f"  ↑ uploaded → {url}")
    return url


def call_api(ref_url: str | None, prompt: str) -> str | None:
    """Returns result URL or None on failure. Raises 'rate_limit'.
    If ref_url is None, uses txt2img mode (omit url param)."""
    params: dict = {"prompt": prompt, "user_id": USER_ID}
    if ref_url:
        params["url"] = ref_url
    payload = json.dumps({"query": "", "params": params}).encode()
    req = urllib.request.Request(
        API_URL, data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=API_TIMEOUT) as r:
            result = json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            result = json.loads(body)
        except Exception:
            print(f"  ✗ HTTP {e.code} — {body}")
            return None
    code = result.get("code")
    if code == 200:
        return result["url"]
    if code == 429:
        raise RuntimeError("rate_limit")
    if code == 100:
        # Per memory: sometimes a transient — wait and retry once.
        print(f"  ⚠ code=100, treating as transient — will retry once")
        raise RuntimeError("rate_limit")
    print(f"  ✗ API returned code={code}: {result}")
    return None


def download(url: str, out_path: str) -> None:
    print(f"  ↓ downloading result…")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    src_ext = os.path.splitext(url.split("?")[0])[1].lower()
    dst_ext = os.path.splitext(out_path)[1].lower()
    tmp = out_path if src_ext == dst_ext else out_path + src_ext
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as r:
        data = r.read()
    with open(tmp, "wb") as f:
        f.write(data)
    if src_ext != dst_ext and dst_ext in (".png", ".jpg"):
        fmt = "png" if dst_ext == ".png" else "jpeg"
        subprocess.run(["sips", "-s", "format", fmt, tmp, "--out", out_path],
                       check=True, capture_output=True)
        os.remove(tmp)
    elif tmp != out_path:
        os.rename(tmp, out_path)
    print(f"    saved → {out_path}  ({os.path.getsize(out_path)//1024} KB)")

# ────────────────────────────────────────────────────────────────────────────
# GREEN BACKGROUND REMOVAL
# ────────────────────────────────────────────────────────────────────────────

def remove_green(in_path: str, out_path: str) -> None:
    """Strip green pixels by alpha. Method from memory: greenness = g - max(r,b)."""
    img = Image.open(in_path).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            greenness = g - max(r, b)
            if greenness > 50:
                # Strong green → fully transparent
                px[x, y] = (r, g, b, 0)
            elif greenness > 15:
                # Mild green tint → reduce alpha + de-tint
                t = (greenness - 15) / 35
                new_a = int(a * (1 - t))
                # subtract green spill from green channel
                new_g = max(int(g - greenness * 0.6), 0)
                px[x, y] = (r, new_g, b, new_a)
    img.save(out_path, "PNG")
    print(f"  ✓ green removed → {out_path}")

# ────────────────────────────────────────────────────────────────────────────
# MAIN
# ────────────────────────────────────────────────────────────────────────────

def build_prompt(char, expr: str) -> str:
    if expr == "normal":
        expr_block = NEUTRAL_EXPR
    elif char["style"] == "cartoon":
        expr_block = CARTOON_SLAPPED
    else:
        expr_block = ELEGANT_SLAPPED
    return f"{STYLE_BASE}, {char['desc']}, {expr_block}"


def generate_one(char, expr: str, ref_url: str | None) -> bool:
    """If ref_url is None → txt2img. Otherwise → img2img."""
    prompt = build_prompt(char, expr)
    out_path = os.path.join(OUT_DIR, f"{char['id']}_{expr}.png")
    mode = "txt2img" if ref_url is None else "img2img"
    print(f"\n— {char['id']} / {expr} ({mode}) —")
    print(f"  prompt[0:120]: {prompt[:120]}…")

    for attempt in range(3):
        try:
            url = call_api(ref_url, prompt)
        except RuntimeError as e:
            if str(e) == "rate_limit":
                print(f"  ⏳ rate-limited (or transient) — waiting {RATE_WAIT}s")
                time.sleep(RATE_WAIT)
                continue
            raise
        break
    else:
        print(f"  ✗ gave up after 3 attempts")
        return False

    if not url:
        return False

    raw_path = out_path + ".raw.png"
    download(url, raw_path)
    remove_green(raw_path, out_path)
    os.remove(raw_path)
    return True


def main():
    """img2img-chain pipeline:
    - normal: img2img using SP backup head as ref (head-only composition, neutral non-anime style)
    - slapped: img2img using the freshly-generated normal as ref (Cuphead style preserved)
    """
    only      = sys.argv[1] if len(sys.argv) > 1 else None
    only_expr = sys.argv[2] if len(sys.argv) > 2 else None

    print("=" * 60)
    print("IMG2IMG CHAIN PIPELINE")
    print("  normal: SP-backup ref → Cuphead style")
    print("  slapped: just-generated normal ref → slap reaction")
    print("=" * 60)

    results = []
    first = True

    for char in CHARS:
        if only and char["id"] != only:
            continue

        normal_path = os.path.join(OUT_DIR, f"{char['id']}_normal.png")

        # ── normal: img2img with tight head crop of anime sprite as ref ──
        if not only_expr or only_expr == "normal":
            if not first:
                print(f"\n⏳ waiting {RATE_WAIT}s for rate limit…")
                time.sleep(RATE_WAIT)
            first = False
            print(f"\n[{char['id']}] preparing tight head ref for normal")
            ref_path = make_square_ref(char)
            ref_url = upload(ref_path)
            ok = generate_one(char, "normal", ref_url=ref_url)
            results.append((char["id"], "normal", ok))
            if not ok and only_expr != "slapped":
                print(f"  ⚠ normal failed for {char['id']}, skipping slapped")
                continue

        # ── slapped: img2img using newly-generated normal as ref ──
        if not only_expr or only_expr == "slapped":
            if not os.path.exists(normal_path):
                print(f"  ⚠ no normal image to use as ref for {char['id']}, skipping")
                results.append((char["id"], "slapped", False))
                continue
            if not first:
                print(f"\n⏳ waiting {RATE_WAIT}s for rate limit…")
                time.sleep(RATE_WAIT)
            first = False
            print(f"\n[{char['id']}] using just-generated normal as slapped ref")
            ref_url = upload(normal_path)
            ok = generate_one(char, "slapped", ref_url=ref_url)
            results.append((char["id"], "slapped", ok))

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for cid, expr, ok in results:
        print(f"  {'✓' if ok else '✗'}  {cid}_{expr}.png")


if __name__ == "__main__":
    main()
