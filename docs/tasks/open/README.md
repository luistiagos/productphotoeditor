# Tasks Abertas — Evolução do Editor de Anúncios (`product_photo_offline`)

> **Origem:** Análise comparativa entre o app `com.desygner.ads` (Online Ads / Automo v6.4.5.1) e o nosso projeto [`product_photo_offline`](file:///c:/projects/sandbox/product_photo_offline/HANDOFF_APP_OFFLINE.md).  
> **Diretriz Legal e Arquitetural:** Todas as funcionalidades são especificadas para implementação **100% própria do zero** em TypeScript (`editor-web/`) e Kotlin (`:editor`, `:feature:mockup`), funcionando offline no dispositivo (conforme [`HANDOFF_APP_OFFLINE.md`](file:///c:/projects/sandbox/product_photo_offline/HANDOFF_APP_OFFLINE.md)).

---

## Matriz Geral de Tasks e Esforço Mensurado

| ID | Documento da Task | Status | Prioridade | Esforço Mensurado | Horas / Story Points | Módulo Principal |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **TASK-01** | [Smart Guides (Snapping Magnético), Alinhamento/Distribuição Múltipla e Zonas Seguras (Reels/Stories/Sangria)](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/01-smart-guides-alinhamento-safe-zones.md) | 🟡 **Retest** | **Alta (Quick Win — P1)** | **Baixo** | ~1 a 2 dias (12h–16h / **3 SP**) | `editor-web` (`snapping.ts`, `overlays.ts`) |
| **TASK-02** | [Tipografia Avançada de Oferta (Tachado, Marca-Texto, Caixa, Sombra) e 14 Estilos de Text Warp](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/02-tipografia-oferta-e-text-warp-14-estilos.md) | 🟡 **Retest** | **Alta (Quick Win — P1)** | **Baixo a Médio** | ~2 a 3 dias (16h–24h / **5 SP**) | `editor-web` (`curve.ts`, `editor.ts`, `main.ts`) |
| **TASK-03** | [Conta-Gotas (Eyedropper com Lupa no Canvas), Paleta do Documento e Verificador de Contraste WCAG](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/03-eyedropper-paleta-documento-contraste-wcag.md) | 🟡 **Retest** | **Alta (Quick Win — P1)** | **Baixo** | ~1 dia (6h–8h / **2 SP**) | `editor-web` (`eyedropper.ts`, `dom.ts`, `main.ts`) |
| **TASK-04** | [Estúdio de Vídeo Completo: Seletor de Áudio/Música, Animações Entrada/Ênfase/Saída e Exportação GIF](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/04-seletor-audio-musica-animacoes-e-webcodecs-video.md) | 🟡 **Retest** | **Alta (Quick Win Áudio — P1)** | **Baixo a Médio** | ~2 a 3 dias (16h–24h / **5 SP**) *(Áudio UI: ~0,5–1 dia / 2 SP)* | `editor-web` (`VideoPreview.ts`, `FfmpegCommandBuilder.ts`) + `:editor` |
| **TASK-05** | [Gerador de QR Code Vetorial 100% Offline (Link, WhatsApp, PIX) e Tabelas de Preço/Medidas no Canvas](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/05-qrcode-vetorial-offline-e-tabelas-no-canvas.md) | 🟡 **Retest** | **Média (P1/P2)** | **Médio** | ~2 a 3 dias (16h–22h / **5 SP**) | `editor-web` (`qrcode.ts`, `table.ts`) |
| **TASK-06** | [Molduras de Recorte (Clip Frames), Imagem em Texto/Forma e Operações Booleanas (Pathfinder)](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/06-molduras-clip-frames-e-operacoes-booleanas.md) | ⚪ **Aberta** | **Média (P2)** | **Médio** | ~3 a 4 dias (24h–32h / **5 a 8 SP**) | `editor-web` (`clipFrames.ts`, `pathBoolean.ts`) |
| **TASK-07** | [Modos de Mesclagem (16 Blend Modes), Nitidez, Temperatura e Duotone com Brand Kit](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/07-filtros-efeitos-avancados-blend-modes-e-retoque-borda.md) | ⚪ **Aberta** | **Média (P2)** | **Baixo a Médio** | ~1 a 1,5 dia (8h–10h / **3 SP**) | `editor-web` (`imageFilters.ts`) |
| **TASK-08** | [Motor de Mockup 2.5D (Plano com Malha, Cilindro, Esfera), Fusão de Luz/Dobras e Estúdio de Mockup](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao.md) | ⚪ **Aberta** | **Média-Alta (P1/P2)** | **Médio-Alto** | ~3 dias (22h–26h / **5 a 8 SP**) | `editor-web` (`mockup/mockupEngine.ts`, `mockup/mockupStudio.ts`) + `tools/gen_mockups.py` |
| **TASK-09** | [Projetos Multi-Páginas (Carrossel / Catálogo), Magic Resize Multi-Formato e Transferência de Estilo de Fundo](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/09-multi-paginas-carrossel-magic-resize-e-bg-style-transfer.md) | 🟡 **Retest** | **Média-Alta (P2)** | **Médio-Alto** | ~4 a 5 dias (32h–40h / **8 SP**) | `editor-web` (`document.ts`, `magicResize.ts`, `bgStyleTransfer.ts`) |
| **TASK-10** | [Data Merge (Geração de Anúncios em Lote por Variáveis de Catálogo) e Exportação Batch (ZIP / WebP / PDF)](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/10-data-merge-geracao-em-lote-catalogo-e-exportacao-batch.md) | ⚪ **Aberta** | **Média-Alta (P2)** | **Médio-Alto** | ~4 a 5 dias (32h–40h / **8 SP**) | `editor-web` (`dataMerge.ts`) + `:editor` (`EditorExports.kt`) |
| **TASK-11** | [Troca Rápida de Imagem (Swap), Agrupamento (Group/Ungroup), Gestão Avançada de Camadas e Inspetor Numérico](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/11-troca-rapida-imagem-agrupamento-bloqueio-camadas-e-inspetor-numerico.md) | 🟡 **Retest** | **Alta (Quick Win — P1)** | **Baixo a Médio** | ~1,5 a 2 dias (12h–16h / **3 SP**) | `editor-web` (`editor.ts`, `main.ts`, `document.ts`) |
| **TASK-12** | [Editor de Gradientes Multi-Stop, Contornos Tracejados, Raio de Canto e Conectores de Infográfico ("Raio-X")](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/12-editor-gradientes-contornos-tracejados-cantos-e-conectores-infografico.md) | 🟡 **Retest** | **Média-Alta (P1/P2)** | **Médio** | ~2 a 3 dias (16h–22h / **5 SP**) | `editor-web` (`gradients.ts`, `connectors.ts`, `editor.ts`) |
| **TASK-13** | [Zoom e Pan por Pinça (Multi-Touch), Grade/Guias Manuais e Simulador de Preview (Instagram / Mercado Livre)](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/13-zoom-pan-pinch-reguas-grade-e-simulador-preview-anuncio.md) | 🟡 **Retest** | **Média (P2)** | **Baixo a Médio** | ~1,5 a 2 dias (12h–16h / **3 SP**) | `editor-web` (`viewportZoom.ts`, `adPreview.ts`, `overlays.ts`) |
| **TASK-14** | [Listas de Benefícios (Bullets/Checklists), Localizar e Substituir no Anúncio e Desenho Vetorial à Mão Livre](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/14-listas-formatadas-localizar-substituir-e-desenho-vetorial-livre.md) | 🟡 **Retest** | **Média (P2)** | **Baixo** | ~1 a 1,5 dia (8h–12h / **2 SP**) | `editor-web` (`textTools.ts`, `editor.ts`, `main.ts`) |
| **TASK-15** | [Preencher Texto com Foto (Text Image Fill)](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/15-preencher-texto-com-foto.md) — *dividida da TASK-06* | ⚪ **Aberta** | **Média (P2)** | **Baixo** | ~0,5 a 1 dia (4h–6h / **1 a 2 SP**) | `editor-web` (`textImageFill.ts`) |
| **TASK-16** | [Pathfinder: Operações Booleanas de Formas (Unir, Subtrair, Interseção, Vazado)](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/16-pathfinder-operacoes-booleanas-de-formas.md) — *dividida da TASK-06* | ⚪ **Aberta** | **Média (P2)** | **Médio** | ~1,5 a 2 dias (10h–14h / **3 a 5 SP**) | `editor-web` (`pathBoolean.ts`) |
| **TASK-17** | [Vinheta, Borda Suave e Desfoque de Foco (Bokeh Radial / Tilt-Shift)](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/17-vinheta-borda-suave-e-desfoque-de-foco.md) — *dividida da TASK-07; depende da TASK-07* | ⚪ **Aberta** | **Média (P2)** | **Médio** | ~1,5 dia (10h–12h / **3 SP**) | `editor-web` (`imageFilters.ts`, filtros GLSL + 2D) |
| **TASK-18** | [Retocar Recorte depois de Remover o Fundo (Pincel Apagar / Restaurar)](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/18-retocar-recorte-pos-remocao-de-fundo.md) — *dividida da TASK-07* | ⚪ **Aberta** | **Média (P2)** | **Médio** | ~1,5 dia (10h–12h / **3 SP**) | `editor-web` (`refineCutout.ts`) + `:editor` (`putImage`) |
| **TASK-19** | [Mockup: Caixa 3D Multi-Face](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/19-mockup-caixa-3d-multi-face.md) — *dividida da TASK-08; depende da TASK-08* | ⚪ **Aberta** | **Média-Alta (P1/P2)** | **Baixo a Médio** | ~1 dia (7h–8h / **2 a 3 SP**) | `editor-web` (`mockup/box3d.ts`) |
| **TASK-20** | [Mockup em Foto Própria com "🎯 Detectar Superfície" (Sobel / Alpha)](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/20-mockup-detectar-superficie-em-foto-propria.md) — *dividida da TASK-08; depende da TASK-08* | ⚪ **Aberta** | **Média-Alta (P1/P2)** | **Baixo a Médio** | ~1 a 1,5 dia (8h–11h / **3 SP**) | `editor-web` (`mockup/surfaceDetector.ts`) |

---

## Ordem de Execução Sugerida (Sprints)

1. **Sprint 1 — Quick Wins de Conversão e Usabilidade (Esforço Total: ~6 a 8 dias):**
   - [`TASK-01`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/01-smart-guides-alinhamento-safe-zones.md) *(Em Retest)* — Smart Guides + Alinhar/Distribuir + Safe Zones de Reels/Stories
   - [`TASK-02`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/02-tipografia-oferta-e-text-warp-14-estilos.md) *(Em Retest)* — Tachado *"De/Por"*, Marca-Texto, Caixa `Aa`, Sombra completa e 14 estilos de Text Warp
   - [`TASK-03`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/03-eyedropper-paleta-documento-contraste-wcag.md) *(Em Retest)* — Conta-Gotas com lupa + Cores no anúncio + Contraste WCAG
   - [`TASK-11`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/11-troca-rapida-imagem-agrupamento-bloqueio-camadas-e-inspetor-numerico.md) *(Em Retest)* — Troca Rápida de Imagem (Swap), Agrupar/Desagrupar (`Group`), Cadeado real em Camadas e Inspetor Numérico
   - [`TASK-04`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/04-seletor-audio-musica-animacoes-e-webcodecs-video.md) *(Em Retest)* — Seletor de Música/Áudio no Vídeo + Animações Entrada/Ênfase/Saída + GIF
2. **Sprint 2 — Elementos Comerciais, Gradientes, Infográficos e Retoque (Esforço Total: ~12 a 15 dias):**
   - [`TASK-12`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/12-editor-gradientes-contornos-tracejados-cantos-e-conectores-infografico.md) *(Em Retest)* — Editor de Gradientes Multi-Stop + Contornos Tracejados/Cantos + Conectores de Infográfico ("Raio-X")
   - [`TASK-14`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/14-listas-formatadas-localizar-substituir-e-desenho-vetorial-livre.md) *(Em Retest)* — Listas de Benefícios (Bullets/Checklists), Localizar/Substituir e Desenho à Mão Livre
   - [`TASK-05`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/05-qrcode-vetorial-offline-e-tabelas-no-canvas.md) *(Em Retest)* — QR Code Offline PIX/WhatsApp + Tabelas de Medidas/Preços
   - [`TASK-06`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/06-molduras-clip-frames-e-operacoes-booleanas.md) — Molduras de Forma/Texto + Operações Booleanas Pathfinder
   - [`TASK-07`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/07-filtros-efeitos-avancados-blend-modes-e-retoque-borda.md) — 16 Blend Modes, Nitidez, Temperatura e Duotone da marca
   - [`TASK-15`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/15-preencher-texto-com-foto.md) — Foto dentro do texto *(dividida da TASK-06)*
   - [`TASK-16`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/16-pathfinder-operacoes-booleanas-de-formas.md) — Pathfinder: Unir/Subtrair/Interseção/Vazado *(dividida da TASK-06)*
   - [`TASK-17`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/17-vinheta-borda-suave-e-desfoque-de-foco.md) — Vinheta, Borda Suave e Desfoque de foco *(dividida da TASK-07; depois da TASK-07)*
   - [`TASK-18`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/18-retocar-recorte-pos-remocao-de-fundo.md) — Retocar recorte pós-remoção de fundo *(dividida da TASK-07)*
3. **Sprint 3 — Navegação Pro, Mockups 2.5D/3D e Automação em Escala (Esforço Total: ~14 a 17 dias):**
   - [`TASK-13`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/13-zoom-pan-pinch-reguas-grade-e-simulador-preview-anuncio.md) *(Em Retest)* — Zoom/Pan por Pinça + Grade Regra dos Terços + Simulador de Preview (Instagram/Mercado Livre)
   - [`TASK-08`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/08-mockup-25d-3d-cilindro-esfera-cubo-sobel-iluminacao.md) — Mockup 2.5D: Cilindro, Esfera, Plano com malha, Fusão de luz/dobras e Estúdio
   - [`TASK-19`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/19-mockup-caixa-3d-multi-face.md) — Mockup Caixa 3D multi-face *(dividida da TASK-08; depois da TASK-08)*
   - [`TASK-20`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/20-mockup-detectar-superficie-em-foto-propria.md) — Mockup em foto própria + Detectar superfície *(dividida da TASK-08; depois da TASK-08)*
   - [`TASK-09`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/retest/09-multi-paginas-carrossel-magic-resize-e-bg-style-transfer.md) *(Em Retest)* — Multi-Páginas Carrossel + Magic Resize Multi-Formato + Background Style Transfer
   - [`TASK-10`](file:///c:/projects/sandbox/product_photo_offline/docs/tasks/open/10-data-merge-geracao-em-lote-catalogo-e-exportacao-batch.md) — Data Merge de Catálogo/Preços + Exportação Lote / WebP / PDF com Sangria

---

## Passagem de bastão — implementação das tasks abertas (atualizado 2026-11-05)

Pedido do dono: implementar **cada** task de `open/`, cada uma testada **ponta a ponta no emulador Android**.

**Feito (em `retest/`, com registro analítico + provas na §5 de cada doc):**
- TASK-03 — conta-gotas com lupa, paleta "Cores neste anúncio"/recentes, contraste WCAG: vitest + E2E **19/19**.
- TASK-11 — substituir foto, agrupar/desagrupar, cadeado real nas Camadas, inspetor numérico: vitest + E2E **25/25**.
- TASK-04 — Entrada/Ênfase/Saída + easing, música de fundo (4 trilhas sintéticas + `pickAudio`), GIF no export, pacote do
  vídeo refeito: vitest 114/114, Kotlin 15/15, E2E emulador **26/26** + codificação real no moto g86 **14/14**
  (`task04_encode.mjs`; o ffmpeg-kit não tem x86_64 → `docs/bugs/done/video-ffmpegkit-sem-x86_64.md`, não corrigir).
- TASK-12 — degradê multi-stop (forma/texto/fundo), borda tracejada/pontilhada, cantos, trocar forma, setas/cotas e blocos
  "Raio-X": vitest **139/139**, E2E emulador **40/40** (`task12.mjs`); regressão task03 19/19 e task11 25/25. Achado: spec
  gravada no objeto não pode ter campo `type` com nome de classe do Fabric (revive vira `Gradient`) → `GradientSpec.kind`.
- TASK-14 — ☰ Lista (5 estilos + limpar), 🔍 Localizar e substituir (camadas e grupos, 1 undo), ✍️ Desenhar à mão
  (4 canetas, traços = camadas "Traço à mão"): vitest **161/161**, E2E **50/50** no emulador e no moto (`task14.mjs`);
  regressão task12 40/40, task03 19/19, task11 25/25. Corrigido de quebra: `refitCurve` deslocava Textbox dentro de
  Group (`getCenterPoint` de cena × `setPositionByOrigin` relativo).
- Nada foi commitado (o dono não pediu). A árvore também tem as mudanças não commitadas das TASK-01/02 (anteriores).

**Ferramentas de E2E criadas (`tools/e2e/`):**
- `cdp.mjs` — driver pelo DevTools do WebView (CDP): `launchEditor()` (força-para o app, "Novo design → Post Facebook"
  pelo uiautomator), `evaluate`, `waitFor`, `tap(seletor, texto)`, `touch`, `drag`, `pinch`, `screencap`, `reporter`.
  Toques são reais (`Input.dispatchTouchEvent` → pointer events no WebView).
- `rebuild.sh` — `npm run build` + `:app:assembleDebug` + `adb install -r` (~25 s). `mark_retest.py NN` — status no README.
- `task03.mjs`, `task11.mjs`, `task04.mjs`, `task04_encode.mjs` (só arm64) — cenários (rodar com `ANDROID_SERIAL=emulator-5554 node tools/e2e/taskNN.mjs <pasta-prints>`).

**Ambiente (pegadinhas):**
- AVD `pp_api34` (`D:/DevCaches/Android/Sdk/emulator/emulator.exe -avd pp_api34 -no-snapshot-save`); caiu uma vez junto com
  o daemon do adb — conferir `adb devices` antes de cada lote. O moto g86 também aparece no adb: sempre `ANDROID_SERIAL`.
- Armazenamento: o APK tem ~300 MB; o emulador estava sem espaço. Revertidas atualizações da Play Store de apps alheios
  (`pm uninstall-system-updates`); se faltar de novo, `adb shell df -h /data`.
- Galeria: `/sdcard/Pictures/e2e_swap.jpg` é a foto mais recente (o 1º item do seletor); SVG na galeria quebra o
  `pickImage` (`docs/bugs/open/editor-galeria-svg-pickimage.md`).
- Digitar num `<input>` abre o teclado e o layout se mexe: depois de `blur()`, esperar `innerHeight` voltar antes de tocar.
- O snapping magnético (TASK-01) desloca arrastos em até 6 px de tela: tolerância nos testes.
- `uiFind/uiTap` (exportados) casam `text` **ou** `content-desc`. Um seletor de arquivos deixado aberto prende a tarefa do
  app: `am force-stop com.google.android.documentsui` antes do `launchEditor`.
- Moto g86 (arm64) autorizado pelo dono para E2E de vídeo; abrir pelo formato "Post Instagram" (o "Post Facebook" fica
  fora da tela sem rolar). Apagar os exports de teste depois.
- AVD degradado (ANR de systemui/launcher/system, `uiautomator` "null root node", load > 8 → `launchEditor` falha em
  "Novo design"): `adb reboot` não basta; `adb -s emulator-5554 emu kill` + subir com `-no-snapshot-save
  -no-snapshot-load`. `launchEditor` aceita `E2E_FORMAT` (no moto: `E2E_FORMAT="Post Instagram"`).
- Teclado: depois de `blur()` esperar a folha parar de mexer, não só `innerHeight` (toque perdido → task11 intermitente).
- Mídia no WebView: o asset loader não atende Range (`<audio>` sem seek) e `blob:` é recusado em `<audio>/<video>`.

**Próximo passo exato:** TASK-05 (`open/05-qrcode-vetorial-offline-e-tabelas-no-canvas.md`), depois 06, 07, 13, 08,
09, 10. Para cada uma: ler o doc, abrir os símbolos citados, gravar a §5
(analítica) no doc **antes** de editar, implementar, `npx tsc --noEmit` + `npx vitest run`, `tools/e2e/rebuild.sh`,
escrever `tools/e2e/taskNN.mjs` e rodar até passar, registrar as provas, `mv` para `retest/` e `python
tools/e2e/mark_retest.py NN` (o doc é não versionado: `mv`, não `git mv -k`, que pula calado). `r.done()` não encerra o
processo: terminar o cenário com `p.close()`. Cortar a sessão a cada 1–2 tasks (contexto ~150–200K).
