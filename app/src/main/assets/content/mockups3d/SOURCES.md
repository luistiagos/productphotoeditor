# Origem dos templates de mockup 2.5D (TASK-08)

Gerados proceduralmente por `tools/gen_mockups.py --3d` (numpy + Pillow, semente fixa 83, gerador próprio).
Nenhum modelo generativo, foto ou asset de terceiros foi usado (nada do app de referência). Licença: do projeto.

| id | forma | o que é |
|---|---|---|
| `mug` | cilindro (arco 110°) | caneca branca com alça, vista um pouco de cima |
| `jar` | cilindro (arco 140°) | pote/garrafa com tampa escura |
| `ball` | esfera | bola clara com luz no alto à esquerda |
| `ecobag` | plano com malha 4×4 | sacola de tecido com 2 vincos verticais (`ECOBAG_FOLDS`) |
| `tshirt` | plano com malha 4×4 | camiseta clara com 3 dobras (`TSHIRT_FOLDS`) |

Lidos só pelo estúdio "📦 Mockup 3D" do editor. Não entram em `../mockups/index.json` (fluxo Kotlin, só planos).
