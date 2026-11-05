# [TASK-02] Tipografia Avançada de Oferta e Deformação de Texto (14 Estilos de Text Warp)

## Metadados e Esforço Mensurado

| Campo | Valor |
| :--- | :--- |
| **ID** | `TASK-02` |
| **Prioridade** | **Alta (Quick Win — P1)** |
| **Esforço Mensurado** | **Baixo a Médio** — **~2 a 3 dias úteis (16h–24h / 5 Story Points)** *(~0,5 dia para formatações de oferta/sombra + ~1,5 a 2 dias para os 14 estilos de Text Warp)* |
| **Escopo** | 100% Local (`editor-web` em TypeScript / Fabric.js 7.4.0) |
| **Referência Analisada (`com.desygner.ads`)** | `js_pretty/assets/module-create-DxNmnX1s.js` (L43043: `fln`, `Zin`, `eln`..`hln`) e `extracted/assets/public/docs/create.md` (L571–L640) |

### Detalhamento do Esforço por Subtarefa
1. **Formatação de Preço/Oferta (Tachado, Sublinhado, Marca-texto/Highlight e Caixa `MAIÚSCULAS`/`Título`):** ~4h.
2. **Sombra Completa (`Drop Shadow` parametrizada + `Glow` / Brilho Externo):** ~4h.
3. **Motor de 14 Estilos de Deformação (`textWarp.ts` + integração em `curve.ts` / `editor.ts`):** ~10h (caminhos SVG paramétricos para `arc`, `wave`, `flag`, `rise` e malha 2D de caracteres/canvas para `bulge`, `shell-lower`, `shell-upper`, `fish`, `fisheye`, `inflate`, `squeeze`, `twist`).
4. **Testes Unitários (Vitest) + Persistência em `document.ts` (`CUSTOM_PROPERTIES`):** ~4h.

---

## 1. Contexto e Problema Atual

Em anúncios de varejo e e-commerce, a tipografia de preço e chamada promocional é o elemento que mais impacta a conversão. Atualmente, em [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L290-L320) (`textProps`) e [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L471-L516):
- Só existem botões para **Negrito (`N`)** e **Itálico (`I`)** — faltam **Tachado (`linethrough`)** (indispensável para ancoragem de preço *"De R$ 199,90"*), **Sublinhado (`underline`)** e **Fundo de Texto / Marca-Texto (`textBackgroundColor` / pílula de destaque)** para destacar *"POR R$ 99,90"*.
- Não há botão rápido para alternar **Caixa do Texto** (`MAIÚSCULAS`, `minúsculas`, ` Primeira Maiúscula`), obrigando o usuário a apagar e redigitar no teclado do celular.
- A sombra de texto ([`Editor.setShadow()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L471-L477)) é apenas um botão liga/desliga com valores fixos (`rgba(0,0,0,0.45)`, `blur = m * 0.012`, `offset = m * 0.006`), sem controle de cor, intensidade do desfoque (`blur`), distância (`offsetX`/`offsetY`) ou efeito neon/brilho externo (`glow`).
- O texto curvo ([`curve.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/curve.ts)) suporta apenas um arco circular simples (`curveArc`). No `com.desygner.ads` (`module-create-DxNmnX1s.js` L43043), existem **14 estilos de deformação (Text Warp)** ideais para faixas promocionais, selos retrô e títulos de impacto.

---

## 2. O que deve ser feito (Especificação Técnica Detalhada)

### 2.1. Formatações de Oferta e Conversão em `textProps()`
No Fabric.js 7.4.0, `FabricText` / `Textbox` já possui suporte nativo a várias dessas propriedades, bastando expô-las e persistir corretamente:

1. **Tachado (`linethrough`) e Sublinhado (`underline`):**
   - Adicionar botões de ação rápida `S̶` (`linethrough: !t.linethrough`) e `S̲` (`underline: !t.underline`) na primeira linha de [`textProps()`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L298-L308).
2. **Marca-Texto / Fundo do Texto (`textBackgroundColor` + Padding):**
   - Adicionar controle de cor de destaque (`textBackgroundColor`) com botão "Sem fundo" (`''`) e chips rápidos do Brand Kit (`Primária`, `Destaque`).
   - Opcionalmente suportar cantos arredondados no fundo do texto via propriedade customizada `textBgRadius` renderizada antes do texto no `_renderTextCommon` ou `backgroundColor` da caixa.
