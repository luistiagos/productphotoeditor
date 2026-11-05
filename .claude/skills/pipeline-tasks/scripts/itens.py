"""Monta a lista de itens (tasks e/ou bugs) para `pipeline.py init --bugs` (DESIGN.md secao 4, task 3).

So exclusoes MECANICAS, como o Passo 3 do maestro da skill-fonte; diagnostico e do planning. Le os docs NA BASE
(`origin/main`): e de la que as lanes partem. Todo item vai com `tipo` bug: no motor, "bug" = doc com ciclo de
pasta open -> retest, que e o ciclo das tasks daqui (o `tipo` task do motor e outro modelo; DESIGN secao 2).

    python -I itens.py [todos|tasks|bugs] [--incluir <nome>]... [--excluir <nome>]... [--saida <arquivo>] [--sem-fetch]

`<nome>` = nome do arquivo sem `.md` (ex.: 05-qrcode-vetorial-offline-e-tabelas-no-canvas). Grava
`<pasta do pipeline>\\bugs-<AAAAMMDD-HHMM>.json` e imprime o caminho na ultima linha.
"""
import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

PASTAS = {"bugs": "docs/bugs/open", "tasks": "docs/tasks/open"}
SKILL = Path(__file__).resolve().parents[1]
MOTOR = SKILL.parent / "pipeline-correcao-bugs" / "projeto.json"


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    p = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, encoding="utf-8",
                       errors="replace")
    if check and p.returncode:
        raise SystemExit(f"ERRO: git {' '.join(args)}: {p.stderr.strip()}")
    return p


def titulo(texto: str, padrao: str) -> str:
    m = re.search(r"^#\s+(.+?)\s*$", texto, re.M)
    return m.group(1) if m else padrao


def veredito_anterior(texto: str) -> str | None:
    """Ultimo veredito do pipeline no doc, se nao for `corrigir` (o item ja foi documentado), ou 'bloqueio'."""
    vs = re.findall(r"^\*\*Veredito:\*\*\s*([a-z-]+)", texto, re.M)
    if vs and vs[-1] != "corrigir":
        return vs[-1]
    if re.search(r"^## Bloqueio", texto, re.M):
        return "bloqueio"
    return None


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("modo", nargs="?", default="todos", choices=("todos", "tasks", "bugs"))
    ap.add_argument("--incluir", action="append", default=[], help="inclui mesmo com veredito anterior")
    ap.add_argument("--excluir", action="append", default=[], help="tira da lista (motivo: pedido do dono)")
    ap.add_argument("--saida", type=Path)
    ap.add_argument("--sem-fetch", action="store_true")
    a = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # titulos com acento no console do Windows

    cfg = json.loads(MOTOR.read_text(encoding="utf-8"))
    repo = Path(git(SKILL, "rev-parse", "--show-toplevel").stdout.strip())
    base = cfg["base"]
    pipe = (repo / cfg.get("raiz", ".") / cfg["pipe_dir"]).resolve() if cfg.get("pipe_dir") \
        else repo.parent / f".bugfix-pipeline-{repo.name}"
    if not a.sem_fetch:
        git(repo, "fetch", "-q", cfg.get("remoto", "origin"))

    itens, excl = [], []
    for tipo, pasta in PASTAS.items():
        if a.modo not in ("todos", tipo):
            continue
        na_base = git(repo, "ls-tree", "--name-only", f"{base}:{pasta}", check=False)
        nomes_base = {n for n in na_base.stdout.splitlines() if n.endswith(".md")} if not na_base.returncode else set()
        locais = {p.name for p in (repo / pasta).glob("*.md")} if (repo / pasta).is_dir() else set()
        for nome in sorted((nomes_base | locais) - {"README.md"}):
            doc, stem = f"{pasta}/{nome}", nome[:-3]
            if stem in a.excluir:
                excl.append({"doc": doc, "reason": "excluido pelo dono"})
                continue
            if nome not in nomes_base:
                excl.append({"doc": doc, "reason": f"ausente na base {base} (nao commitado ou nao publicado)"})
                continue
            if git(repo, "status", "--porcelain", "--", doc).stdout.strip():
                excl.append({"doc": doc, "reason": "sujo na arvore principal (outra sessao esta nele)"})
                continue
            texto = git(repo, "show", f"{base}:{doc}").stdout
            v = veredito_anterior(texto)
            if v and stem not in a.incluir:
                excl.append({"doc": doc, "reason": f"veredito anterior `{v}` (inclua com --incluir {stem} se mudou)"})
                continue
            slug = f"task-{stem}" if tipo == "tasks" else stem
            itens.append({"slug": slug, "doc": doc, "title": titulo(texto, stem), "tipo": "bug",
                          "origem": tipo})

    pipe.mkdir(parents=True, exist_ok=True)
    out = a.saida or pipe / f"bugs-{dt.datetime.now():%Y%m%d-%H%M}.json"
    out.write_text(json.dumps({"bugs": itens, "excluded": excl}, ensure_ascii=False, indent=2), encoding="utf-8")
    for i in itens:
        print(f"[ENTRA]  {i['origem']:<5} {i['slug']}  —  {i['title']}")
    for e in excl:
        print(f"[FORA]   {e['doc']}: {e['reason']}")
    n_t = sum(i["origem"] == "tasks" for i in itens)
    print(f"\n{len(itens)} item(ns): {n_t} task(s), {len(itens) - n_t} bug(s); {len(excl)} excluido(s). "
          f"Custo: 3 sessoes Opus por item (planning, dev, teste), mais retomadas.")
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
