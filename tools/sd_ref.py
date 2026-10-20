"""Referência do LCM Dreamshaper v7 no ORT do PC: tokenizer CLIP + text encoder + 4 passos LCM + VAE (ARQUITETURA §27.7).

Uso: python -P -E tools/sd_ref.py <pasta_hex> <pasta_fp16> <saida> [--tiny <unet_tiny.onnx>] [--prompt "..."] [--seed N]
<pasta_hex>: download do TheyCallMeHex/LCM-Dreamshaper-V7-ONNX (fp32); <pasta_fp16>: `lcmds7_{unet,text_encoder,
vae_decoder}.onnx` do tools/sd_fp16.py. Gera um 512² em fp32 e em fp16 com a mesma seed (`ref_fp32.png`, `ref_fp16.png`)
e grava as entradas fixas da sonda (`DeviceProbe#sdUnet`) em .bin f32 little-endian:
`latent.bin` 1×4×64×64, `ehs.bin` 1×77×768 (prompt real), `tcond.bin` 1×256, e as saídas do UNet no 1º passo
(t = 999): `out_lcmds7_fp32.bin`, `out_lcmds7_fp16.bin` e, com --tiny, `out_tinysd.bin`. `ids.txt` tem os ids do prompt.
Fórmulas: scheduling_lcm.py e pipeline_latent_consistency_text2img.py do diffusers v0.30.0 (§27.7).
"""
import argparse
import html
import json
import re
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

BOS, EOS, MAX_LEN = 49406, 49407, 77
VAE_SCALE = 0.18215
GUIDANCE = 8.5  # padrão do pipeline LCM; w = guidance − 1
STEPS = 4
ORIGINAL_STEPS = 50
TIMESTEP_SCALING = 10.0
PAT = re.compile(r"<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|[^\W\d_]+|\d|(?:[^\s\w]|_)+", re.IGNORECASE)


def bytes_to_unicode():
    """Tabela byte → caractere do BPE do GPT-2/CLIP."""
    bs = list(range(ord("!"), ord("~") + 1)) + list(range(ord("¡"), ord("¬") + 1)) + list(range(ord("®"), ord("ÿ") + 1))
    cs = bs[:]
    n = 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    return dict(zip(bs, map(chr, cs)))


class ClipTokenizer:
    """BPE do CLIP a partir de vocab.json/merges.txt. Sem ftfy: só html.unescape, espaços e minúsculas; os grupos
    \\p{L}/\\p{N} do original viram [^\\W\\d_] e \\d (iguais para prompts em inglês)."""

    def __init__(self, vocab: Path, merges: Path):
        self.encoder = json.loads(vocab.read_text(encoding="utf-8"))
        lines = merges.read_text(encoding="utf-8").strip().split("\n")[1:49152 - 256 - 2 + 1]
        self.ranks = {tuple(m.split()): i for i, m in enumerate(lines)}
        self.byte_encoder = bytes_to_unicode()

    def bpe(self, token: str) -> list[str]:
        word = list(token[:-1]) + [token[-1] + "</w>"]
        while len(word) > 1:
            pairs = [(word[i], word[i + 1]) for i in range(len(word) - 1)]
            best = min(pairs, key=lambda p: self.ranks.get(p, float("inf")))
            if best not in self.ranks:
                break
            merged, i = [], 0
            while i < len(word):
                if i < len(word) - 1 and (word[i], word[i + 1]) == best:
                    merged.append(word[i] + word[i + 1])
                    i += 2
                else:
                    merged.append(word[i])
                    i += 1
            word = merged
        return word

    def encode(self, text: str) -> list[int]:
        text = re.sub(r"\s+", " ", html.unescape(html.unescape(text))).strip().lower()
        ids = []
        for tok in PAT.findall(text):
            tok = "".join(self.byte_encoder[b] for b in tok.encode("utf-8"))
            ids.extend(self.encoder[p] for p in self.bpe(tok))
        ids = [BOS] + ids[:MAX_LEN - 2] + [EOS]
        return ids + [EOS] * (MAX_LEN - len(ids))


def alphas_cumprod() -> np.ndarray:
    betas = np.linspace(0.00085 ** 0.5, 0.012 ** 0.5, 1000, dtype=np.float64) ** 2
    return np.cumprod(1.0 - betas)


def lcm_timesteps(n: int) -> list[int]:
    """v0.30: índices por linspace sobre a grade de 50 passos de destilação, invertida."""
    k = 1000 // ORIGINAL_STEPS
    origin = (np.arange(1, ORIGINAL_STEPS + 1) * k - 1)[::-1]
    idx = np.floor(np.linspace(0, len(origin), num=n, endpoint=False)).astype(np.int64)
    return [int(t) for t in origin[idx]]


def guidance_embedding(w: float, dim: int = 256) -> np.ndarray:
    half = dim // 2
    emb = np.exp(np.arange(half, dtype=np.float32) * -(np.log(10000.0) / (half - 1))).astype(np.float32)
    x = np.float32(w * 1000.0) * emb
    return np.concatenate([np.sin(x), np.cos(x)])[None, :].astype(np.float32)


def session(path: Path) -> ort.InferenceSession:
    return ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])