3. **Alternador de Caixa (`cycleTextCase`):**
   - Botão `Aa` em `textProps()` que alterna ciclicamente o texto selecionado entre:
     1. `UPPERCASE` (`text.toLocaleUpperCase('pt-BR')`);
     2. `lowercase` (`text.toLocaleLowerCase('pt-BR')`);
     3. `Title Case` (primeira letra de cada palavra em maiúscula, exceto preposições curtas `de`, `da`, `do`, `por`, `com`, `em`).
   - Preserva o texto original em memória caso o usuário queira desfazer via `editor.commit()`.

### 2.2. Painel de Sombra Completa e Brilho (`Shadow & Glow`)
Substituir o toggle binário [`setShadow(on)`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts#L471-L477) por uma sheet ou linha expansível **"Sombra / Brilho"** aplicável a **qualquer camada** (Textos, Imagens recortadas de produtos, Selos e Formas):

1. **Presets Rápidos de Sombra:**
   - `Nenhuma` (`shadow: null`);
   - `Suave (Drop)` (`blur: 16`, `offsetX: 0`, `offsetY: 8`, `color: rgba(0,0,0,0.35)`);
   - `Dura / Retrô` (`blur: 0`, `offsetX: 6`, `offsetY: 6`, `color: #000000`);
   - `Brilho Neon (Glow)` (`blur: 25`, `offsetX: 0`, `offsetY: 0`, `color: brandKit.colors.accent ?? '#ffeb3b'`);
   - `Contorno Duplo / Flutuante` (`blur: 32`, `offsetX: 0`, `offsetY: 18`, `color: rgba(0,0,0,0.55)`).
2. **Controles Manuais:**
   - `Cor da Sombra` (`colorInput` + `Opacidade` `0..100%` convertida para `rgba(r,g,b,a)`);
   - `Desfoque (Blur)` (`0..100 px`);
   - `Deslocamento X` (`-50..50 px`) e `Deslocamento Y` (`-50..50 px`).

### 2.3. Motor de 14 Estilos de Text Warp (`textWarp.ts`)
Expandir [`editor-web/src/curve.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/curve.ts) (ou criar [`editor-web/src/textWarp.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/textWarp.ts)) para suportar os 14 estilos de deformação inspirados na função `fln(ctx, sourceCanvas, style, bend, distortH, distortV)` de `module-create-DxNmnX1s.js` (L43043):

1. **Catálogo de Estilos (`WarpStyle`):**
   - **Caminhos de Linha Base (via SVG `Path` nativo do Fabric `Textbox.path`):**
     1. `'none'`: Texto reto padrão.
     2. `'arc'`: Arco circular clássico (já existente em `curveArc`, `bend` de `-100` a `+100`).
     3. `'wave'`: Onda senoidal suave (`M -half 0 C -quarter -amp, quarter amp, half 0`) — excelente para faixas e títulos dinâmicos.
     4. `'flag'`: Bandeira promocional (onda assimétrica com subida na ponta direita).
     5. `'rise'`: Subida diagonal em curva S (`M -half amp C 0 amp, 0 -amp, half -amp`) — clássico de selos *"SUPER OFERTA"*.
   - **Deformações de Envelope Vertical/Horizontal (via deslocamento de fatias/caracteres ou malha 2D em Canvas offscreen):**
     6. `'arc-upper'`: Base reta, topo arqueado para cima/baixo (efeito ponte/toldo).
     7. `'arc-lower'`: Topo reto, base arqueada.
     8. `'bulge'`: Topo e base arqueados para fora simultaneamente (efeito estufado / barril).
     9. `'squeeze'`: Topo e base comprimidos no centro (efeito ampulheta / espremido).
     10. `'shell-upper'`: Concha superior (leque expandindo para cima).
     11. `'shell-lower'`: Concha inferior (leque expandindo para baixo).
     12. `'fish'`: Perfil de peixe (inflado na metade esquerda e afilado na direita).
     13. `'fisheye'`: Lente olho-de-peixe radial a partir do centro do texto:
         $$r' = r \cdot \left(1 + k \cdot (1 - r^2)\right)$$
     14. `'inflate'` e `'twist'`: Inflar 3D suave e torção angular proporcional à distância ao centro.
