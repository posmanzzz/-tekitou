#!/usr/bin/env python3
"""Generates the PWA icons into /home/claude/pwa/icons (run manually; dist_build.py just copies them)."""
import math, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
FONT = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Black.ttc"  # index 0 = JP
S = 1024  # master size; downsampled for AA

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def background():
    img = Image.new("RGB", (S, S), (7, 5, 14))
    px = img.load()
    cx = cy = S / 2
    for y in range(S):
        for x in range(S):
            d = math.hypot(x - cx, y - cy) / (S * 0.72)
            t = max(0.0, 1 - d)
            px[x, y] = lerp((7, 5, 14), (58, 18, 52), t ** 1.6)
    # pachinko-style sunburst rays
    rays = Image.new("L", (S, S), 0)
    rd = ImageDraw.Draw(rays)
    n = 24
    for i in range(n):
        a0 = 2 * math.pi * i / n
        a1 = a0 + math.pi / n
        R = S
        rd.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)),
                    (cx + R * math.cos(a1), cy + R * math.sin(a1))], fill=255)
    fade = Image.radial_gradient("L").resize((S, S))  # 0 centre -> 255 edge
    fade = fade.point(lambda v: int(70 * (1 - v / 255) ** 1.2))
    rays = ImageChops.multiply(rays, fade.point(lambda v: 255 if v else 0)).filter(ImageFilter.GaussianBlur(2))
    rays = ImageChops.multiply(rays.point(lambda v: v), Image.new("L", (S, S), 255))
    gold = Image.new("RGB", (S, S), (245, 197, 66))
    ray_alpha = ImageChops.multiply(rays, fade.point(lambda v: min(255, v * 3)))
    img = Image.composite(gold, img, ray_alpha.point(lambda v: v * 40 // 255))
    return img

def gold_gradient(box):
    w, h = box
    g = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(g)
    stops = [(0, (255, 244, 190)), (.35, (245, 197, 66)), (.6, (200, 138, 22)), (.8, (245, 197, 66)), (1, (150, 92, 10))]
    for y in range(h):
        t = y / (h - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                c = lerp(c0, c1, (t - t0) / (t1 - t0)); break
        d.line([(0, y), (w, y)], fill=c)
    return g

def draw_frame(img, inset, width):
    d = ImageDraw.Draw(img)
    for k, col in enumerate([(245, 197, 66), (120, 78, 12)]):
        o = inset + k * (width + 10)
        d.rounded_rectangle([o, o, S - o, S - o], radius=90, outline=col, width=width if k == 0 else width // 2)

def suit(d, kind, cx, cy, r, fill):
    if kind == "heart":
        d.ellipse([cx - r, cy - r, cx, cy], fill=fill); d.ellipse([cx, cy - r, cx + r, cy], fill=fill)
        d.polygon([(cx - r, cy - r * .35), (cx + r, cy - r * .35), (cx, cy + r * 1.1)], fill=fill)
    elif kind == "spade":
        d.ellipse([cx - r, cy - r * .1, cx, cy + r * .9], fill=fill); d.ellipse([cx, cy - r * .1, cx + r, cy + r * .9], fill=fill)
        d.polygon([(cx - r, cy + r * .3), (cx + r, cy + r * .3), (cx, cy - r * 1.1)], fill=fill)
        d.polygon([(cx, cy + r * .3), (cx - r * .35, cy + r * 1.2), (cx + r * .35, cy + r * 1.2)], fill=fill)

def make(maskable, glyph_scale):
    img = background()
    if not maskable:
        draw_frame(img, 36, 14)
    # glyph
    size = int(S * glyph_scale)
    font = ImageFont.truetype(FONT, size, index=0)
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    bb = md.textbbox((0, 0), "富", font=font)
    tx = (S - (bb[2] - bb[0])) // 2 - bb[0]
    ty = (S - (bb[3] - bb[1])) // 2 - bb[1] + int(S * 0.01)
    md.text((tx, ty), "富", font=font, fill=255)
    # glow
    glow = mask.filter(ImageFilter.GaussianBlur(S * 0.035))
    img = Image.composite(Image.new("RGB", (S, S), (255, 160, 30)), img, glow.point(lambda v: int(v * .65)))
    # dark outline/shadow
    shadow = ImageChops.offset(mask.filter(ImageFilter.MaxFilter(15)), 0, 8)
    img = Image.composite(Image.new("RGB", (S, S), (20, 6, 10)), img, shadow)
    # gold fill
    ys = [y for y in range(S) if mask.crop((0, y, S, y + 1)).getbbox()]
    y0, y1 = ys[0], ys[-1]
    grad = Image.new("RGB", (S, S), (245, 197, 66))
    grad.paste(gold_gradient((S, y1 - y0 + 1)), (0, y0))
    img = Image.composite(grad, img, mask)
    # thin highlight edge
    edge = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(5)), mask)
    img = Image.composite(Image.new("RGB", (S, S), (255, 232, 150)), img, edge.point(lambda v: v // 2))
    # suits top/bottom of the glyph (inside safe zone)
    if not maskable:
        d = ImageDraw.Draw(img)
        r = int(S * .045)
        for (x, y, k, c) in [(S * .20, S * .21, "spade", (245, 197, 66)), (S * .80, S * .21, "heart", (210, 59, 59)),
                              (S * .20, S * .79, "heart", (210, 59, 59)), (S * .80, S * .79, "spade", (245, 197, 66))]:
            suit(d, k, x, y, r, c)
    return img

def save(img, name, px, flatten=True):
    im = img.resize((px, px), Image.LANCZOS)
    im.save(os.path.join(OUT, name), optimize=True)
    print("wrote", name, px, os.path.getsize(os.path.join(OUT, name)), "bytes")

if __name__ == "__main__":
    if not os.path.exists(FONT):
        sys.exit("CJK font missing: " + FONT)
    os.makedirs(OUT, exist_ok=True)
    anyimg = make(False, 0.60)
    save(anyimg, "icon-512.png", 512); save(anyimg, "icon-192.png", 192)
    save(anyimg, "apple-touch-icon.png", 180); save(anyimg, "favicon-32.png", 32)
    mk = make(True, 0.46)  # kept inside the 80% safe circle
    save(mk, "icon-maskable-512.png", 512)
