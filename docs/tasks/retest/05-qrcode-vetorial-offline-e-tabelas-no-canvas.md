# [TASK-05] Gerador de QR Code Vetorial 100% Offline (Link, WhatsApp, PIX) e Tabelas de Preço/Medidas no Canvas

## Status (pipeline 20261105-1638 — aprovado no teste rodada 2, 2026-11-05)

**Feito:** QR Code vetorial 100% offline (codificador próprio ISO/IEC 18004, modos Link / WhatsApp / PIX BR Code com
CRC16 / Wi-Fi, estilos de ponto e de canto, cor do kit, logo no centro com EC H, legenda), tabelas de medidas, calçados,
preços e comparativo no canvas (1 toque, folha de edição com grade de inputs, ± linha/coluna, 4 estilos), reedição pelo
"✏️ Editar…" mantendo posição/tamanho, persistência em `qrConfig`/`tableData`.

**Commits** (sobre `origin/main` @ `1fe6d08`): `8e696de` feat(editor) TASK-05 (código + bundle), `ecd114e` docs teste
rodada 1 reprovado (o script E2E quebrava na L49), `38e6fa6` feat(e2e) correção do `task05.mjs`, mais este commit de docs.

**Aparelho:** `emulator-5554` (sdk_gphone64_x86_64, API 34) — o Moto g86 estava em uso pelo dono nas duas rodadas.
APK do fix `20594dcd…a701` = `sha256sum` do `base.apk` instalado.