def generate(unet: Path, vae: Path, ehs: np.ndarray, tcond: np.ndarray, seed: int):
    """4 passos LCM + VAE. Devolve (imagem uint8 HWC, out_sample do 1º passo, ms do UNet por passo, ms do VAE)."""
    rng = np.random.default_rng(seed)
    x = rng.standard_normal((1, 4, 64, 64), dtype=np.float32)
    ac = alphas_cumprod()
    ts = lcm_timesteps(STEPS)
    s = session(unet)
    first, ms = None, []
    for i, t in enumerate(ts):
        t0 = time.perf_counter()
        eps = s.run(None, {"sample": x, "timestep": np.array([t], np.int64), "encoder_hidden_states": ehs,
                           "timestep_cond": tcond})[0]
        ms.append((time.perf_counter() - t0) * 1000)
        if first is None:
            first = eps
        a_t = ac[t]
        a_prev = ac[ts[i + 1]] if i + 1 < len(ts) else 1.0
        st = t * TIMESTEP_SCALING
        c_skip = 0.25 / (st ** 2 + 0.25)
        c_out = st / (st ** 2 + 0.25) ** 0.5
        x0 = (x - np.sqrt(1 - a_t) * eps) / np.sqrt(a_t)
        denoised = c_out * x0 + c_skip * x
        if i + 1 < len(ts):
            x = (np.sqrt(a_prev) * denoised + np.sqrt(1 - a_prev) * rng.standard_normal(x.shape)).astype(np.float32)
        else:
            x = denoised.astype(np.float32)
    del s
    t0 = time.perf_counter()
    img = session(vae).run(None, {"latent_sample": (x / VAE_SCALE).astype(np.float32)})[0]
    vae_ms = (time.perf_counter() - t0) * 1000
    rgb = (np.clip(img[0] / 2 + 0.5, 0, 1).transpose(1, 2, 0) * 255).round().astype(np.uint8)
    return rgb, first, ms, vae_ms


def diff(a: np.ndarray, b: np.ndarray) -> str:
    d = np.abs(a.astype(np.float64) - b.astype(np.float64))
    return f"máx {d.max():.4g}, média {d.mean():.4g}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("hex", type=Path)
    ap.add_argument("fp16", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--tiny", type=Path)
    ap.add_argument("--prompt", default="professional product photo of a white ceramic coffee mug on a wooden table, "
                                         "soft studio lighting, high detail")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)

    tok = ClipTokenizer(a.hex / "tokenizer/vocab.json", a.hex / "tokenizer/merges.txt")
    ids = np.array([tok.encode(a.prompt)], np.int32)
    (a.out / "ids.txt").write_text(a.prompt + "\n" + " ".join(map(str, ids[0])) + "\n", encoding="utf-8")
    print("ids:", ids[0][:24].tolist(), "…")
    print("timesteps:", lcm_timesteps(STEPS))
    tcond = guidance_embedding(GUIDANCE - 1)

    variants = {
        "fp32": (a.hex / "text_encoder/model.onnx", a.hex / "unet/model.onnx", a.hex / "vae_decoder/model.onnx"),
        "fp16": (a.fp16 / "lcmds7_text_encoder.onnx", a.fp16 / "lcmds7_unet.onnx", a.fp16 / "lcmds7_vae_decoder.onnx"),
    }
    res = {}
    for name, (te, unet, vae) in variants.items():
        t0 = time.perf_counter()
        ehs = session(te).run(None, {"input_ids": ids})[0]
        te_ms = (time.perf_counter() - t0) * 1000
        rgb, first, ms, vae_ms = generate(unet, vae, ehs, tcond, a.seed)
        res[name] = (ehs, rgb, first)
        Image.fromarray(rgb).save(a.out / f"ref_{name}.png")
        print(f"{name}: text encoder {te_ms:.0f} ms; UNet {', '.join(f'{m:.0f}' for m in ms)} ms; VAE {vae_ms:.0f} ms; "
              f"NaN {[bool(np.isnan(v).any()) for v in (ehs, first, rgb)]}; média RGB {rgb.mean():.1f}, desvio {rgb.std():.1f}")
    ehs32 = res["fp32"][0]
    print("ehs fp32×fp16:", diff(ehs32, res["fp16"][0]), f"(faixa fp32 {ehs32.min():.3g}..{ehs32.max():.3g})")
    print("out_sample 1º passo fp32×fp16 (ehs de cada um):", diff(res["fp32"][2], res["fp16"][2]))
    print("imagem fp32×fp16 (0–255):", diff(res["fp32"][1], res["fp16"][1]))

    # entradas fixas da sonda: latente da seed, ehs do fp32, tcond; saída de referência com essas mesmas entradas
    latent = np.random.default_rng(a.seed).standard_normal((1, 4, 64, 64), dtype=np.float32)
    latent.astype("<f4").tofile(a.out / "latent.bin")
    ehs32.astype("<f4").tofile(a.out / "ehs.bin")
    tcond.astype("<f4").tofile(a.out / "tcond.bin")
    feeds = {"sample": latent, "timestep": np.array([999], np.int64), "encoder_hidden_states": ehs32, "timestep_cond": tcond}
    for name, (_, unet, _) in variants.items():
        session(unet).run(None, feeds)[0].astype("<f4").tofile(a.out / f"out_lcmds7_{name}.bin")
    if a.tiny:
        s = session(a.tiny)
        t0 = time.perf_counter()
        out = s.run(None, {"sample": latent, "timestep": np.array([999.0], np.float32), "encoder_hidden_states": ehs32})[0]
        print(f"tiny-sd: UNet {(time.perf_counter() - t0) * 1000:.0f} ms (1ª rodada), NaN {bool(np.isnan(out).any())}")
        out.astype("<f4").tofile(a.out / "out_tinysd.bin")
    o32 = np.fromfile(a.out / "out_lcmds7_fp32.bin", "<f4")
    o16 = np.fromfile(a.out / "out_lcmds7_fp16.bin", "<f4")
    print("out_sample referência da sonda fp32×fp16 (mesmas entradas):", diff(o32, o16), f"(faixa {o32.min():.3g}..{o32.max():.3g})")


if __name__ == "__main__":
    main()
