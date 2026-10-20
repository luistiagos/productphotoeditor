"""Converte um componente ONNX do Stable Diffusion (UNet, text encoder, VAE) para fp16 num .onnx único (ARQUITETURA §27.7).

Uso: python -P -E tools/sd_fp16.py <entrada.onnx> <saida.onnx>
Entradas e saídas do grafo ficam em fp32 (`keep_io_types=True`), sem otimizador de fusão: só ops padrão, para rodar em
qualquer EP. A paridade fp32 × fp16 com entrada real fica no tools/sd_ref.py.
O `convert_float_to_float16` com caminho faz a inferência de formas num NamedTemporaryFile aberto, que o Windows não deixa
reabrir; por isso a inferência roda aqui (`infer_shapes_path`, que aceita > 2 GB) e o conversor recebe o ModelProto.
"""
import hashlib
import sys
from pathlib import Path

import onnx
from onnxruntime.transformers.float16 import convert_float_to_float16

PROTOBUF_LIMIT = 2**31


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def topo_sort(graph):
    """Reordena os nós em ordem topológica estável: o conversor anexa os Cast que cria (entradas do grafo, `scales` do
    Resize) no fim da lista, e o checker do onnx exige a ordem. Os grafos do SD não têm subgrafos (If/Loop)."""
    ready = {""} | {i.name for i in graph.input} | {t.name for t in graph.initializer}
    pending = list(graph.node)
    ordered = []
    while pending:
        rest = []
        for n in pending:
            if all(i in ready for i in n.input):
                ordered.append(n)
                ready.update(n.output)
            else:
                rest.append(n)
        if len(rest) == len(pending):
            raise SystemExit(f"ciclo ou entrada ausente em {rest[0].name}")
        pending = rest
    del graph.node[:]
    graph.node.extend(ordered)


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    # ao lado da entrada, para os dados externos (`model.onnx_data`) resolverem pelo caminho relativo
    shapes = src.with_name(src.stem + ".shapes.onnx")
    onnx.shape_inference.infer_shapes_path(str(src), str(shapes))
    try:
        model = onnx.load(str(shapes), load_external_data=True)
    finally:
        shapes.unlink()
    model = convert_float_to_float16(model, keep_io_types=True, disable_shape_infer=True)
    topo_sort(model.graph)
    if model.ByteSize() >= PROTOBUF_LIMIT:
        raise SystemExit(f"{model.ByteSize()} B não cabe num .onnx único")
    dst.parent.mkdir(parents=True, exist_ok=True)
    onnx.save_model(model, str(dst), save_as_external_data=False)
    onnx.checker.check_model(str(dst))
    print(f"{dst}: {dst.stat().st_size} B sha256 {sha256(dst)}")
    print("I/O:", [(i.name, i.type.tensor_type.elem_type) for i in model.graph.input],
          [(o.name, o.type.tensor_type.elem_type) for o in model.graph.output])


if __name__ == "__main__":
    main()
