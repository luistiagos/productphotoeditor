"""Gera os templates de mockup de TESTE da fase 7 (procedurais; ARQUITETURA §20.4 item 10).

Uso: python tools/gen_mockups.py <saida>   (ex.: app/src/main/assets/content/mockups)
Requer Pillow e numpy. Cada template: base com a área do espaço em branco iluminada (o renderer tira o sombreamento dela),
o quad exato no index.json (cantos TL, TR, BR, BL em px da base) e a proporção do design esperado.
Os templates definitivos (fotos) virão num trabalho só de conteúdo.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

rng = np.random.default_rng(11)
SS = 4  # supersample das bordas


def noise(h, w, scale, amp):
    g = rng.random((max(2, h // scale + 2), max(2, w // scale + 2))).astype(np.float32)
    return (np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255 - .5) * amp


def light(h, w, cx, cy, radius, lo, hi):
    """Luz radial: hi no centro (cx, cy em fração), lo a `radius` (fração da diagonal)."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot(x / w - cx, y / h - cy) / radius
    return lo + (hi - lo) * np.clip(1 - d, 0, 1) ** 1.5


def poly_mask(h, w, pts, blur=0.0):
    """Máscara 0..1 do polígono com antialias (supersample) e desfoque opcional (sombra)."""
    m = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(m).polygon([(x * SS, y * SS) for x, y in pts], fill=255)
    m = m.resize((w, h), Image.LANCZOS)
    if blur:
        m = m.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(m, np.float32) / 255


def paint(img, mask, color):
    """Pinta `color` (RGB 0..255 ou array HxWx3) sobre img onde mask > 0."""
    c = np.asarray(color, np.float32)
    return img * (1 - mask[..., None]) + c * mask[..., None]


def shadow(img, pts, dx, dy, blur, strength):
    m = poly_mask(img.shape[0], img.shape[1], [(x + dx, y + dy) for x, y in pts], blur)
    return img * (1 - strength * m[..., None])


def white_surface(h, w, lit, tint=(255, 255, 255)):
    return np.asarray(tint, np.float32)[None, None, :] * lit[..., None]


def poster_wall():
    w, h = 1600, 1600
    wall = np.asarray((214, 202, 184), np.float32)[None, None, :] * (light(h, w, .3, .2, 1.1, .72, 1.0) + noise(h, w, 6, .05))[..., None]
    quad = [(470, 300), (1150, 330), (1130, 1290), (480, 1270)]
    img = shadow(wall, quad, 18, 26, 16, .35)
    lit = light(h, w, .3, .2, 1.1, .82, 1.0)
    img = paint(img, poly_mask(h, w, quad), white_surface(h, w, lit))
    return img, quad, 0.707, "Pôster na parede", "print"


def card_table():
    w, h = 1800, 1350
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    grain = np.sin(x / 9 + noise(h, w, 40, 6) * 3) * .06 + noise(h, w, 3, .08)
    wood = np.asarray((150, 102, 62), np.float32)[None, None, :] * (light(h, w, .6, .3, 1.0, .7, 1.05) + grain)[..., None]
    quad = [(560, 380), (1290, 470), (1210, 880), (480, 780)]
    img = shadow(wood, quad, 14, 20, 10, .45)
    lit = light(h, w, .6, .3, 1.0, .86, 1.0)
    img = paint(img, poly_mask(h, w, quad), white_surface(h, w, lit, (252, 250, 246)))
    return img, quad, 1.8, "Cartão sobre a mesa", "print"


def box_front():
    w, h = 1600, 1600
    floor = np.asarray((228, 228, 232), np.float32)[None, None, :] * light(h, w, .45, .35, 1.2, .7, 1.0)[..., None]
    front = [(420, 520), (980, 560), (980, 1260), (420, 1180)]
    side = [(980, 560), (1250, 470), (1250, 1110), (980, 1260)]
    top = [(420, 520), (700, 430), (1250, 470), (980, 560)]
    img = shadow(floor, [(420, 1180), (980, 1260), (1250, 1110), (1300, 1150), (500, 1260)], 30, 10, 30, .35)
    img = paint(img, poly_mask(h, w, side), white_surface(h, w, light(h, w, .7, .4, 1, .55, .7)))
    img = paint(img, poly_mask(h, w, top), white_surface(h, w, light(h, w, .5, .3, 1, .9, 1.0)))
    img = paint(img, poly_mask(h, w, front), white_surface(h, w, light(h, w, .3, .3, 1.0, .78, .97)))
    return img, front, 0.8, "Frente de caixa", "packaging"


def phone_screen():
    w, h = 1440, 1920
    bg = np.asarray((60, 72, 90), np.float32)[None, None, :] * (light(h, w, .5, .4, 1.0, .55, 1.1) + noise(h, w, 8, .04))[..., None]
    body = [(430, 260), (1030, 300), (1010, 1660), (410, 1640)]
    img = shadow(bg, body, 30, 40, 30, .5)
    img = paint(img, poly_mask(h, w, body), (24, 24, 28))
    quad = [(470, 330), (990, 365), (972, 1590), (452, 1572)]
    lit = light(h, w, .45, .3, 1.2, .9, 1.0)
    img = paint(img, poly_mask(h, w, quad), white_surface(h, w, lit, (250, 252, 255)))
    return img, quad, 0.4615, "Tela de celular", "screen"


TEMPLATES = [("poster_wall", poster_wall), ("card_table", card_table), ("box_front", box_front), ("phone_screen", phone_screen)]


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    index = []
    for tid, fn in TEMPLATES:
        arr, quad, aspect, name, category = fn()
        img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        img.save(out / f"{tid}.webp", "WEBP", quality=92)
        thumb = img.copy()
        thumb.thumbnail((320, 320), Image.LANCZOS)
        thumb.save(out / f"{tid}_thumb.webp", "WEBP", quality=80)
        index.append({"id": tid, "name": name, "category": category, "file": f"{tid}.webp", "thumb": f"{tid}_thumb.webp",
                      "width": img.width, "height": img.height,
                      "slots": [{"quad": [list(p) for p in quad], "aspect": aspect}], "shading": 1.0, "displacement": 0.0})
        print(tid, img.size)
    (out / "index.json").write_text(json.dumps({"version": 1, "mockups": index}, indent=2, ensure_ascii=False), encoding="utf-8")
    (out / "SOURCES.md").write_text(
        "# Origem dos templates de mockup\n\n"
        "Templates de TESTE da fase 7, gerados proceduralmente por `tools/gen_mockups.py` (numpy + Pillow, semente fixa 11).\n"
        "Nenhum modelo generativo, foto ou asset de terceiros foi usado. Os definitivos (fotos de superfícies planas) virão\n"
        "num trabalho só de conteúdo; registrar aqui origem e licença de cada foto.\n",
        encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "app/src/main/assets/content/mockups")
