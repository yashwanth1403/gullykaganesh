"""
Turn the brand illustration into the assets the app serves.

    python3 scripts/brand-assets.py [--head x,y,size]

Input : public/brand/ganesh.png        (the generated illustration, any size)
Output: public/brand/ganesh.webp       (transparent background, full size)
        public/brand/ganesh-480.webp   (for sheets and empty states)
        app/icon.png (512)  app/apple-icon.png (180)  app/favicon.ico (16/32/48)
          — crown + face on a kumkum rounded square, so it reads on any tab.

Background removal is a flood fill from the four corners, so the figure's
own off-white interior stays opaque; only the outside becomes transparent.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/brand/ganesh.png"
KUMKUM = (214, 64, 44, 255)
PAPER = (250, 249, 246, 255)

img = Image.open(SRC).convert("RGBA")
W, H = img.size

# --- 1. Transparent background --------------------------------------------
# Paint the exterior with a sentinel colour by flood-filling from each corner,
# tolerant enough to swallow scan-like noise but not the ink outline.
SENT = (0, 255, 0, 255)
work = img.copy()
for seed in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
    ImageDraw.floodfill(work, seed, SENT, thresh=48)
mask = Image.new("L", (W, H), 255)
mpx, wpx = mask.load(), work.load()
for y in range(H):
    for x in range(W):
        if wpx[x, y] == SENT:
            mpx[x, y] = 0
# Soften the cut edge by one pixel so the outline keeps its anti-aliasing.
mask = mask.filter(ImageFilter.GaussianBlur(0.6))
out = img.copy()
out.putalpha(mask)

bbox = out.getbbox()
figure = out.crop(bbox)
figure.save(ROOT / "public/brand/ganesh.webp", "WEBP", quality=90, method=6)
small = figure.copy()
small.thumbnail((480, 480), Image.LANCZOS)
small.save(ROOT / "public/brand/ganesh-480.webp", "WEBP", quality=88, method=6)
print("figure", figure.size, "bbox", bbox)

# --- 2. Crown + face crop for the icon --------------------------------------
fw, fh = figure.size
if len(sys.argv) > 2 and sys.argv[1] == "--head":
    hx, hy, hs = (int(v) for v in sys.argv[2].split(","))
else:
    # Measured on the 2026-09-14 illustration (758x814 after trimming): the
    # square that sits exactly between the axe and the lotus, crown to trunk.
    # Re-measure with a grid if the source image changes.
    hx, hy, hs = 148, -2, 410
head = figure.crop((hx, hy, hx + hs, hy + hs))
print("head crop", (hx, hy, hs))

def icon(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * 0.22), fill=KUMKUM)
    pad = round(size * 0.08)
    inner = size - 2 * pad
    # Give the line art a paper disc to sit on, so ink strokes never fall on kumkum.
    disc = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(disc).ellipse((pad, pad, size - pad, size - pad), fill=PAPER)
    canvas.alpha_composite(disc)
    face = head.resize((inner, inner), Image.LANCZOS)
    # Clip the face to the disc so the crop's square corners don't show.
    clip = Image.new("L", (size, size), 0)
    ImageDraw.Draw(clip).ellipse((pad, pad, size - pad, size - pad), fill=255)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layer.paste(face, (pad, pad))
    layer.putalpha(Image.composite(layer.getchannel("A"), Image.new("L", (size, size), 0), clip))
    canvas.alpha_composite(layer)
    return canvas

icon(512).save(ROOT / "app/icon.png")
icon(180).save(ROOT / "app/apple-icon.png")
icon(64).save(ROOT / "app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
# A preview strip at real tab sizes, for judging legibility.
strip = Image.new("RGBA", (16 + 32 + 64 + 128 + 40, 128), PAPER)
x = 0
for s in (128, 64, 32, 16):
    strip.paste(icon(s), (x, 128 - s), icon(s))
    x += s + 10
strip.save(ROOT / "public/brand/icon-preview.png")
print("icons written")
