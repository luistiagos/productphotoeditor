"""Gera os templates de mockup de TESTE da fase 7 (procedurais; ARQUITETURA §20.4 item 10).

Uso: python tools/gen_mockups.py <saida>   (ex.: app/src/main/assets/content/mockups)
     python tools/gen_mockups.py --3d <saida>   (templates 2.5D do editor, TASK-08: app/src/main/assets/content/mockups3d;
     não toca nos planos — gerador e semente próprios)
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


def noise(h, w, scale, amp, gen=None):
    g = (rng if gen is None else gen).random((max(2, h // scale + 2), max(2, w // scale + 2))).astype(np.float32)
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


# ---------- templates 2.5D do editor (TASK-08) ----------
# Lidos só pelo estúdio "📦 Mockup 3D" do editor-web (content/mockups3d/index.json). NÃO entram em mockups/index.json:
# o MockupLibrary do Kotlin ignora `shape` e os renderizaria planos (e o MockupTest exige 4 planos).

rng3 = None  # gerador próprio, criado em main3d (a sequência do `rng` dos planos não muda)
S3 = 1200  # lado das bases (≤ 1600)


def ellipse_pts(cx, cy, rx, ry, a0=0.0, a1=2 * np.pi, n=96):
    return [(cx + rx * np.cos(a), cy + ry * np.sin(a)) for a in np.linspace(a0, a1, n)]


def room(h, w, wall, floor, horizon):
    """Parede com luz suave em cima e mesa/chão abaixo de `horizon` (fração da altura)."""
    y = np.mgrid[0:h, 0:w][0].astype(np.float32)
    lw = light(h, w, .35, .15, 1.2, .78, 1.0) + noise(h, w, 9, .03, rng3)
    lf = light(h, w, .45, .75, 1.0, .62, .92) + noise(h, w, 4, .04, rng3)
    top = (y < horizon * h)[..., None]
    return np.where(top, np.asarray(wall, np.float32) * lw[..., None], np.asarray(floor, np.float32) * lf[..., None])


def cyl_shade(w, cx, r, lo, hi):
    """Perfil horizontal de um cilindro: cos θ com a luz um pouco à esquerda e brilho especular vertical em s ≈ 0,32."""
    x = np.arange(w, dtype=np.float32)
    s = np.clip((x - cx) / r, -1, 1)
    th = np.arcsin(s)
    base = lo + (hi - lo) * np.clip(np.cos(th + .35), 0, 1) ** .8
    spec = .22 * np.exp(-((s + .36) / .09) ** 2)
    return base + spec


def columns(h, profile, color):
    """Imagem HxWx3 com a cor modulada só pela coluna (perfil de um corpo cilíndrico)."""
    return np.asarray(color, np.float32)[None, None, :] * profile[None, :, None] * np.ones((h, 1, 1), np.float32)


def cylinder_object(img, cx, top, bot, r, ry, color, lid=None):
    """Corpo cilíndrico visto um pouco de cima: lados retos, base = meia elipse da frente, boca (ou tampa) = elipse."""
    h, w = img.shape[:2]
    sh = cyl_shade(w, cx, r, .45, 1.0)
    body = [(cx - r, top), (cx - r, bot)] + ellipse_pts(cx, bot, r, ry, np.pi, 0, 64) + [(cx + r, bot), (cx + r, top)]
    img = paint(img, poly_mask(h, w, body), columns(h, sh, color))
    if lid is not None:
        lid_top = top - lid
        rr = r * .98
        cap = [(cx - rr, lid_top), (cx - rr, top)] + ellipse_pts(cx, top, rr, ry, np.pi, 0, 64) + [(cx + rr, top), (cx + rr, lid_top)]
        img = paint(img, poly_mask(h, w, cap), columns(h, sh, (52, 58, 66)))
        img = paint(img, poly_mask(h, w, ellipse_pts(cx, lid_top, rr, ry)), (88, 96, 108))
    else:
        img = paint(img, poly_mask(h, w, ellipse_pts(cx, top, r, ry)), np.asarray(color, np.float32) * .97)
        img = paint(img, poly_mask(h, w, ellipse_pts(cx, top + ry * .12, r * .9, ry * .82)), np.asarray(color, np.float32) * .52)
    return img


def grid_mesh(quad, wave):
    """Malha 4×4 (linhas de cima para baixo) por interpolação bilinear do quad; `wave(i, j)` desloca os pontos que não
    são canto (os cantos ficam iguais ao quad: as alças do estúdio movem a malha junto)."""
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = quad
    pts = []
    for j in range(4):
        for i in range(4):
            s, t = i / 3, j / 3
            x = (1 - s) * (1 - t) * x0 + s * (1 - t) * x1 + s * t * x2 + (1 - s) * t * x3
            y = (1 - s) * (1 - t) * y0 + s * (1 - t) * y1 + s * t * y2 + (1 - s) * t * y3
            if (i, j) not in ((0, 0), (3, 0), (3, 3), (0, 3)):
                dx, dy = wave(i, j)
                x, y = x + dx, y + dy
            pts.append((round(float(x), 1), round(float(y), 1)))
    return pts


def fold_bands(h, w, bands):
    """Fator de luz das dobras: cada banda (x na linha y=0, inclinação dx/dy, largura σ, força) escurece uma faixa e
    clareia de leve o lado ao lado (o relevo do vinco)."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    f = np.ones((h, w), np.float32)
    for bx, slope, sigma, strength in bands:
        d = (x - (bx + slope * y)) / sigma
        f *= 1 - strength * np.exp(-d * d)
        d2 = (x - (bx + slope * y) - 1.6 * sigma) / (sigma * 1.2)
        f *= 1 + strength * .35 * np.exp(-d2 * d2)
    return f


