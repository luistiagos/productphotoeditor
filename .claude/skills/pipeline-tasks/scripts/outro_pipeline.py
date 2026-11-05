"""Sai 1 se outro pipeline COM RODIZIO DE CONTAS tem execucao aberta nesta maquina (DESIGN.md secao 3, item 2).

O arquivo de credenciais e a guarda de contas sao da maquina e o motor nao coordena dois vigias de cota: este
projeto e o retrobatnew com `rodizio_contas: true` nunca podem rodar ao mesmo tempo. "Execucao aberta" e a mesma
regra do motor (`pipeline.py::run_open`): algum item fora de TERMINAL, ou a finalizacao rodando.

    python -I outro_pipeline.py [state.json ...]     # padrao: o ledger do retrobatnew
"""
import json
import sys
from pathlib import Path

TERMINAL = ("retest", "documentado", "open-falhou")      # pipeline.py::TERMINAL
PADRAO = [Path(r"C:\projects\retrobatnew\.bugfix-pipeline\state.json")]


def aberta(st: dict) -> list[str]:
    vivos = [f"{s} ({b['state']})" for s, b in st.get("bugs", {}).items() if b.get("state") not in TERMINAL]
    if (st.get("final") or {}).get("state") == "rodando":
        vivos.append("finalizacao rodando")
    return vivos


def main(argv: list[str]) -> int:
    rc = 0
    for p in [Path(a) for a in argv] or PADRAO:
        if not p.is_file():
            print(f"[--] {p}: sem ledger")
            continue
        try:
            st = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:      # gravacao em curso do outro helper: na duvida, ocupado
            print(f"[OCUPADO?] {p}: ilegivel agora ({e}); repita")
            rc = 1
            continue
        vivos = aberta(st)
        if vivos:
            print(f"[OCUPADO] {p}: execucao {st.get('run_id')} aberta: {', '.join(vivos[:6])}"
                  + (f" (+{len(vivos) - 6})" if len(vivos) > 6 else ""))
            rc = 1
        else:
            print(f"[LIVRE] {p}: execucao {st.get('run_id')} fechada")
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
