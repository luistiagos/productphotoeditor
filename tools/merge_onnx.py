"""Junta um .onnx com pesos em dados externos (.data ao lado) num .onnx único (ARQUITETURA §20.3).

Uso: python tools/merge_onnx.py <entrada.onnx> <saida.onnx>
Requer onnx; com onnxruntime instalado, confere que entrada e saída dão o mesmo resultado numa entrada aleatória.
O catálogo de modelos lida com um arquivo por modelo, por isso o Real-ESRGAN do pacote da Qualcomm passa por aqui.
"""
import hashlib
import sys
from pathlib import Path

import numpy as np
import onnx


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def same_output(a: Path, b: Path) -> float:
    """Diferença absoluta máxima entre as saídas dos dois modelos para a mesma entrada aleatória."""
    import onnxruntime as ort

    sa = ort.InferenceSession(str(a), providers=["CPUExecutionProvider"])
    sb = ort.InferenceSession(str(b), providers=["CPUExecutionProvider"])
    feeds = {}
    rng = np.random.default_rng(1)
    for i in sa.get_inputs():
        shape = [d if isinstance(d, int) else 1 for d in i.shape]
        if i.type == "tensor(uint8)":
            feeds[i.name] = rng.integers(0, 256, shape, dtype=np.uint8)
        else:
            feeds[i.name] = rng.random(shape, dtype=np.float32)
    oa = sa.run(None, feeds)
    ob = sb.run(None, feeds)
    return max(float(np.max(np.abs(x.astype(np.float64) - y.astype(np.float64)))) for x, y in zip(oa, ob))


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    model = onnx.load(str(src), load_external_data=True)
    onnx.checker.check_model(model)
    dst.parent.mkdir(parents=True, exist_ok=True)
    onnx.save_model(model, str(dst), save_as_external_data=False)
    onnx.checker.check_model(str(dst))
    for t in onnx.load(str(dst), load_external_data=False).graph.initializer:
        if t.data_location == onnx.TensorProto.EXTERNAL:
            raise SystemExit(f"{t.name} ainda é externo")
    print(f"{dst}: {dst.stat().st_size} B sha256 {sha256(dst)}")
    print("I/O:", [(i.name, i.type.tensor_type.elem_type) for i in model.graph.input],
          [(o.name, o.type.tensor_type.elem_type) for o in model.graph.output])
    try:
        print("diferença máxima entrada × saída:", same_output(src, dst))
    except ImportError:
        print("onnxruntime ausente: conferência de saída pulada")


if __name__ == "__main__":
    main()