def mug():
    h = w = S3
    img = room(h, w, (206, 214, 222), (176, 146, 116), .62)
    cx, top, bot, r, ry = 560, 300, 900, 240, 40
    img = shadow(img, ellipse_pts(cx + 40, bot + 6, r * 1.15, ry * 1.4), 20, 4, 24, .45)
    # alça à direita (anel), pintada antes: o corpo a cobre na junção
    ring = poly_mask(h, w, ellipse_pts(cx + r + 30, 600, 120, 190)) * (1 - poly_mask(h, w, ellipse_pts(cx + r + 30, 600, 66, 130)))
    img = paint(img, ring, columns(h, cyl_shade(w, cx + r + 30, 120, .5, .95), (244, 244, 246)))
    img = cylinder_object(img, cx, top, bot, r, ry, (246, 246, 248))
    half = r * np.sin(np.deg2rad(55))  # rótulo de 110°: corda = 2 r sen 55°
    quad = [(cx - half, 400), (cx + half, 400), (cx + half, 800), (cx - half, 800)]
    # inclinação: a boca é uma elipse de semi-eixo ry; o rótulo (400 px) curva na mesma medida
    return img, quad, None, "Caneca", "cylinder", {"arcDeg": 110, "tiltDepth": round(ry / 400 * 1.2, 3), "shadingStrength": .65}


def jar():
    h = w = S3
    img = room(h, w, (226, 218, 204), (120, 104, 92), .66)
    cx, top, bot, r, ry = 600, 380, 1000, 270, 34
    img = shadow(img, ellipse_pts(cx + 30, bot + 6, r * 1.12, ry * 1.5), 16, 4, 26, .5)
    img = cylinder_object(img, cx, top, bot, r, ry, (236, 238, 240), lid=90)
    half = r * np.sin(np.deg2rad(70))  # arco 140°
    quad = [(cx - half, 480), (cx + half, 480), (cx + half, 900), (cx - half, 900)]
    return img, quad, None, "Pote / Garrafa", "cylinder", {"arcDeg": 140, "tiltDepth": round(ry / 420 * 1.2, 3), "shadingStrength": .65}


def ball():
    h = w = S3
    img = room(h, w, (210, 222, 230), (150, 170, 150), .7)
    cx, cy, r = 600, 590, 330
    img = shadow(img, ellipse_pts(cx + 30, cy + r + 10, r * .95, r * .16), 10, 0, 30, .55)
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    dx, dy = (x - cx) / r, (y - cy) / r
    nz = np.sqrt(1 - np.clip(dx * dx + dy * dy, 0, 1))
    lam = np.clip(-.45 * dx - .55 * dy + .7 * nz, 0, 1)  # luz no alto à esquerda
    spec = np.exp(-(((dx + .38) ** 2 + (dy + .42) ** 2) / .03))
    shade = .38 + .62 * lam + .25 * spec
    img = paint(img, poly_mask(h, w, ellipse_pts(cx, cy, r, r, n=180)), np.asarray((240, 240, 236), np.float32)[None, None, :] * shade[..., None])
    half = r * np.sin(np.deg2rad(55))  # rótulo de 110° da esfera: raio na tela = r sen 55°
    quad = [(cx - half, cy - half), (cx + half, cy - half), (cx + half, cy + half), (cx - half, cy + half)]
    return img, quad, None, "Bola", "sphere", {"arcDeg": 110, "tiltDepth": 0, "shadingStrength": .6}


# dobras conhecidas (x na linha y=0, inclinação, σ, força): ecobag com 2 vincos verticais; camiseta com 3 dobras
ECOBAG_FOLDS = [(505, .04, 16, .38), (742, -.03, 20, .3)]
TSHIRT_FOLDS = [(300, .25, 30, .22), (900, -.25, 30, .2), (600, .05, 16, .18)]


