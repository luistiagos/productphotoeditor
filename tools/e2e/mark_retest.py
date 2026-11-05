"""Marca uma task como Retest no README de docs/tasks/open (status e links open/ -> retest/). Uso: python mark_retest.py 03"""
import re, sys, pathlib
n = sys.argv[1]
p = pathlib.Path(__file__).resolve().parents[2] / 'docs/tasks/open/README.md'
s = p.read_text(encoding='utf-8')
s = re.sub(rf'docs/tasks/open/({n}-[^)\s]+\.md)', r'docs/tasks/retest/\1', s)
s = re.sub(rf'(\| \*\*TASK-{n}\*\* \|[^\n]*?)⚪ \*\*Aberta\*\*', r'\1🟡 **Retest**', s)
s = re.sub(rf'(\[`TASK-{n}`\]\([^)]+\)) —', r'\1 *(Em Retest)* —', s)
p.write_text(s, encoding='utf-8')
