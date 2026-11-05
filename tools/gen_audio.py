"""Trilhas de fundo do vídeo (TASK-04): loops curtos sintetizados aqui, sem amostra de terceiros.

Gera app/src/main/assets/content/audio/<id>.wav (mono, 22 050 Hz, 16 bit) + audio/index.json.
Cada trilha tem um número inteiro de compassos, então repete sem emenda (o vídeo usa a trilha em loop).
Uso: python tools/gen_audio.py
"""
import json
import wave
from pathlib import Path

import numpy as np

SR = 22050
OUT = Path(__file__).resolve().parent.parent / 'app/src/main/assets/content/audio'
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, attack=0.005, decay=0.25):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / max(decay, 1e-3))


def tone(freq, dur, kind='sine', decay=0.3, attack=0.005):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * freq * t
    if kind == 'sine':
        w = np.sin(ph)
    elif kind == 'saw':
        w = sum(np.sin(k * ph) / k for k in range(1, 9)) * 0.6
    elif kind == 'square':
        w = sum(np.sin(k * ph) / k for k in range(1, 10, 2)) * 0.8
    elif kind == 'epiano':  # sino suave + leve tremolo
        w = (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3.01 * ph)) * (1 + 0.15 * np.sin(2 * np.pi * 5 * t))
    else:
        raise ValueError(kind)
    return w * env(n, attack, decay)


def kick(dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 50 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def snare(dur=0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return (rng.uniform(-1, 1, n) * 0.7 + 0.3 * np.sin(2 * np.pi * 190 * t)) * np.exp(-t * 22)


def hat(dur=0.06):
    n = int(dur * SR)
    noise = rng.uniform(-1, 1, n)
    noise = np.diff(noise, prepend=0)  # passa-alta tosco
    return noise * np.exp(-np.arange(n) / SR * 70)


def place(buf, sound, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sound))
    buf[i:j] += sound[: j - i] * gain


def chord(root, quality='maj'):
    return [root, root + (4 if quality == 'maj' else 3), root + 7]


def track_upbeat():
    bpm, bars = 120, 4
    beat = 60 / bpm
    buf = np.zeros(int(bars * 4 * beat * SR))
    prog = [(60, 'maj'), (67, 'maj'), (69, 'min'), (65, 'maj')]  # C G Am F
    for b, (root, q) in enumerate(prog):
        t0 = b * 4 * beat
        for k in range(4):
            place(buf, kick(), t0 + k * beat, 0.9)
            if k % 2 == 1:
                place(buf, snare(), t0 + k * beat, 0.45)
        for k in range(8):
            place(buf, hat(), t0 + k * beat / 2, 0.25 if k % 2 else 0.15)
        for k in (0, 1.5, 2, 3.5):  # baixo sincopado
            place(buf, tone(midi(root - 24), beat * 0.45, 'square', 0.18), t0 + k * beat, 0.35)
        for k in (0.5, 1.5, 2.5, 3.5):  # acordes no contratempo
            for n in chord(root, q):
                place(buf, tone(midi(n), beat * 0.3, 'saw', 0.12), t0 + k * beat, 0.09)
    return buf


def track_eletronico():
    bpm, bars = 128, 4
    beat = 60 / bpm
    buf = np.zeros(int(bars * 4 * beat * SR))
    prog = [(57, 'min'), (53, 'maj'), (60, 'maj'), (55, 'maj')]  # Am F C G
    for b, (root, q) in enumerate(prog):
        t0 = b * 4 * beat
        notes = chord(root, q) + [root + 12]
        for k in range(4):
            place(buf, kick(0.3), t0 + k * beat, 1.0)
            place(buf, hat(0.05), t0 + k * beat + beat / 2, 0.3)
        for k in range(16):  # arpejo em semicolcheias
            n = notes[k % len(notes)]
            place(buf, tone(midi(n + 12), beat / 4, 'saw', 0.07), t0 + k * beat / 4, 0.12)
        place(buf, tone(midi(root - 24), 4 * beat, 'saw', 1.2, attack=0.02), t0, 0.22)
    return buf


def track_lofi():
    bpm, bars = 80, 2
    beat = 60 / bpm
    buf = np.zeros(int(bars * 4 * beat * SR))
    prog = [(62, [0, 3, 7, 10]), (67, [0, 4, 7, 10]), (60, [0, 4, 7, 11]), (57, [0, 3, 7, 10])]  # Dm7 G7 Cmaj7 Am7
    for b, (root, iv) in enumerate(prog):
        t0 = b * 2 * beat
        for n in iv:
            place(buf, tone(midi(root + n), 2 * beat, 'epiano', 0.9, attack=0.01), t0, 0.12)
        place(buf, kick(0.4), t0, 0.6)
        place(buf, snare(0.18), t0 + beat, 0.25)
        for k in range(4):
            place(buf, hat(0.04), t0 + k * beat / 2 + 0.03, 0.1)
    buf += rng.normal(0, 0.006, len(buf))  # chiado de vinil
    return buf


def track_impacto():
    bpm, bars = 100, 4
    beat = 60 / bpm
    buf = np.zeros(int(bars * 4 * beat * SR))
    prog = [(52, 'min'), (48, 'maj'), (55, 'maj'), (50, 'maj')]  # Em C G D
    for b, (root, q) in enumerate(prog):
        t0 = b * 4 * beat
        place(buf, kick(0.5), t0, 1.0)
        place(buf, kick(0.5), t0 + 1.5 * beat, 0.8)
        place(buf, snare(0.3), t0 + beat, 0.6)
        place(buf, snare(0.3), t0 + 3 * beat, 0.6)
        for k in (0, 2):  # metais (saw) em bloco
            for n in chord(root + 12, q):
                place(buf, tone(midi(n), beat * 0.9, 'saw', 0.35, attack=0.02), t0 + k * beat, 0.08)
        for k in range(8):
            place(buf, hat(), t0 + k * beat / 2, 0.18)
        place(buf, tone(midi(root - 12), 4 * beat, 'square', 1.5), t0, 0.2)
    return buf


TRACKS = [
    ('upbeat', 'Batida Comercial Upbeat', 'Varejo / Moda', track_upbeat),
    ('eletronico', 'Eletrônico Dinâmico', 'Tech / Oferta relâmpago', track_eletronico),
    ('lofi', 'Lo-Fi Elegante', 'Cosméticos / Joias / Decoração', track_lofi),
    ('impacto', 'Impacto Promocional', 'Varejo / Supermercado', track_impacto),
]


def write_wav(path, x):
    x = x / max(1e-9, np.max(np.abs(x))) * 0.85
    pcm = (x * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for tid, name, mood, fn in TRACKS:
        buf = fn()
        write_wav(OUT / f'{tid}.wav', buf)
        index.append({'id': tid, 'name': name, 'mood': mood, 'file': f'audio/{tid}.wav',
                      'duration': round(len(buf) / SR, 2)})
    (OUT / 'index.json').write_text(json.dumps({'tracks': index}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(index)} trilhas em {OUT}')


if __name__ == '__main__':
    main()
