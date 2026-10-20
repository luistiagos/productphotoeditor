"""Grava os pesos de um .onnx em dados externos (`<saida>.data` ao lado) com offsets alinhados a 64 KiB (ARQUITETURA §27.7).

Uso: python -P -E tools/onnx_external.py <entrada.onnx> <saida.onnx>
O ORT mapeia em memória (`MapFileIntoMemory`) os dados externos com offset alinhado à página, em vez de copiá-los para o
heap; o `onnx.save_model(save_as_external_data=True)` não alinha. 64 KiB cobre página de 4/16 KiB (Android) e a
granularidade do Windows. Initializers abaixo de 1 KiB ficam no proto.
"""
import sys
from pathlib import Path

import onnx
from onnx.external_data_helper import set_external_data

ALIGN = 1 << 16
MIN_BYTES = 1024


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    model = onnx.load(str(src), load_external_data=True)
    data = dst.with_name(dst.name + ".data")
    dst.parent.mkdir(parents=True, exist_ok=True)
    moved = 0
    with data.open("wb") as f:
        for t in model.graph.initializer:
            if not t.HasField("raw_data") or len(t.raw_data) < MIN_BYTES:
                continue
            f.write(b"\0" * (-f.tell() % ALIGN))
            offset = f.tell()
            f.write(t.raw_data)
            set_external_data(t, data.name, offset, len(t.raw_data))
            t.ClearField("raw_data")
            moved += 1
    onnx.save_model(model, str(dst), save_as_external_data=False)
    onnx.checker.check_model(str(dst))
    print(f"{dst}: {dst.stat().st_size} B; {data.name}: {data.stat().st_size} B; {moved} initializers externos")


if __name__ == "__main__":
    main()