2. **Parâmetros Persistidos no Documento (`CUSTOM_PROPERTIES` em [`document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts#L54-L64)):**
   - Adicionar `'warpStyle'`, `'warpBend'`, `'warpDistortH'`, `'warpDistortV'` em `CUSTOM_PROPERTIES`.
   - Manter retrocompatibilidade total com rascunhos/templates antigos que usam `curve: number` (se `curve !== 0` e `!warpStyle`, tratar como `warpStyle: 'arc'`, `warpBend: curve`).
3. **Algoritmo de Deformação por Fatias/Malha (`renderWarpedText`):**
   - Para os estilos de caminho (`arc`, `wave`, `flag`, `rise`), gerar o `Path` SVG matematicamente em [`curve.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/curve.ts) e atribuir a `textbox.set({ path })`, mantendo o texto 100% vetorial na exportação SVG.
   - Para os estilos de envelope (`bulge`, `squeeze`, `arc-upper`, `arc-lower`, `shell-*`, `fish`, `fisheye`, `inflate`, `twist`), usar uma subclasse ou hook de renderização no `Textbox._render(ctx)` que desenha o texto reto em um buffer temporário de alta resolução e faz o mapeamento inverso por colunas/fatias ($N = 64$ subdivisões) calculando `topY(u)` e `bottomY(u)` para $u \in [-1, 1]$, aplicando também perspectiva horizontal (`distortH`) e vertical (`distortV`).

---

## 3. Arquivos a Criar / Modificar

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| [`editor-web/src/curve.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/curve.ts) | **Modificar** | Expandir com geradores de caminho SVG (`curveWave`, `curveFlag`, `curveRise`) e funções matemáticas de envelope (`evalWarpEnvelope(style, u, v, bend, distortH, distortV)`). |
| [`editor-web/src/document.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/document.ts) | **Modificar** | Incluir `'warpStyle'`, `'warpBend'`, `'warpDistortH'`, `'warpDistortV'` em `CUSTOM_PROPERTIES`. |
| [`editor-web/src/editor.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/editor.ts) | **Modificar** | Atualizar `setShadow()` para aceitar `{ color, blur, offsetX, offsetY }`, adicionar `cycleTextCase()`, `setWarp()` e atualizar `refitCurve()` para todos os estilos. |
| [`editor-web/src/main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts) | **Modificar** | Em `textProps()`, adicionar botões `S̶` (Tachado), `S̲` (Sublinhado), `Aa` (Caixa), cor de Marca-Texto, botão `Sombra / Brilho` (sheet parametrizada) e botão `Curvar / Deformar` (sheet com os 14 estilos + sliders `Curvatura`, `Perspectiva H`, `Perspectiva V`). |
| [`editor-web/test/curve.test.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/test/curve.test.ts) | **Modificar / Criar** | Testes unitários validando a geração dos caminhos SVG (`arc`, `wave`, `flag`, `rise`), funções de envelope e `cycleTextCase`. |

---

## 4. Critérios de Aceite e Verificação

- [x] Usuário consegue criar um texto *"De R$ 199,90"* com **Tachado (`S̶`)** e outro *"Por R$ 99,90"* com **Marca-Texto colorido** em menos de 3 toques.
- [x] Botão **`Aa`** alterna entre `MAIÚSCULAS`, `minúsculas` e `Título` preservando acentuação em português (`Promoção Relâmpago` $\leftrightarrow$ `PROMOÇÃO RELÂMPAGO`).
- [x] Painel **Sombra / Brilho** permite ajustar cor, opacidade, desfoque e deslocamento X/Y tanto em textos quanto em fotos de produtos recortadas e selos.
- [x] Painel **Curvar / Deformar** oferece os 14 estilos de deformação, atualiza em tempo real ao mover o slider de curvatura (`-100` a `+100`) e persiste corretamente ao salvar/reabrir rascunho.
- [x] `npx vitest run` e `npm run build` passam sem erros.