**Evidência** (`C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261105-1810-task-05-qrcode-vetorial-offline-e-tabelas-no-canvas\`):
- Offline: `tsc --noEmit` 0 erros; vitest 211/211 (base 161/161); unidade Gradle 199 (1 skip) / 0 falha, igual à base.
- Controle positivo (`base-1fe6d08.apk`): `task05.mjs` 0/1 — abas e API ausentes (`t2-base/`).
- **T2** (`fix-38e6fa6.apk`, script commitado): `task05.mjs` **39/39** (`t2-fix/task05-fix.txt`, prints `05-*`, PNGs
  decodificados pelo OpenCV — link, WhatsApp com pontos/cantos arredondados/legenda, PIX com `[crc ok]`, logo em H,
  reeditado com versão maior —, e o print da tela também decodifica).
- **T3:** `task12` 40/40, `task11` 25/25, `task14` 50/50, `task03` 19/19 (`t3/`).
- **T4:** logcat do PID 15638 (`t2-fix/logcat-pid15638.txt`): sem `FATAL`/`ANR`/erro de console do WebView; só o finalizer
  de `ai.onnxruntime.telemetry.HttpClient` (Kotlin, fora da task) e o aviso de seed do WebView, iguais na rodada 1.

**Falta para `done/`:** validação do dono no aparelho dele — ler os QR (link, WhatsApp, PIX no app do banco) com a câmera
real de um celular, inclusive impressos; modo avião de verdade; o modo Wi-Fi pela UI (coberto só por vitest e pela prova
offline do dev).

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-05` |
| **Prioridade** | **Média (P1/P2)** |
| **Esforço Mensurado** | **Médio** — **~2 a 3 dias úteis (16h–22h / 5 Story Points)** |
| **Escopo** | 100% Local (`editor-web` em TypeScript / SVG Vetorial no Fabric.js) |
| **Referência Analisada (`com.desygner.ads`)** | `extracted/assets/public/docs/create.md` (L1021–L1050: Tables, Charts & QR Code Generator) e `js_pretty/assets/shared-pdf-qr-poster-BWRAjQr6.js` |

### Detalhamento do Esforço por Subtarefa
1. **Codificador QR Code 100% Offline e Gerador de SVG Estilizado (`qrcode.ts`):** ~6h (codificação ISO/IEC 18004 com Reed-Solomon EC nível M/Q, estilos de módulos quadrados/arredondados/pontos, cores do Brand Kit e espaço central opcional para o logo da marca).
2. **Templates de Payload Brasileiros (Link da Loja, WhatsApp com mensagem pré-pronta, PIX Estático BRCode EMV, Wi-Fi):** ~4h.
3. **Construtor de Tabelas de Preço / Cardápio / Grade de Medidas no Canvas (`table.ts`):** ~6h (componente vetorial estruturado editável para tabelas de tamanhos P/M/G/GG ou lista de preços).
4. **Testes Unitários (Vitest) e Integração na UI (`main.ts`):** ~3h.

---

## 1. Contexto e Problema Atual

No Brasil, pequenos lojistas, restaurantes, prestadores de serviço e vendedores de e-commerce usam anúncios impressos (encartes, etiquetas, cartões de agradecimento *"Mimos"*, displays de balcão) e posts digitais que precisam de:
1. **QR Code integrado ao design:**
   - Para abrir direto o **WhatsApp da loja** já com a mensagem *"Olá! Vi o anúncio da promoção e quero pedir..."*;
   - Para pagar via **PIX (BRCode estático)** ou abrir o **link do catálogo / Shopee / Mercado Livre**;
   - Hoje o usuário precisaria sair do app, gerar um QR Code em algum site externo na internet (que muitas vezes coloca marca d'água ou expira), salvar como imagem de baixa resolução e importar da galeria.
2. **Tabelas de Medidas e Listas de Preços (Cardápios / Catálogos):**
   - Vendedores de moda/calçados precisam colocar a **Tabela de Medidas** (`P | M | G | GG` $\times$ `Tórax | Cintura | Comprimento`) na 2ª ou 3ª foto do anúncio do Mercado Livre/Shopee.
   - Comércios locais precisam montar listas alinhadas de produtos e preços (`Produto ...... R$ 19,90`). Alinhar dezenas de caixas de texto soltas na mão pelo celular é lento e propenso a erros.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Gerador de QR Code Vetorial Offline (`editor-web/src/qrcode.ts`)
Implementar geração 100% offline em TypeScript puro (sem chamadas de rede e sem dependências pesadas), produzindo uma string SVG limpa inserida no canvas via [`editor.addSvgString()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts):

1. **Modos de Conteúdo Rápido (Assistentes na Sheet `📱 QR Code`):**
   - **🔗 Link / Site / Loja:** URL qualquer (`https://...`). Se estiver no Brand Kit (`brandKit.profile.website`), já vem pré-preenchido!
   - **💬 WhatsApp Direto:** Pede o número (pré-preenchido de `brandKit.profile.phone`) e a mensagem opcional $\to$ monta automaticamente `https://wa.me/5511999999999?text=...` com `encodeURIComponent`.
   - **💠 PIX Copia e Cola / Chave PIX (BRCode EMVCo):**
     - Aceita colar um payload PIX pronto (`000201...`) **ou** digitar Chave PIX (CPF/CNPJ/E-mail/Telefone/Aleatória) + Nome do Recebedor + Cidade + Valor opcional, calculando o **CRC16-CCITT (`0x1021`)** localmente para gerar o payload EMV válido!
   - **📶 Wi-Fi para Clientes:** SSID + Senha + Tipo (`WPA`/`WEP`/`nopass`) $\to$ monta `WIFI:T:WPA;S:MinhaLoja;P:senha123;;`.
2. **Estilização Visual com Brand Kit:**
   - **Estilo dos Pontos (`dotStyle`):** `'square'` (clássico), `'rounded'` (quadrados arredondados modernos) ou `'dots'` (círculos).
   - **Estilo dos Cantos Localizadores (`eyeStyle`):** `'square'` ou `'rounded'`.
   - **Cores:** Cor dos módulos (padrão `#111111` ou `brandKit.colors.primary`) e Cor de fundo da moldura (padrão `#ffffff` com margem silenciosa *quiet zone* de 2 módulos para garantir leitura em qualquer câmera).
   - **Logo no Centro (Opcional):** Se o usuário marcar *"Incluir logo da marca no centro"* (e houver `brandKit.logoUrl`), usa nível de correção de erro **Alto (`H` — 30%)**, limpa a área central ($22\%$ da matriz) e posiciona o logo centralizado no grupo.
   - **Legenda Inferior (Callout Frame):** Opção de moldura com texto curto abaixo do QR (ex.: `"ESCANEIE PARA COMPRAR"`, `"CHAME NO WHATSAPP"`, `"PAGUE COM PIX"`).
3. **Re-edição no Canvas:**
   - Salvar os metadados do QR Code (`qrConfig: { kind, rawValue, dotStyle, fgColor, bgColor, label }`) em `CUSTOM_PROPERTIES` ([`document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts)).
   - Quando o usuário selecionar um objeto QR Code no canvas, `renderProps()` mostra o botão **"✏️ Editar QR Code"**, permitindo trocar o link/telefone sem perder a posição e o tamanho no anúncio!

### 2.2. Tabelas de Medidas e Listas de Preço no Canvas (`editor-web/src/table.ts`)
Criar um gerador e editor de tabelas vetoriais/grupos estruturados no Fabric.js:

1. **Templates Prontos de Tabela (1 Toque):**
   - **👕 Tabela de Medidas (Moda/Vestuário):** Cabeçalho `Tamanho | Largura | Comprimento` com linhas `P | 50 cm | 68 cm`, `M | 52 cm | 70 cm`, `G | 54 cm | 72 cm`, `GG | 56 cm | 74 cm`.
   - **👟 Tabela de Numeração (Calçados):** `Nº Brasil | Palmilha (cm)`.
   - **📋 Lista de Preços / Cardápio (2 Colunas):** `Item / Serviço` alinhado à esquerda e `R$ Preço` alinhado à direita com linha pontilhada ou zebra alternada.
   - **⚖️ Comparativo ("Nosso Produto vs. Comum"):** 3 colunas destacando os diferenciais do produto anunciado.
2. **Edição Simples em Sheet Mobile:**
   - Como editar células minúsculas direto no canvas pelo celular é ruim para o toque, ao selecionar a tabela e tocar em **"✏️ Editar Tabela"** (ou dar toque longo), abre uma sheet modal confortável com:
     - Botões `+ Linha`, `- Linha`, `+ Coluna`, `- Coluna`;
     - Grade de inputs HTML `<input type="text">` para editar rapidamente os valores de cada célula;
     - Seletor de Estilo Visual: **Cabeçalho Destacado** (usa `brandKit.colors.primary`), **Linhas Zebradas** (alternadas), **Grade Completa** ou **Minimalista (apenas linhas horizontais)**.
   - Ao tocar em **"Aplicar"**, reconstrói o grupo vetorial (`Group` do Fabric contendo os `Rect` de células/bordas e os `FabricText` alinhados), mantendo a posição `(left, top)` e escala no canvas, e salva os dados brutos em `tableData` dentro de `CUSTOM_PROPERTIES`.

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/qrcode.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/qrcode.ts) | **Criar** | Codificador QR Code 100% offline (matriz booleana + Reed-Solomon), gerador de payload WhatsApp/PIX EMV (com CRC16)/Wi-Fi e renderizador SVG estilizado (`square`, `rounded`, `dots`). |
| [`editor-web/src/table.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/table.ts) | **Criar** | Construtor e atualizador de Tabelas e Listas de Preços no Fabric.js a partir de `TableData { rows: string[][], style, headerBg, textColor, borderColor }`. |
| [`editor-web/src/document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts) | **Modificar** | Adicionar `'qrConfig'` e `'tableData'` em `CUSTOM_PROPERTIES`. |
| [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) | **Modificar** | Adicionar métodos `upsertQrCode(config, existingObj?)` e `upsertTable(data, existingObj?)`. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Adicionar acesso a **📱 QR Code** e **📊 Tabela / Preços** (na barra de abas ou dentro de `Formas`/`Texto`), além dos botões `"✏️ Editar QR Code"` e `"✏️ Editar Tabela"` em `renderProps()`. |
| [`editor-web/test/qrcode.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/qrcode.test.ts) | **Criar** | Testes unitários validando a geração da matriz QR, o cálculo do CRC16 do payload PIX EMV, links de WhatsApp e renderização SVG. |
| [`editor-web/test/table.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/table.test.ts) | **Criar** | Testes unitários validando o cálculo de largura de colunas, altura de linhas e serialização de `TableData`. |

---

## 4. Critérios de Aceite e Verificação

- [ ] Mesmo com o celular em **Modo Avião (100% offline)**, o usuário consegue gerar um QR Code para Site, WhatsApp ou PIX que é lido instantaneamente pelo app de câmera do celular ou app de banco.
- [ ] O QR Code gerado é 100% vetorial (SVG), permitindo ampliar para impressão sem perder nitidez e personalizar com as cores do Brand Kit e estilos de pontos (`Quadrado`, `Arredondado`, `Pontos`).
- [ ] Ao tocar em um QR Code ou Tabela já inseridos no canvas, o botão **"✏️ Editar..."** reabre os dados atuais permitindo alterá-los sem perder a posição/tamanho do elemento.
- [ ] O usuário consegue inserir uma **Tabela de Medidas** ou **Lista de Preços** com 1 toque, editar as células na sheet e aplicar as cores do Brand Kit.
- [ ] `npx vitest run` e `npm run build` executam com 0 erros.

---

## Planejamento (pipeline 20261105-1638, 2026-11-05)

**Veredito:** corrigir — a funcionalidade (QR Code vetorial offline + tabelas editáveis) não existe no editor e cabe
inteira em `editor-web/` (TypeScript puro, sem dependência nova, sem Kotlin, sem ponte).
**Complexidade:** media — um módulo (`editor-web`), vários arquivos e dois fluxos novos de UI; sem Kotlin, sem ponte
WebView↔Kotlin; os dados persistidos (`qrConfig`, `tableData`) seguem o padrão já existente de `connectorSpec`
(propriedade própria no `toObject`, sem mudar `DOC_VERSION`).
**Severidade:** medio — funcionalidade ausente com contorno (gerar o QR num site e importar da galeria; montar a tabela
com caixas de texto soltas).
**Tamanho estimado:** ~1.300 linhas de produção (codificador QR ~350, payloads ~120, SVG ~120, `table.ts` ~250,
`editor.ts` ~100, `main.ts` ~350) + ~400 de vitest + ~250 do E2E. Abaixo do teto de ~1.500 linhas de produção do
manual. **Se o dev passar do teto**, a divisão natural é TASK-05a (QR: §2.1) e TASK-05b (tabelas: §2.2) — as duas
metades não compartilham código além de `document.ts`/`main.ts`.

**Arquivos a alterar (reserva da onda):**
- `editor-web/src/qrcode.ts` — **novo**: codificador QR (ISO/IEC 18004, modo byte, versões 1–40, EC L/M/Q/H,
  Reed-Solomon GF(256), 8 máscaras + penalidade, informação de formato e de versão ≥ 7) e o renderizador SVG estilizado.
- `editor-web/src/qrPayloads.ts` — **novo**: link, WhatsApp (`wa.me`), PIX estático (BRCode EMV + CRC16), Wi-Fi.
- `editor-web/src/table.ts` — **novo**: `TableData`, templates, operações de linha/coluna e o layout (medida de texto
  injetada) que monta o `Group` do Fabric.
- `editor-web/src/document.ts` — `'qrConfig'` e `'tableData'` em `CUSTOM_PROPERTIES`.
- `editor-web/src/editor.ts` — `qrConfigOf`, `upsertQrCode`, `tableDataOf`, `upsertTable`.
- `editor-web/src/main.ts` — abas `📱 QR Code` e `📊 Tabela`, folhas de criação/edição, ramos no `renderProps`, gancho
  de teste do brand kit.
- `editor-web/src/styles.css` — grade de inputs da folha de tabela e prévia do QR.
- `editor-web/test/qrcode.test.ts`, `editor-web/test/qrPayloads.test.ts`, `editor-web/test/table.test.ts` — **novos**.
- `editor-web/test/qr-reference.json` — **novo**: matrizes de referência geradas fora do app (receita abaixo).
- `editor/src/main/assets/editor/index.html` — bundle regerado (arrastado por qualquer mudança em `editor-web/`; os
  `assets/index-<hash>.*` entram por `claim` na hora, como manda o manual).
- `tools/e2e/task05.mjs` — **novo**: E2E da task. `tools/e2e/qr_decode.py` — **novo**: decodifica PNG com OpenCV no PC.

### Causa raiz (símbolos abertos: `arquivo::simbolo` — faz X; em erro, Y)

Não há defeito: é funcionalidade ausente. Conferência do plano do autor contra o código (base `0d616c3`):

- `grep -rni "qr\|tableData\|upsertTable" editor-web/src editor-web/test tools/e2e` → nenhuma ocorrência de QR/tabela
  (só `Math.sqrt`/`SQRT1_2`): a funcionalidade não existe.
- `editor-web/src/editor.ts::addSvgString(svg, name, place?)` (L366) — `loadSVGFromString` + `addSvgObjects`; devolve
  `Promise<FabricObject>`. Em erro: `loadSVGFromString` rejeita; SVG sem elementos válidos → `throw new Error('SVG
  vazio')`. **Pegadinha:** `addSvgObjects` usa `util.groupSVGElements`, que com **um único** elemento devolve o próprio
  elemento, não um `Group` — o SVG do QR deve ter ≥ 2 elementos (fundo `<rect>` + `<path>` dos módulos) para virar
  `Group`. Sem `place`, o grupo vai para 35% do menor lado da página, centralizado; com `place`, ocupa o retângulo do
  objeto dado.
- `editor-web/node_modules/fabric/dist/index.mjs::svgValidTagNames` (L4212) — o parser aceita `path, circle, polygon,
  polyline, ellipse, rect, line, image, text`; ignora o que estiver dentro de `defs`, `clipPath`, `mask`, `pattern`
  (`svgInvalidAncestors`). O SVG do QR não pode usar `clipPath`/`defs`/`<use>`: tudo em `<rect>`/`<path>` (pontos e
  cantos arredondados como subcaminhos de um `<path>` com arcos `A`).
- `editor-web/node_modules/fabric/dist/index.mjs::enlivenObjectEnlivables` (L1658) — no `fromObject`, todo valor de
  primeiro nível com campo `type` registrado no `classRegistry` é revivido como objeto Fabric. **`qrConfig` e
  `tableData` não podem ter campo `type`** (mesmo achado da TASK-12, `GradientSpec.kind`): usar `kind` e `style`.
- `editor-web/src/document.ts::CUSTOM_PROPERTIES` (L71) — lida em `editor.ts` L54
  (`FabricObject.customProperties = [...CUSTOM_PROPERTIES]`): o que estiver nela entra no `toObject()` e portanto no
  rascunho, no undo (`snapshot`/`restore`) e no duplicar. Basta acrescentar `'qrConfig'` e `'tableData'`.
- `editor-web/src/editor.ts::setConnector` (L961) e `::replaceObject` (L933) — modelo exato do "editar sem perder
  posição/tamanho": monta o grupo novo, copia `angle/scaleX/scaleY/flipX/flipY/opacity/shadow/layerName/animation/
  visible`, `setPositionByOrigin(centro)`, troca na mesma posição da pilha (`insertAt(index)`), reseleciona dentro de
  `silently()` e chama `commit()` (uma entrada de undo). `upsertQrCode`/`upsertTable` seguem esse padrão.
- `editor-web/src/editor.ts::set(props)` (L770) — num `Group`, um `fill` recolore **todos** os filhos não brancos e
  grava `brandColor` neles. Por isso o QR/tabela **não** pode cair no ramo genérico do `renderProps` (o seletor
  "Preenchimento" dessincronizaria a cor real de `qrConfig.fgColor`).
- `editor-web/src/main.ts::renderProps(o)` (L203) — ordem dos ramos: `FabricText` → `FabricImage` →
  `editor.connectorOf(o)` → `isFreehandPath` → genérico (cores/contorno/espessura + chips da marca). Os ramos novos
  `editor.qrConfigOf(o)` e `editor.tableDataOf(o)` entram **antes** do genérico (logo após o do conector). A barra comum
  mostra `🔓 Desagrupar` para qualquer `Group` (L212): esconder para QR/tabela (desagrupar perderia os metadados).
- `editor-web/src/main.ts::tabs` (L1114) — lista `[rótulo, função]` montada em `#tabs`; as abas novas entram aqui
  (trocar de aba já conclui o desenho à mão, L1127).
- `editor-web/src/main.ts::brandKit` (L34, `let`) — preenchido no `start()` (`parseBrandKit(startPayload.brandKit)`,
  L1827), no `applyBrandKit` da ponte (L71) e no "Recarregar do app" (L1470). Não está no `testHook` (L1867): o E2E não
  tem como pôr um kit conhecido → acrescentar `testHook.setBrandKit = (k) => { brandKit = parseBrandKit(k); }`.
- `editor-web/src/brandkit.ts::BrandKit` — `profile.website`, `profile.phone`, `colors.primary`, `fonts.heading/body`,
  `logoUrl` existem com esses nomes exatos (`VARIABLES`, `COLOR_ROLES`). `applyBrandKit` percorre filhos de grupo
  (`walkObjects`): um `FabricImage` com `brandLogo: true` dentro do grupo do QR tem o `src` trocado quando o kit muda;
  filhos com `brandColor` seriam recoloridos sem atualizar `qrConfig` → **não** pôr `brandColor` nos módulos do QR.
- `editor-web/src/main.ts::openSheet` e `dom.ts::{h, button, colorInput, select, slider}` — os blocos de UI a usar nas
  folhas (sem framework).
- `editor-web/vite.config.ts` — vitest em `environment: 'node'`; os testes importam `fabric/node` (o pacote `canvas`
  está em `node_modules`): dá para montar `Group`/`FabricText` reais no teste.

### Provas (comando literal -> resultado)

- `ls editor-web/node_modules | grep -i -E "qr|zxing|jsqr"` → nada: não há biblioteca de QR; o codificador é próprio
  (diretriz do README: implementação 100% própria).
- Referência independente no PC (Python do usuário, **sem** `-I`: o pacote está no site do usuário
  `C:\Users\luist\AppData\Roaming\Python\Python314\site-packages`): `qrcode 8.2` e `opencv 5.0.0`.
- `qrcode.QRCode(error_correction=ERROR_CORRECT_M, border=2, box_size=8)` com
  `https://wa.me/5511999999999?text=Ol%C3%A1` → versão 3; `cv2.QRCodeDetector().detectAndDecode(png)` devolve o texto
  exato. O decodificador do OpenCV serve de "câmera" no E2E.
- Estilo **pontos** (círculo r = 0,45 módulo, localizadores quadrados) + **buraco central de 22% do lado** + EC **H**,
  payload PIX de 115 bytes → versão 8 (tem informação de versão), e o OpenCV **decodificou** o texto. O "22%" do doc é
  do LADO da matriz (≈ 5% dos módulos), não da área — deixar isso numa constante comentada.
- `qrcode.util.QRData(data, mode=MODE_8BIT_BYTE)` força o modo byte e `QRCode(mask_pattern=k)` fixa a máscara: com
  isso a matriz de referência é comparável bit a bit com a nossa (sozinho, o Python escolheria modo numérico/
  alfanumérico). Conferido: `QRData(b'01234567', mode=MODE_8BIT_BYTE)` em M → versão 1, 21×21.
- CRC16-CCITT-FALSE (poli `0x1021`, início `0xFFFF`, sem reflexão, sem XOR final) de `"123456789"` → `29B1` (valor de
  verificação padrão; conferido em Python).

### Hipóteses descartadas (e por que)

- **Inserir o QR como imagem PNG** — o critério 2 exige vetor.
- **Usar `<clipPath>`/`<defs>`/`<use>` no SVG** — o parser do Fabric ignora o conteúdo desses nós
  (`svgInvalidAncestors`).
- **Um `Circle`/`Rect` Fabric por módulo** — a versão 10 tem ~1.600 módulos escuros: milhares de objetos no grupo pesam
  no toque/undo; um único `<path>` com todos os módulos é um objeto só.
- **Logo como `<image href>` no SVG** — funcionaria (`image` é tag válida), mas o logo viraria `FabricImage` sem
  `brandLogo`; preferir acrescentar ao grupo um `FabricImage.fromURL(brandKit.logoUrl)` com `brandLogo: true` (o
  `applyBrandKit` já sabe trocar o `src`).
- **Medir texto com `FabricText` dentro de `table.ts`** — acopla o layout ao Fabric e ao carregamento de fonte;
  `layoutTable(data, measure)` recebe a função de medida (no app: `FabricText` com a fonte do kit; no teste: uma medida
  falsa determinística).
- **Mudar `DOC_VERSION`** — desnecessário: propriedade própria a mais é ignorada por leitores antigos (precedentes:
  `connectorSpec`, `customGradient`).
- **Dividir a task agora** — a estimativa (~1.300 linhas de produção) fica abaixo do teto do manual; a divisão 05a/05b
  fica registrada acima como contingência.
- **Provar o "modo avião" desligando a rede do aparelho** — o aparelho é compartilhado com o dono; o sinal objetivo
  equivalente é nenhuma requisição (`performance.getEntriesByType('resource')`) durante a geração, e o código não ter
  `fetch`/XHR no caminho do QR.

### Tarefas

- [ ] `editor-web/src/qrcode.ts::encodeQr(text, { ecc, mask?, minVersion? })` → `{ version, size, ecc, mask, modules:
  boolean[][] }` — UTF-8 em modo byte, menor versão que cabe; tabelas de blocos EC por versão/nível; RS; colocação
  (localizadores, separadores, temporização, alinhamento, módulo escuro, formato com BCH `0x537` + XOR `0x5412`, versão
  ≥ 7 com BCH `0x1F25`); máscara forçada ou a de menor penalidade (4 regras). Texto que não cabe na v40 → `throw`.
  — `qrcode.test.ts`: igualdade bit a bit com `test/qr-reference.json` para ≥ 8 casos (L/M/Q/H; máscaras 0–7;
  versões 1, 2, 7, 10 e uma ≥ 20; um texto com acento UTF-8), mais: a escolha automática de máscara gera a matriz de
  penalidade mínima entre as 8; estouro lança.
  **Receita do fixture** (no PC, Python **sem** `-I`; guardar o script e o comando na §5 do dev):
  `QRCode(version=None, error_correction=E, border=0, mask_pattern=k); add_data(QRData(s.encode('utf-8'),
  mode=MODE_8BIT_BYTE)); make(fit=True); get_matrix()` → JSON `{text, ecc, mask, version, rows: ["0101…", …]}`.
- [ ] `editor-web/src/qrcode.ts::qrSvg(matrix, { dotStyle, eyeStyle, fg, bg, quietZone = 2, logoHole?, label? })` →
  string SVG: `<rect>` de fundo + um `<path>` dos módulos (quadrado / quadrado arredondado / círculo) + localizadores
  (quadrado/arredondado) + buraco central de 22% do lado quando `logoHole` + faixa de legenda (`<rect>` + `<text>`)
  quando `label`. — `qrcode.test.ts`: `viewBox` = (size + 2·quietZone) módulos (+ faixa da legenda); sem `clipPath`/
  `defs`/`<use>`; nº de subcaminhos = módulos escuros fora do buraco e dos localizadores; buraco vazio quando `logoHole`.
- [ ] `editor-web/src/qrPayloads.ts` — `linkPayload(url)` (prefixa `https://` se faltar esquema), `whatsappPayload(phone,
  msg?)` (só dígitos; 10–11 dígitos ganham `55`; `?text=` com `encodeURIComponent`), `pixPayload({ key, name, city,
  amount?, txid? })` (IDs 00 `01` / 26 [00 `br.gov.bcb.pix`, 01 chave] / 52 `0000` / 53 `986` / 54 opcional com 2 casas
  e ponto / 58 `BR` / 59 nome ≤ 25 / 60 cidade ≤ 15 / 62 [05 txid, padrão `***`] / 63 CRC; nome e cidade sem acento e
  em maiúsculas), `isPixPayload` + `pixCrcOk(payload)` (aceitar o "Copia e Cola" colado), `wifiPayload({ ssid, password,
  auth })` (escapa `\ ; , : "`; `nopass` sem `P:`), `crc16ccitt(s)`. — `qrPayloads.test.ts`:
  `crc16ccitt('123456789') === '29B1'`; o PIX gerado passa em `pixCrcOk` e tem os campos na ordem com os tamanhos `NN`
  corretos; payload colado com CRC errado é recusado; WhatsApp com `(11) 99999-9999` →
  `https://wa.me/5511999999999?text=…`; Wi-Fi com `;` na senha sai escapado.
- [ ] `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `+ 'qrConfig', 'tableData'` (sem `type` nos dois). — vitest: um
  `Group` com `qrConfig`/`tableData` sobrevive a `toObject()` → `Group.fromObject()` com os campos iguais (modelo: o
  teste do `customGradient` em `gradientsAndConnectors.test.ts`).
- [ ] `editor-web/src/editor.ts::upsertQrCode(config, existing?)` / `qrConfigOf(o)` — `QrConfig = { kind: 'link' |
  'whatsapp' | 'pix' | 'wifi', fields, payload, ecc, dotStyle, eyeStyle, fgColor, bgColor, label?, withLogo }`. Sem
  `existing`: `addSvgString(qrSvg(...), 'QR Code')` e, com logo, um `FabricImage` (`brandLogo: true`) centrado no
  buraco, tudo num `Group` com `qrConfig`. Com `existing`: monta o novo, **mantém o tamanho exibido** (escala nova =
  largura exibida antiga ÷ largura nova, porque a versão pode mudar), copia ângulo/opacidade/sombra/animação/nome, mesmo
  centro, mesmo índice da pilha (padrão `setConnector`), `commit()` uma vez. — vitest em `fabric/node` se der; senão,
  passo 5 do E2E.
- [ ] `editor-web/src/table.ts` — `TableData = { rows: string[][], style: 'header' | 'zebra' | 'grid' | 'minimal',
  headerBg, textColor, borderColor, fontFamily, align?: ('left'|'center'|'right')[] }`; `TABLE_TEMPLATES` (medidas de
  moda, numeração de calçados, lista de preços em 2 colunas com o preço à direita, comparativo em 3 colunas);
  `addRow/removeRow/addColumn/removeColumn` (mínimo 1×1, células novas vazias, sem mutar a entrada);
  `layoutTable(data, measure)` → larguras de coluna (máx. medido + padding), altura de linha e retângulos/posições de
  texto por estilo; `buildTable(data, measure)` → `Group` de `Rect` + `FabricText`. — `table.test.ts`: larguras = maior
  célula + padding com medida falsa; zebra só nas linhas alternadas do corpo; `minimal` sem bordas verticais; remover a
  última coluna/linha é recusado; `TableData` sobrevive a JSON.
- [ ] `editor-web/src/editor.ts::upsertTable(data, existing?)` / `tableDataOf(o)` — sem `existing`: centralizada, largura
  ≤ 80% da página; com `existing`: mesmo `left/top` (canto) e mesma escala, mesmo índice, um `commit()`.
- [ ] `editor-web/src/main.ts` — abas `['📱 QR Code', showQrSheet]` e `['📊 Tabela', showTableSheet]`; folha do QR com
  os 4 modos (Link pré-preenchido de `brandKit.profile.website`; WhatsApp de `profile.phone`; PIX "colar" ou "chave +
  nome + cidade + valor"; Wi-Fi), estilo dos pontos/cantos, cores (padrão `brandKit.colors.primary ?? '#111111'` /
  `#ffffff`), "Incluir logo da marca no centro" (só com `brandKit.logoUrl`; força EC H), legenda (3 sugestões + livre)
  e prévia; folha da tabela com os 4 templates (1 toque insere) e o editor: grade de `<input>`, `+/- Linha`,
  `+/- Coluna`, estilo (Cabeçalho Destacado com `brandKit.colors.primary`, Zebrada, Grade, Minimalista), "Aplicar".
  `renderProps`: ramos `qrConfigOf` (botão `✏️ Editar QR Code`) e `tableDataOf` (botão `✏️ Editar Tabela`) antes do
  genérico; sem `🔓 Desagrupar` para eles. `testHook.setBrandKit`. Classes CSS estáveis para o E2E (`qr-sheet`,
  `qr-apply`, `table-sheet`, `table-apply`, `edit-qr`, `edit-table`). Erro de payload (PIX sem chave, CRC colado
  inválido, texto grande demais) → `toast`, nada inserido.
- [ ] `tools/e2e/task05.mjs` + `tools/e2e/qr_decode.py` (lê PNG, `cv2.QRCodeDetector().detectAndDecode`, imprime o texto;
  com `--pix` recalcula o CRC16) — cenário da T2 abaixo.

### Plano de teste

- **Offline (sem slot):** `npx tsc --noEmit` e `npx vitest run` em `editor-web/` (os 3 testes novos + os antigos, 0
  falhas); o `build --bug task-05-qrcode-vetorial-offline-e-tabelas-no-canvas` do helper regera o bundle. Prova de
  leitura sem app (o dev pode rodar): renderizar `encodeQr` de 4 payloads (link, WhatsApp, PIX gerado, Wi-Fi) × 3
  `dotStyle` (+ um com buraco de logo em H) para PNG e passar no `qr_decode.py` — todos devolvem o payload exato.
- **T2 reprodução como o usuário (E2E, no slot):** `node tools/e2e/task05.mjs <pasta>` (modelo `task14.mjs`; aparelho e
  APK como o manual manda). Estado: `launchEditor()` → documento novo 1080×1080 (`editor.newDocument`);
  `ppEditor.setBrandKit({ profile: { website: 'www.lojateste.com.br', phone: '(11) 98888-7777' }, colors: { primary:
  '#c2185b' }, logoUrl: <URL de uma imagem empacotada em content/> })`.
  1. **Sem rede:** guardar `performance.getEntriesByType('resource').length`. Toque `#tabs` "📱 QR Code" → modo Link →
     o campo vem com `www.lojateste.com.br` (SINAL: valor do input) → "Inserir". SINAIS: existe um `Group` com
     `qrConfig.kind === 'link'` e payload `https://www.lojateste.com.br`; a contagem de recursos não mudou;
     `editor.exportRaster('png', 1, 1)` → arquivo → `python tools/e2e/qr_decode.py <png>` imprime o payload exato; o
     grupo só tem `Rect`/`Path` (nenhum `FabricImage`); `editor.exportSvg()` contém o `<path` do QR e nenhum `<image`
     para ele (vetorial).
  2. **WhatsApp + estilo:** nova inserção, modo WhatsApp (telefone pré-preenchido), mensagem "Olá! Vi o anúncio",
     estilo "Pontos", cantos arredondados, cor do kit, legenda "CHAME NO WHATSAPP". SINAIS: decodifica para
     `https://wa.me/5511988887777?text=Ol%C3%A1!%20Vi%20o%20an%C3%BAncio`; módulos em `#c2185b`; legenda presente.
  3. **PIX:** modo PIX → chave `+5511988887777`, nome "Loja Teste", cidade "São Paulo", valor 19,90. SINAL: decodifica
     para payload que começa com `000201`, contém `br.gov.bcb.pix`, `540519.90`, `6009SAO PAULO`, e cujo CRC confere
     (`qr_decode.py --pix`). Colar um payload com CRC adulterado → `toast` de erro e nada inserido.
  4. **Logo:** "Incluir logo" marcado → o grupo tem 1 `FabricImage` com `brandLogo: true` no centro; `qrConfig.ecc ===
     'H'`; o PNG exportado ainda decodifica.
  5. **Re-edição:** mover/escalar o QR do passo 2 (arrasto real + `📏 Posição / Tamanho` largura 300), anotar centro e
     largura exibida; tocar no QR → `#props` "✏️ Editar QR Code" → a folha reabre com o telefone/mensagem atuais (SINAL:
     valores dos inputs) → trocar a mensagem → "Aplicar". SINAIS: mesmo centro (±1 px), mesma largura exibida (±1 px),
     mesmo índice na pilha, o novo payload decodifica; `↶` volta ao QR anterior em 1 toque.
  6. **Tabela:** `#tabs` "📊 Tabela" → "👕 Tabela de Medidas" (1 toque). SINAIS: `Group` com `tableData.rows` =
     cabeçalho `Tamanho | Largura | Comprimento` + 4 linhas (P/M/G/GG); textos visíveis no print. Tocar na tabela →
     "✏️ Editar Tabela" → grade de inputs com os valores atuais → `+ Linha`, digitar `XG | 58 cm | 76 cm`, estilo
     "Linhas Zebradas" → "Aplicar". SINAIS: 6 linhas em `tableData.rows`, mesmo `left/top` e escala do grupo,
     retângulos zebrados alternados; no estilo "Cabeçalho Destacado" o fundo do cabeçalho é `#c2185b`. "📋 Lista de
     Preços": a coluna de preço fica alinhada à direita (borda direita dos textos na borda direita da coluna − padding).
  7. **Persistência:** `editor.toDocument()` → `editor.load(doc)` → o QR e a tabela continuam com `qrConfig`/`tableData`
     e os botões "✏️ Editar…" aparecem ao selecioná-los.
  Prints (`screencap`) após 1, 2, 4, 5 e 6; um print do aparelho com o QR também passa no `qr_decode.py` (leitura "como
  câmera", a partir da tela).
- **Controle positivo:** APK da base (`git checkout --detach <base>` + `build`, como o manual): `#tabs` não tem
  "📱 QR Code" nem "📊 Tabela", `typeof editor.upsertQrCode === 'undefined'` e `ppEditor.setBrandKit` não existe — o
  `task05.mjs` deve falhar logo no passo 1 com esse sinal (funcionalidade ausente).
- **T3 regressão direcionada:** vitest inteiro (sem falha nova contra a base); `tools/e2e/task12.mjs` (conectores e
  `renderProps` de `Group`, mesmo padrão de troca no lugar), `task11.mjs` (agrupar/desagrupar, camadas, inspetor),
  `task14.mjs` (abas/folhas, `renderProps` de texto) e `task03.mjs` (cores/`colorInput`). No `task05.mjs`, conferir
  também que um `Group` comum (agrupar 2 formas) ainda mostra "🔓 Desagrupar" e o ramo genérico de cores.
- **T4:** logcat do PID sem `Uncaught`/erro de console do WebView novo durante o `task05.mjs`.

### Sessões seguintes

- dev: effort high, ultrathink sim — codificador QR do zero (tabelas EC, RS, colocação, máscaras, versão ≥ 7: um bit
  errado gera QR ilegível) e geometria do Fabric na re-edição (manter o tamanho exibido quando a versão muda).
- teste: effort medium, ultrathink não — roteiro E2E com sinais objetivos (decodificação por OpenCV, valores por CDP); a
  classificação de falha é direta.

### Notas do dev ao Planejamento (2026-11-05)

- **Desmentido:** "os testes importam `fabric/node` (o pacote `canvas` está em `node_modules`)" — o `fabric/node` daqui
  **não mede texto** (`getContext` → null; mesmo achado já anotado em `test/textTools.test.ts`), e o pacote `fabric` (não
  `/node`) em Node falha em `document`. Consequência: `table.ts::buildTable(data, measure, F)` recebe as classes do Fabric
  (padrão: `fabric`); o vitest monta o Group com `Rect`/`Group` reais e um texto falso. A medida real do texto vai no E2E
  (passo 6, alinhamento à direita da Lista de Preços).
- **Desmentido:** o projeto não tem `@types/node` (tsconfig `types: []`, fora da reserva) — o teste lê o fixture por
  `import()` dinâmico e calcula o SHA-256 com `crypto.subtle`, sem `node:fs`/`node:crypto`.
- **Achado novo:** "Localizar e substituir" (`editor.ts::textLayers` → `textTools.ts::collectTextLayers`) desce em
  grupos e alteraria a legenda do QR e as células da tabela sem atualizar `qrConfig`/`tableData` (a reedição desfaria a
  troca). `textLayers()` passa a ignorar grupos com `qrConfig`/`tableData`; o texto deles se edita pelo "✏️ Editar…".

## Correção (pipeline 20261105-1638, rodada 1)

**O que mudou (`arquivo::simbolo`):**
- `editor-web/src/qrcode.ts` (novo) — `encodeQr(text, {ecc, mask?, minVersion?})`: modo byte UTF-8, versões 1–40, tabelas
  de blocos L/M/Q/H, RS em GF(256)/0x11D, colocação (localizadores, separadores, temporização, alinhamento por
  `alignmentPositions`, módulo escuro, formato BCH 0x537 ⊕ 0x5412, versão ≥ 7 BCH 0x1F25), 8 máscaras e `penalty` (4
  regras); estouro da v40 → `QrTooLongError`. `qrSvg(matrix, opts)`: `<rect>` de fundo + `<path>` dos módulos (um
  subcaminho por módulo: quadrado / quadrado arredondado r = 0,3 / círculo r = 0,45) + `<path>` dos 3 localizadores (furo
  em sentido anti-horário, nonzero) + buraco do logo (`logoHoleRange`, 22% do LADO, mesma paridade do lado) + faixa da
  legenda; `stroke-width="0"` em tudo (sem ele o Fabric soma 1 px à caixa). `qrLayout`, `QrConfig`, `isQrConfig`,
  `EYE_ROUND`.
- `editor-web/src/qrPayloads.ts` (novo) — `linkPayload`, `whatsappPayload`, `pixPayload` (00/26/52/53/54?/58/59/60/62/63,
  nome ≤ 25 e cidade ≤ 15 sem acento e maiúsculos, chave normalizada por `normalizePixKey`), `parseAmount`, `parseEmv`,
  `isPixPayload`, `pixCrcOk`, `wifiPayload`, `crc16ccitt`, `buildPayload(kind, fields)` (erro → `PayloadError`).
- `editor-web/src/table.ts` (novo) — `TableData`, `TABLE_TEMPLATES`/`tableTemplate` (medidas, calçados, preços com o
  preço à direita, comparativo), `addRow/removeRow/addColumn/removeColumn/setCell/normalizeTable`, `layoutTable(data,
  measure)` (estilos header/zebra/grid/minimal), `buildTable`.
- `editor-web/src/document.ts::CUSTOM_PROPERTIES` — `+ 'qrConfig', 'tableData'`.
- `editor-web/src/editor.ts` — `qrConfigOf`, `tableDataOf`, `upsertQrCode(config, existing?, {logoUrl, font})` (novo:
  35% do menor lado, centrado; reedição: mesmo centro, mesma LARGURA exibida, ângulo/espelho/opacidade/sombra/animação/
  nome, mesmo índice, 1 commit), `buildQrGroup` (legenda refeita como `FabricText` centrado e encolhido até 90% da largura;
  logo `FabricImage.fromURL` com `brandLogo: true` no buraco; falha do logo → aviso, buraco vazio), `upsertTable(data,
  existing?)` (nova: ≤ 80% da página; reedição: mesmo canto superior esquerdo por `getPointByOrigin('left','top')`, mesma
  escala), `replaceInPlace`, `measureText` (largura do `FabricText`), `textLayers` (exclui QR/tabela).
- `editor-web/src/main.ts` — abas `📱 QR Code` e `📊 Tabela`; `showQrSheet(existing?)` (4 modos com pré-preenchimento do
  kit, estilo de pontos/cantos, cores com "● Cor da marca", logo → correção H, legenda com 3 sugestões + livre, prévia
  SVG ao vivo, erro → `toast` e nada inserido); `showTableSheet` (1 toque insere); `showTableEditor` (grade de inputs,
  ± linha/coluna, estilo, cores, "🎨 Cores da marca", Aplicar); `renderProps`: ramos `isQr`/`isTable` antes do genérico e
  sem "🔓 Desagrupar"; `testHook.setBrandKit`.
- `editor-web/src/styles.css` — folha do QR (campos, prévia) e grade da tabela.
- `tools/e2e/qr_decode.py` (novo) — OpenCV `QRCodeDetector` e, se não ler, `QRCodeDetectorAruco`; `--expect`, `--pix`.
- `tools/e2e/task05.mjs` (novo) — T2 do Plano de teste (passos 1–7 + regressões abaixo).
- `editor/src/main/assets/editor/` — bundle regerado pelo `build`.

**Por que o raio dos cantos arredondados é pequeno (`qrcode.ts::EYE_ROUND` = 0,5/0,25/0,25 módulo):** com 2/1,5/1 o
OpenCV não leu NENHUM QR de cantos arredondados (o detector acha o localizador pelos vértices); varredura (`gen4.mjs` na
evidência; 4 payloads × 3 estilos de ponto × M/H × 5 variações — original, desfoque 5×5, 0,6×, 2×, 3×) lida pelo detector
clássico: raio 1/0,5/0,5 → 80/120; 0,5/0,25/0,25 → 105/120; cantos quadrados → 114/120 (com o Aruco como 2ª tentativa:
96, 113 e 117/120).

**Provas desta rodada (comando literal → resultado):**
- `npx tsc --noEmit` (editor-web) → sem erro. `npx vitest run` → **21 arquivos, 211 testes, 0 falhas** (3 arquivos novos:
  `qrcode.test.ts` 22, `qrPayloads.test.ts` 13, `table.test.ts` 15).
- Igualdade bit a bit com a referência independente (Python `qrcode`): 9 matrizes completas (L/M/Q/H, máscaras 0–7,
  versões 1, 2, 3, 4, 5, 7, 10, 11, 25, texto UTF-8 com acento) **e** o SHA-256 das 160 combinações versão 1–40 × nível,
  cada uma no limite de capacidade da versão — todas iguais na 1ª execução.
  Receita do fixture (`editor-web/test/qr-reference.json`; Python **sem** `-I`): `qr_reference.py` (cópia na evidência) —
  `QRCode(version=None, error_correction=E, border=0, mask_pattern=k)`, `add_data(QRData(s.encode('utf-8'),
  mode=MODE_8BIT_BYTE))`, `make(fit=True)`, `get_matrix()`; nos casos `hashes`, o texto é `ALPHA[(i*7 + versão) % 36]`
  para i < `length` (comprimento máximo da versão por busca binária sobre `best_fit()`). Comando:
  `python qr_reference.py editor-web/test/qr-reference.json` → `9 full, 160 hashes`.
- CRC: `crc16ccitt('123456789') = 29B1`; um BR Code de exemplo dá `F012`, igual a `binascii.crc_hqx(dados, 0xFFFF)` do
  Python (o "1D3D" que eu lembrava para esse exemplo estava errado — conferido, não usado).
- **Leitura sem app (OpenCV como câmera):** `node --experimental-transform-types gen_svgs.mjs <pasta>` (gera, com o próprio
  `qrcode.ts`/`qrPayloads.ts`, 4 payloads — link, WhatsApp, PIX gerado, Wi-Fi com `;` na senha — × 3 estilos de ponto, +
  4 com buraco de logo em H, estilo pontos e cantos arredondados) → rasterizado no Edge headless (`msedge --headless=new
  --screenshot`) → `python tools/e2e/qr_decode.py --expect <payload> [--pix] <png>` → **16/16 leram o payload exato**; os 4
  PIX com `[crc ok]`. Versões: link v3, WhatsApp v5, PIX v7, Wi-Fi v3; com logo (H): v4, v8, v11, v5.
  Evidência: `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261105-dev-task-05-prova-offline\`
  (PNGs, `list.json`, `gen_svgs.mjs`, `gen4.mjs`, `qr_reference.py`).

**Ajustes ao Plano de teste:**
- T2 = `node tools/e2e/task05.mjs <pasta>` (cwd = lane; precisa de `python` com OpenCV no PATH, **sem** `-I`). O logo do
  brand kit de teste é `contentUrl('mockups/box_front.webp')` (imagem empacotada). Além dos passos 1–7 do plano, o script
  confere: prévia ao vivo na folha; props do QR sem "🔓 Desagrupar"; "Localizar e substituir" não acha a legenda do QR;
  um `Group` comum ainda mostra "🔓 Desagrupar" e "Preenchimento". Prints: `05-1-link-print.png` (também decodificado:
  leitura a partir da tela), `05-2…`, `05-4…`, `05-5-editar-qr.png`, `05-5-reeditado-print.png`, `05-6-tabela.png`,
  `05-6-editar-tabela.png`, `05-6-lista-precos.png`; PNG só do QR (`renderPageCanvas` com filtro) para cada decodificação.
- Re-edição (passo 5): a mensagem nova é longa de propósito (a versão do QR sobe), para provar que a largura exibida se
  mantém quando a matriz muda de tamanho.
- Controle positivo: o 1º check do `task05.mjs` (abas + `editor.upsertQrCode` + `ppEditor.setBrandKit`) falha na base e o
  script sai com 1 logo ali.
- O `task05.mjs` NÃO foi rodado nesta sessão (o dev não roda o app); só `node --check` (sintaxe) passou.


### Teste rodada 1 — reprovado

**Motivo:** a prova T2 commitada, `tools/e2e/task05.mjs`, não roda até o fim: quebra de forma determinística no passo 1. A
funcionalidade no app está conforme o doc (abaixo), mas o script que a prova é código entregue por esta task e vai para o
fluxo principal; a prova tem que rodar.

**Falhas a corrigir (só no `tools/e2e/task05.mjs`; o app não precisa de mudança):**
1. `task05.mjs` L49 `moveActive`: `new o.getCenterPoint().constructor(x, y)` — por precedência do JS isso é
   `new (o.getCenterPoint)()` e lança `TypeError: o.getCenterPoint is not a constructor` (na L88, logo depois do 9º
   check). Esperado: o QR movido para (230, 230). Observado: o script aborta com saída 1 (9/9 checks até ali PASS).
   Correção: `new (o.getCenterPoint().constructor)(x, y)` — com essa troca, e só ela, o resto do script rodou (abaixo).
2. Check "nenhuma requisição de rede durante a geração" tem corrida: compara a CONTAGEM de
   `performance.getEntriesByType('resource')`, e uma entrada só entra na lista quando a resposta termina. Na 2ª execução
   deu `18 → 20`: as 2 entradas novas são as buscas de inicialização do `content.ts` à base
   (`REMOTE_TEMPLATES_CATALOG_URL`, `REMOTE_ICONS_URL` em huggingface.co), com `startTime` 1019/1022 ms (antes de tocar na
   aba) e `responseEnd` 2233/2236 ms (dentro da janela do check). Na 1ª execução deu `20 → 20`. O diff do fix não tem
   `fetch`/XHR novo (`git diff 6d04734..HEAD -- editor-web/src | grep -E "^\+.*(fetch\(|XMLHttpRequest)"` → nada). Correção
   sugerida: medir as entradas com `startTime >=` o instante do toque em "📱 QR Code" (ou esperar o fim das buscas iniciais
   antes de `res0`).

**O que foi testado (aparelho: `emulator-5554`, sdk_gphone64_x86_64, API 34):** o Moto g86 (1ª opção do manual) estava
com a tela bloqueada e, depois de destravado, passou a ser usado pelo dono (foco em `com.instagram.android`); deixado em
paz e o teste seguiu no emulador já aberto (3ª opção). O APK da base (`6d04734`, = `origin/main`) ficou instalado no Moto
com `-r` (dados preservados; antes: versionName 0.4.0, lastUpdateTime 2026-11-05 17:38:46).
- Sync: branch sobre `origin/main` @ `6d04734` (o main recebeu só Kotlin/docs/E2E de outros bugs; nada em `editor-web/`).
- Offline: `npx tsc --noEmit` 0 erros; `npx vitest run` 21 arquivos / 211 testes, 0 falhas; `build` do helper: vitest
  211/211, unidade Gradle 199 (1 skip) / 0 falha (base: vitest 161/161, unidade 199 / 0 falha); bundle sem diferença.
- Binário: base `dcc7a700…a7c7`, fix `20594dcd…a701` — `sha256sum` do `base.apk` no aparelho = APK instalado nos dois.
- **Controle positivo (APK da base):** `task05.mjs` → `FAIL abas "📱 QR Code" e "📊 Tabela", editor.upsertQrCode e
  ppEditor.setBrandKit existem`, 0/1, saída 1 — funcionalidade ausente.
- **T2 com o script commitado (APK do fix):** 9/9 PASS até a L88, depois `TypeError` (falha 1 acima).
- **T2 com o script corrigido só na L49** (cópia fora da lane, `task05-patched.mjs` na evidência): **38/39** — o único
  FAIL é a corrida da falha 2. PASS em: link pré-preenchido do kit + prévia; Group só `rect`/`path`; PNG exportado e
  **print da tela** decodificam no OpenCV; SVG com `<path>` sem `<image>`; sem "🔓 Desagrupar"; WhatsApp (pontos, cantos
  arredondados, `#c2185b`, legenda) decodifica para `…?text=Ol%C3%A1!%20Vi%20o%20an%C3%BAncio`; localizar/substituir não
  pega a legenda; PIX decodifica com `[crc ok]` (`…540519.905802BR5910LOJA TESTE6009SAO PAULO…6304 9E21`); PIX colado com
  CRC adulterado → toast "…(CRC) não confere", nada inserido; logo: 1 `FabricImage` `brandLogo` no centro (dx = dy = 0),
  EC H, decodifica; reedição: arrasto real, largura 300, a folha reabre com telefone/mensagem, Aplicar mantém centro
  (679,17; 459,52), largura 300 e índice 1 com a versão maior (escala 0,7317 → 0,5660), decodifica o payload novo, `↶`
  volta em 1 toque; tabela de medidas em 1 toque (cabeçalho `#c2185b`, 15 textos), editar → +Linha XG, zebrada, mesmo
  canto/escala/índice; lista de preços alinhada à direita (259,5 = 278,5 − 19); salvar/reabrir mantém 4 QR + 2 tabelas e
  o logo, botões "✏️ Editar…" voltam; Group comum mantém "🔓 Desagrupar" e "Preenchimento"; sem exceção JS.
- **T3:** `task12` 40/40, `task11` 25/25, `task03` 19/19; `task14` 40/50 na 1ª execução (10 FAIL encadeados: o texto não
  mudou depois de "✏️ Editar texto" → Aplicar), **50/50 na 2ª** com o mesmo APK do fix, e 50/50 na base — instabilidade
  do emulador (systemui a 60% de CPU, `uiautomator` devolvendo "null root node"), não regressão.
- **T4:** logcat dos PIDs 11813 e 13052: nenhum `FATAL`/`ANR`/erro de console do WebView; só
  `IllegalArgumentException: Receiver not registered` no finalizer de `ai.onnxruntime.telemetry.HttpClient` (lado Kotlin,
  fora do que a task toca) e o aviso `variations_seed_loader … Seed missing signature` do WebView.

**Evidência:** `C:\projects\sandbox\.bugfix-pipeline-product_photo_offline\evidencia\20261105-1746-task-05-qrcode-vetorial-offline-e-tabelas-no-canvas\`
(`base-6d04734.apk`, `fix-ee886fb.apk`, `t2-base/`, `t2-fix/` (script commitado), `t2-fix-script-corrigido/` (prints
`05-*`, PNGs decodificados, saída, logcat), `t3/`, `t3-base/task14/`, `unit-*.txt`, `build-*.log`, `aparelho-*.txt`).

**Para a próxima rodada:** corrigir as 2 falhas do `task05.mjs` (L49 e o check de rede) e rodar `node --check` + o
script contra o app (o dev não roda o app; o teste roda). Nenhum `build` novo é necessário se só o script mudar.

### Rodada 1 — reprovada: `task05.mjs` quebrava no passo 1 e o check de rede tinha corrida; correção: só o script

- `tools/e2e/task05.mjs::moveActive` (L49): `new o.getCenterPoint().constructor(x, y)` era `new (o.getCenterPoint)()` →
  `TypeError`. Agora `new (o.getCenterPoint().constructor)(x, y)` — igual à cópia corrigida do teste
  (`t2-fix-script-corrigido/task05-patched.mjs`, 38/39 com ela).
- Check de rede do passo 1: deixou de comparar a CONTAGEM de `performance.getEntriesByType('resource')` (uma entrada só
  entra quando a resposta termina; as buscas de inicialização do `content.ts` iniciadas antes do toque caíam na janela:
  `18 → 20`). Agora guarda `t0 = performance.now()` antes do toque em "📱 QR Code", espera 1,5 s depois da inserção e exige
  zero entradas com `startTime ≥ t0` (o detalhe do check lista os nomes, se houver).
- Provas: `node --check tools/e2e/task05.mjs` → ok; `diff` contra `task05-patched.mjs` → só o bloco do check de rede
  difere. App sem mudança (o diff da rodada não toca `editor-web/`); o `build` do helper roda de novo só por roteiro.