def ecobag():
    h = w = S3
    img = room(h, w, (232, 228, 222), (196, 188, 178), .82)
    body = [(300, 360), (900, 360), (930, 1060), (270, 1060)]
    img = shadow(img, body, 24, 22, 26, .35)
    for hx in (450, 750):  # alças: meio anel de tecido
        handle = ellipse_pts(hx, 360, 95, 230, np.pi, 2 * np.pi, 64) + ellipse_pts(hx, 360, 70, 205, 2 * np.pi, np.pi, 64)
        img = paint(img, poly_mask(h, w, handle), (196, 176, 136))
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    weave = 1 + .035 * np.sin(x * 1.9) * np.sin(y * 1.9) + noise(h, w, 2, .07, rng3)
    lit = light(h, w, .4, .3, 1.1, .8, 1.0) * weave * fold_bands(h, w, ECOBAG_FOLDS)
    img = paint(img, poly_mask(h, w, body), np.asarray((226, 210, 174), np.float32)[None, None, :] * lit[..., None])
    quad = [(390, 500), (810, 500), (822, 960), (378, 960)]
    mesh = grid_mesh(quad, lambda i, j: (7 * np.sin(1.7 * j + i), 5 * np.sin(1.3 * i + .5 * j)))
    return img, quad, mesh, "Ecobag", "plane", {"shadingStrength": .75}


def tshirt():
    h = w = S3
    img = room(h, w, (200, 206, 214), (200, 206, 214), 1.0)
    shirt = [(430, 150), (520, 190), (600, 205), (680, 190), (770, 150), (1010, 260), (1090, 500), (930, 560),
             (900, 470), (910, 1100), (290, 1100), (300, 470), (270, 560), (110, 500), (190, 260)]
    img = shadow(img, shirt, 20, 24, 30, .3)
    y = np.mgrid[0:h, 0:w][0].astype(np.float32)
    knit = 1 + noise(h, w, 2, .05, rng3) + .02 * np.sin(y * 2.4)
    lit = light(h, w, .45, .25, 1.1, .8, 1.0) * knit * fold_bands(h, w, TSHIRT_FOLDS)
    img = paint(img, poly_mask(h, w, shirt), np.asarray((238, 238, 240), np.float32)[None, None, :] * lit[..., None])
    img = paint(img, poly_mask(h, w, ellipse_pts(600, 175, 95, 48)), (150, 152, 158))  # gola
    quad = [(425, 380), (775, 380), (785, 800), (415, 800)]
    mesh = grid_mesh(quad, lambda i, j: (6 * np.sin(2.1 * j + .7 * i), 4 * np.sin(1.1 * i + j)))
    return img, quad, mesh, "Camiseta", "plane", {"shadingStrength": .8}


TEMPLATES_3D = [("mug", mug), ("jar", jar), ("ball", ball), ("ecobag", ecobag), ("tshirt", tshirt)]


def main3d(out_dir):
    global rng3
    rng3 = np.random.default_rng(83)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    index = []
    for tid, fn in TEMPLATES_3D:
        arr, quad, mesh, name, shape, params = fn()
        img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        img.save(out / f"{tid}.webp", "WEBP", quality=90)
        thumb = img.copy()
        thumb.thumbnail((320, 320), Image.LANCZOS)
        thumb.save(out / f"{tid}_thumb.webp", "WEBP", quality=80)
        entry = {"id": tid, "name": name, "shape": shape, "file": f"{tid}.webp", "thumb": f"{tid}_thumb.webp",
                 "width": img.width, "height": img.height, "quad": [[round(float(x), 1), round(float(y), 1)] for x, y in quad]}
        if mesh:
            entry["mesh"] = [list(p) for p in mesh]
        entry.update({k: (round(float(v), 3) if isinstance(v, float) else v) for k, v in params.items()})
        index.append(entry)
        print(tid, img.size)
    (out / "index.json").write_text(json.dumps({"version": 1, "mockups": index}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "SOURCES.md").write_text(
        "# Origem dos templates de mockup 2.5D (TASK-08)\n\n"
        "Gerados proceduralmente por `tools/gen_mockups.py --3d` (numpy + Pillow, semente fixa 83, gerador próprio).\n"
        "Nenhum modelo generativo, foto ou asset de terceiros foi usado (nada do app de referência). Licença: do projeto.\n\n"
        "| id | forma | o que é |\n|---|---|---|\n"
        "| `mug` | cilindro (arco 110°) | caneca branca com alça, vista um pouco de cima |\n"
        "| `jar` | cilindro (arco 140°) | pote/garrafa com tampa escura |\n"
        "| `ball` | esfera | bola clara com luz no alto à esquerda |\n"
        "| `ecobag` | plano com malha 4×4 | sacola de tecido com 2 vincos verticais (`ECOBAG_FOLDS`) |\n"
        "| `tshirt` | plano com malha 4×4 | camiseta clara com 3 dobras (`TSHIRT_FOLDS`) |\n\n"
        "Lidos só pelo estúdio \"📦 Mockup 3D\" do editor. Não entram em `../mockups/index.json` (fluxo Kotlin, só planos).\n",
        encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--3d":
        main3d(sys.argv[2] if len(sys.argv) > 2 else "app/src/main/assets/content/mockups3d")
    else:
        main(sys.argv[1] if len(sys.argv) > 1 else "app/src/main/assets/content/mockups")
