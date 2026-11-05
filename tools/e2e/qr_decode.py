# Le QR Code de imagens (PNG/JPG) com o OpenCV no PC: a "camera" do E2E da TASK-05.
# Uso: python tools/e2e/qr_decode.py [--pix] [--expect TEXTO] img1.png [img2.png ...]
#   imprime, por imagem, "<arquivo>\t<texto decodificado>" (vazio = nao leu);
#   --pix: confere o CRC16-CCITT (campo 63) do BR Code lido;  --expect: exige esse texto exato.
# Saida 0 = todas leram (e conferem); 1 = alguma falhou.  Python SEM -I (opencv no site do usuario).
import binascii
import sys

import cv2
import numpy as np


def decode(path):
    img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return ''
    # detector classico e, se nao ler, o baseado em ArUco (mais tolerante a localizadores estilizados)
    dets = [cv2.QRCodeDetector()] + ([cv2.QRCodeDetectorAruco()] if hasattr(cv2, 'QRCodeDetectorAruco') else [])
    # tentativas: original, com margem branca extra (QR encostado na borda) e reduzido (print grande do aparelho)
    cands = [img, cv2.copyMakeBorder(img, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=(255, 255, 255))]
    h, w = img.shape[:2]
    if max(h, w) > 1400:
        s = 1400 / max(h, w)
        cands.append(cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA))
    for det in dets:
        for c in cands:
            text, _, _ = det.detectAndDecode(c)
            if text:
                return text
    return ''


def pix_crc_ok(p):
    return len(p) > 8 and p[-8:-4] == '6304' and '%04X' % binascii.crc_hqx(p[:-4].encode('utf-8'), 0xFFFF) == p[-4:].upper()


def main(argv):
    pix = '--pix' in argv
    expect = None
    files = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--pix':
            pass
        elif a == '--expect':
            i += 1
            expect = argv[i]
        else:
            files.append(a)
        i += 1
    ok = bool(files)
    for f in files:
        t = decode(f)
        good = bool(t) and (expect is None or t == expect) and (not pix or pix_crc_ok(t))
        ok = ok and good
        extra = (' [crc ok]' if pix_crc_ok(t) else ' [crc ERRADO]') if pix and t else ''
        sys.stdout.buffer.write(f'{f}\t{t}{extra}\n'.encode('utf-8'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
