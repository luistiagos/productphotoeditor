"""Apoio ao CompositorHarness (ajuste visual do LocalSceneComposer no desktop).

  python tools/harness.py prep <dir> <produto_rgba.png> [alturaRel]   # gera .raw + jobs.txt (1 caso por cenário)
  ./gradlew :core:imaging:testDebugUnitTest --tests "*CompositorHarness*" -PharnessDir=<dir>
  python tools/harness.py png <dir>                                    # out_*.raw -> out_*.png
"""
import json, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image

SCENES = Path(__file__).resolve().parent.parent / "app/src/main/assets/content/scenes"

def to_raw(img, path):
    a = np.asarray(img.convert("RGBA"), np.uint32)
    argb = (a[..., 3] << 24) | (a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2]
    with open(path, "wb") as f:
        f.write(struct.pack(">ii", img.width, img.height)); f.write(argb.astype(">u4").tobytes())

def from_raw(path):
    b = Path(path).read_bytes(); w, h = struct.unpack(">ii", b[:8])
    a = np.frombuffer(b, ">u4", offset=8).reshape(h, w)
    rgb = np.stack([(a >> 16) & 255, (a >> 8) & 255, a & 255], -1).astype(np.uint8)
    return Image.fromarray(rgb)

def prep(d, product, rel="0.25"):
    d = Path(d); d.mkdir(parents=True, exist_ok=True)
    name = Path(product).stem
    to_raw(Image.open(product), d / f"{name}.raw")
    jobs = []
    for s in json.loads((SCENES / "index.json").read_text())["scenes"]:
        to_raw(Image.open(SCENES / s["file"]), d / f"{s['id']}.raw")
        m = s["meta"]
        jobs.append(f"out_{name}_{s['id']}.raw;{name}.raw;{s['id']}.raw;{m['floorY']};{m['lightDirDeg']};"
                    f"{m['lightElevationDeg']};{m['shadowSoftness']};{m['colorTempK']};{rel}")
    (d / "jobs.txt").write_text("\n".join(jobs))

def png(d):
    for f in Path(d).glob("out_*.raw"):
        from_raw(f).save(f.with_suffix(".png"))

if __name__ == "__main__":
    {"prep": prep, "png": png}[sys.argv[1]](*sys.argv[2:])
