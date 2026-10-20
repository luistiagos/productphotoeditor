"""Gera os cenários de TESTE da fase 2 (procedurais, sem modelo generativo nem asset de terceiros).

Uso: python tools/gen_scenes.py <saida>   (ex.: app/src/main/assets/content/scenes)
Requer Pillow e numpy. Os cenários definitivos (fase 4) virão de SDXL/Flux local, ver ARQUITETURA §8.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

S = 1440
rng = np.random.default_rng(7)


def noise(h, w, scale, octaves=4):
    """Ruído de valor fractal 0..1."""
    out = np.zeros((h, w), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        gh, gw = max(2, int(h / scale) + 2), max(2, int(w / scale) + 2)
        grid = rng.random((gh, gw)).astype(np.float32)
        img = Image.fromarray((grid * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += np.asarray(img, np.float32) / 255 * amp
        total += amp
        amp *= 0.5
        scale /= 2
    return out / total


def vgrad(h, top, bottom):
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    g = np.asarray(top, np.float32) * (1 - t) + np.asarray(bottom, np.float32) * t
    return np.repeat(g, S, axis=1)


def vignette(img, strength=0.35):
    y, x = np.mgrid[0:S, 0:S].astype(np.float32) / S - 0.5
    v = 1 - strength * np.clip((x * x + y * y) * 2.2, 0, 1)
    return img * v[..., None]


def save(arr, path):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(path, "WEBP", quality=88, method=6)


def studio_white():
    floor_y = int(S * 0.62)
    img = np.zeros((S, S, 3), np.float32)
    img[:floor_y] = vgrad(floor_y, (236, 236, 238), (226, 226, 230))
    img[floor_y:] = vgrad(S - floor_y, (232, 232, 235), (246, 246, 248))
    # curva da parede para o chão (sweep)
    pil = Image.fromarray(img.astype(np.uint8)).filter(ImageFilter.GaussianBlur(40))
    return vignette(np.asarray(pil, np.float32), 0.18), floor_y / S


def wood_table():
    floor_y = int(S * 0.60)
    img = np.zeros((S, S, 3), np.float32)
    wall = vgrad(floor_y, (222, 206, 186), (200, 182, 160))
    wall *= (0.94 + 0.06 * noise(floor_y, S, 300))[..., None]
    img[:floor_y] = wall
    h = S - floor_y
    # tampo: veios esticados na horizontal, tábuas com juntas
    grain = noise(h, S // 8, 6, 5)
    grain = np.asarray(Image.fromarray((grain * 255).astype(np.uint8)).resize((S, h), Image.BICUBIC), np.float32) / 255
    base = np.asarray((150, 98, 58), np.float32)
    wood = base * (0.75 + 0.45 * grain[..., None])
    for k in range(1, 6):
        y = int(h * (k / 6) ** 1.6)
        wood[max(0, y - 1):y + 1] *= 0.7
    wood *= np.linspace(0.85, 1.08, h, dtype=np.float32)[:, None, None]
    img[floor_y:] = wood
    img[floor_y - 3:floor_y + 2] *= 0.82  # borda do tampo
    return vignette(img, 0.32), floor_y / S


def marble_counter():
    floor_y = int(S * 0.58)
    img = np.zeros((S, S, 3), np.float32)
    # fundo desfocado (parede verde-azulada com manchas de luz)
    wall = vgrad(floor_y, (120, 150, 146), (92, 118, 116))
    blobs = noise(floor_y, S, 260, 2)
    wall = wall * (0.8 + 0.4 * blobs[..., None])
    img[:floor_y] = np.asarray(Image.fromarray(np.clip(wall, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(18)), np.float32)
    h = S - floor_y
    turb = noise(h, S, 220, 6)
    y, x = np.mgrid[0:h, 0:S].astype(np.float32)
    s = np.abs(np.sin((x * 0.006 + y * 0.012 + turb * 9.0)))
    veins = 1 - 0.35 * np.clip(1 - s / 0.10, 0, 1)  # veios finos e escuros onde o seno cruza zero
    marble = np.asarray((236, 234, 230), np.float32) * veins[..., None]
    marble *= np.linspace(0.9, 1.05, h, dtype=np.float32)[:, None, None]
    img[floor_y:] = marble
    return vignette(img, 0.25), floor_y / S


def pastel_podium():
    img = vgrad(S, (246, 205, 205), (232, 178, 182))
    floor_y = int(S * 0.70)
    img[floor_y:] = vgrad(S - floor_y, (226, 170, 175), (238, 190, 194))
    cx, top, rx, ry, height = S // 2, int(S * 0.60), int(S * 0.27), int(S * 0.045), int(S * 0.14)
    y, x = np.mgrid[0:S, 0:S].astype(np.float32)
    side = (np.abs(x - cx) <= rx) & (y >= top) & (y <= top + height)
    shade = 0.82 + 0.18 * np.cos((x - cx) / rx * np.pi / 2)
    img[side] = (np.asarray((250, 238, 236), np.float32) * shade[..., None])[side]
    bottom = ((x - cx) / rx) ** 2 + ((y - top - height) / ry) ** 2 <= 1
    img[bottom & (y > top + height)] = (np.asarray((250, 238, 236), np.float32) * shade[..., None])[bottom & (y > top + height)]
    cap = ((x - cx) / rx) ** 2 + ((y - top) / ry) ** 2 <= 1
    img[cap] = (252, 246, 245)
    return vignette(img, 0.2), (top + ry * 0.2) / S


def dark_concrete():
    floor_y = int(S * 0.63)
    img = np.zeros((S, S, 3), np.float32)
    wall = np.full((floor_y, S, 3), 52, np.float32) * (0.85 + 0.3 * noise(floor_y, S, 90, 5))[..., None]
    img[:floor_y] = wall
    h = S - floor_y
    con = np.full((h, S, 3), 78, np.float32) * (0.8 + 0.4 * noise(h, S, 40, 6))[..., None]
    img[floor_y:] = con
    y, x = np.mgrid[0:S, 0:S].astype(np.float32)
    spot = np.exp(-(((x - S * 0.5) / (S * 0.32)) ** 2 + ((y - S * 0.55) / (S * 0.38)) ** 2))
    img *= (0.55 + 1.1 * spot)[..., None]
    img *= np.asarray((1.0, 0.98, 0.95), np.float32)
    return img, floor_y / S


SCENES = [
    # id, função, tags, luz (de onde vem, elevação, suavidade, K), distância do horizonte até a linha de apoio
    # (floorY = onde a base do produto encosta, no meio do tampo; não o horizonte)
    ("studio_white", studio_white, ["all", "cosmetics", "electronics", "fashion", "food", "home"], (120, 60, 0.7, 6000), 0.16),
    ("wood_table", wood_table, ["all", "food", "home", "cosmetics"], (140, 40, 0.35, 4200), 0.17),
    ("marble_counter", marble_counter, ["all", "cosmetics", "food", "home"], (45, 45, 0.45, 6200), 0.18),
    ("pastel_podium", pastel_podium, ["all", "cosmetics", "fashion", "electronics"], (110, 62, 0.5, 6500), 0.0),
    ("dark_concrete", dark_concrete, ["all", "electronics", "fashion"], (125, 50, 0.3, 5000), 0.15),
]


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    index = []
    for sid, fn, tags, (ld, el, soft, k), rest in SCENES:
        arr, horizon = fn()
        floor = horizon + rest
        save(arr, out / f"{sid}.webp")
        Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).resize((240, 240), Image.LANCZOS).save(
            out / f"{sid}_thumb.webp", "WEBP", quality=80)
        index.append({
            "id": sid, "file": f"{sid}.webp", "thumb": f"{sid}_thumb.webp", "tags": tags,
            "meta": {"floorY": round(floor, 4), "lightDirDeg": ld, "lightElevationDeg": el,
                     "shadowSoftness": soft, "colorTempK": k,
                     "placement": [0.25, round(floor - 0.40, 4), 0.75, round(floor, 4)]},
        })
        print(sid, "floorY", round(floor, 3))
    (out / "index.json").write_text(json.dumps({"version": 1, "scenes": index}, indent=2), encoding="utf-8")
    (out / "SOURCES.md").write_text(
        "# Origem dos cenários\n\n"
        "Cenários de TESTE da fase 2, gerados proceduralmente por `tools/gen_scenes.py` (numpy + Pillow,\n"
        "semente fixa 7). Nenhum modelo generativo, foto ou asset de terceiros foi usado.\n"
        "Os cenários definitivos (fase 4) virão de SDXL/Flux local; registrar aqui prompt, modelo e licença.\n",
        encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "app/src/main/assets/content/scenes")
