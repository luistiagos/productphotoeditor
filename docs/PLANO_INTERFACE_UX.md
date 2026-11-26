# Plano de Interface e UX para Lançamento em Produção (`product_photo_offline`)

> **Status:** **Implementado (Fases A–D + Paletas WCAG + Ferramentas Rápidas Nativas)** — Pendente apenas atualização de seletores legados na Fase E se necessário (`tools/e2e/`)  
> **Objetivo:** Transformar a interface atual — funcional, porém com estética de protótipo técnico — em uma experiência **profissional, intuitiva e competitiva para o público final** (empreendedores, lojistas de e-commerce, social media e criadores de anúncios), mantendo 100% das capacidades offline e híbridas já construídas.

---

## 1. Diagnóstico da Interface Atual (Auditoria do Repositório)

A análise direta das telas nativas (Jetpack Compose) e do editor canvas (`editor-web/` em Fabric.js) revela **seis gargalos principais** que afastam o aplicativo de um padrão comercial de produção:

1. **Ausência de Identidade Visual e Design System Unificado**
   - Em [`MainActivity.kt`](file:///c:/projects/sandbox/product_photo_offline/app/src/main/kotlin/com/productphoto/app/MainActivity.kt#L48-L57), o app usa `dynamicDarkColorScheme`/`dynamicLightColorScheme` e `MaterialTheme` padrão, sem paleta de marca, escala tipográfica própria, formas expressivas ou modo edge-to-edge.
   - O editor web ([`styles.css`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/styles.css#L1-L25)) usa cores hardcoded (`#3b6fd8` / `#7aa2ff` sobre `#eceef2` / `#15181e`), criando uma quebra visual gritante entre as telas Kotlin e a WebView.
2. **Home Plana sem Hierarquia de Produto ([`HomeScreen.kt`](file:///c:/projects/sandbox/product_photo_offline/app/src/main/kotlin/com/productphoto/app/HomeScreen.kt#L70-L85))**
   - Apresenta **9 `Card`s idênticos de texto puro** empilhados verticalmente.
   - A ação principal de valor (*"Foto de produto"*) tem o mesmo peso visual que telas de infraestrutura (*"Texto com IA"* e *"Modelos de IA"*).
   - Não há navegação por abas inferiores, previews visuais, templates em destaque, rascunhos recentes na entrada nem onboarding.
3. **Exposição de Jargão Técnico ao Usuário Leigo**
   - Em [`ProductFlowScreen.kt`](file:///c:/projects/sandbox/product_photo_offline/feature/product/src/main/kotlin/com/productphoto/feature/product/ProductFlowScreen.kt#L169-L178), a primeira tela exibe seleção de engine (*"Removedor de fundo: Automático, ML Kit, u2netp"*) e texto técnico sobre Google Play services.
   - Na tela de resultado (`ResultStep`, linhas 398–402), métricas internas de benchmark (`Composição: X ms`, `Relighting: Y ms`, `Outpaint: Z ms`) aparecem acima dos controles criativos, seguidas por um scroll longo com dois `OutlinedCard`s grandes e quatro sliders empilhados.
   - Em [`ModelsScreen.kt`](file:///c:/projects/sandbox/product_photo_offline/app/src/main/kotlin/com/productphoto/app/ModelsScreen.kt#L105-L115), IDs internos, requisitos de RAM e licenças ficam no mesmo nível de acesso que ferramentas criativas.
4. **Estado Vazio Frio ("Cold Start") na Geração por IA ([`ImageGenScreen.kt`](file:///c:/projects/sandbox/product_photo_offline/app/src/main/kotlin/com/productphoto/app/ImageGenScreen.kt#L245-L248))**
   - Campos vazios (`O que gerar`, `Evitar (opcional)`) sem chips de estilo, presets fotográficos, exemplos clicáveis ou botão de inspiração.
5. **Editor Web com Estética de Protótipo e Sobrecarga Cognitiva ([`main.ts`](file:///c:/projects/sandbox/product_photo_offline/editor-web/src/main.ts#L186-L330))**
   - **Uso generalizado de emojis como ícones de UI** (`↶`, `↷`, `👁️`, `🏷️`, `📱`, `📊`, `🎬`, `📦`, `🔗`, `🔓`, `🔒`, `📐`, `📏`, `✏️`, `💧`, `⚡`, `🔍`), que variam por fabricante/versão do Android e comunicam aspecto amador.
   - **`#topbar` congestionada:** 7 itens comprimidos na mesma faixa (`Undo`, `Redo`, `Título`, `Camadas`, `Salvar`, `Preview`, `Exportar`).
   - **`#props` poluído:** ao selecionar um elemento, até ~15 botões aparecem em fila horizontal mais linhas de opacidade/mesclagem/lote ocupando até `42vh` do canvas.
   - **`#tabs` achatadas:** 13 abas horizontais no mesmo nível (`Templates`, `Texto`, `Imagem`, `Formas`, `🏷️ Selos`, `📱 QR Code`, `📊 Tabela`, `Adesivos`, `Fundo`, `Tamanho`, `Marca`, `🎬 Vídeo`, `📦 Mockup 3D`), exigindo rolagem longa para descobrir funções.
   - Controles HTML nativos sem customização visual (`<select>`, `<input type="range">`).
6. **Falta de Previews e Filtros em Rascunhos e Mockups**
   - `DraftsScreen` exibe uma lista linear simples em vez de uma galeria visual.
   - [`MockupScreen.kt`](file:///c:/projects/sandbox/product_photo_offline/feature/mockup/src/main/kotlin/com/productphoto/feature/mockup/MockupScreen.kt#L236-L268) exibe todos os mockups sem categorização (Embalagens, Vestuário, Eletrônicos, Papelaria) e com botões de ação finais sem hierarquia.

---

## 2. Benchmarking: Padrões de UX dos Líderes de Mercado

Ao analisar líderes de fotografia de produto e design móvel (**Photoroom**, **Pixelcut**, **Canva Mobile**, **Flair.ai** e **Claid.ai**), cinco padrões de UX se destacam como consenso de mercado para produção:

| Padrão Líder | Referências | Problema que Resolve | Aplicação no Nosso App |
| :--- | :--- | :--- | :--- |
| **1. "Zero-Effort" & First Win Path** | Photoroom, Pebblely | Abandono na primeira sessão por excesso de opções técnicas ou prompts vazios. | Home focada em ação imediata (*"Nova Foto de Produto"* em destaque), presets de estilo clicáveis na IA e acesso 1-toque a templates visuais. |
| **2. Ergonomia de Polegar (*Thumb-Zone*)** | Photoroom, Pixelcut | Fadiga e dificuldade de uso com uma mão em telas altas de smartphones. | Ações principais e navegação no terço inferior; painéis secundários em *Bottom Sheets* deslizáveis; barras horizontais com **ícone + rótulo curto**. |
| **3. Divulgação Progressiva (*Progressive Disclosure*)** | Canva Mobile, Pixelcut | Telas de edição lotadas que escondem a imagem e intimidam iniciantes. | Seleção no canvas mostra só **5–6 ações primárias**; ajustes avançados (posição exata, mistura, lote, sombras) abrem em sub-folhas contextuais sob demanda. |
| **4. Estética *Dark-First Studio* & *Calm Tech*** | Material 3 Expressive, Flair.ai | Fundo claro ou colorido distorce a percepção de cor/luz da foto do produto. | Tema padrão escuro neutro calibrado (grafite/ardósia profundo, **nunca** `#000000` puro) que faz o produto saltar na tela, com opção clara em Ajustes. |
| **5. Gestão da Ansiedade Probabilística (IA)** | Claid.ai, Photoroom | Esperas de 3–10 s em spinners genéricos causam desistência e cliques repetidos. | Loaders com etapas humanas (*"Recortando produto..."*, *"Harmonizando luz..."*), botão cancelar claro e comparação **Antes / Depois** por toque e retenção. |

---

## 3. Design System Unificado ("Pocket Commercial Studio")

Para que as telas Kotlin (Jetpack Compose) e o Editor Web (Fabric.js) pareçam **um único aplicativo nativo coeso**, ambos compartilharão exatamente os mesmos tokens visuais.

### 3.1 Paleta de Cores (Dark-First Studio + Light Studio)

> **Regra:** Desativar `dynamicColorScheme` como tema principal da marca para evitar que o papel de parede do sistema altere a identidade visual do estúdio (pode permanecer opcional em Ajustes).

| Token Semântico | Studio Dark (Padrão) | Studio Light (Opcional) | Papel na Interface |
| :--- | :--- | :--- | :--- |
| `bg.canvas` | `#0F1117` | `#F1F3F7` | Fundo ao redor do palco/foto (destaca bordas e sombras) |
| `surface.base` | `#161922` | `#FFFFFF` | Fundo de telas, topbar e navegação inferior |
| `surface.elevated` | `#1E222E` | `#F7F8FB` | Cards, barras flutuantes e painéis contextuais |
| `surface.sheet` | `#252A38` | `#FFFFFF` | Bottom sheets, chips ativos e menus |
| `border.subtle` | `#2E3446` | `#E2E6EF` | Divisores finos (`1dp` / `1px`) sem poluir o layout |
| `text.primary` | `#F3F5F9` | `#12151F` | Títulos, rótulos principais, valores |
| `text.secondary` | `#9CA3B8` | `#5F677D` | Subtítulos, dimensões, metadados |
| `accent.primary` | `#6C5CE7` *(Violeta Estúdio)* | `#5B4BDB` | CTAs principais (*Exportar*, *Gerar*, *Aplicar*) |
| `accent.ai` | `#00D2B8` *(Teal/Ciano IA)* | `#00A896` | Badges, sparkles e ações exclusivas de IA (*Relighting*, *Remover fundo*) |
| `accent.pro` / Destaque | `#F59E0B` | `#D97706` | Alertas de contraste WCAG e selos de destaque |
| `danger` | `#EF4444` | `#DC2626` | Excluir, erro de rede/validação |

### 3.2 Tipografia, Formas e Elevação (Material 3 Expressive)
- **Tipografia:** Família geométrica limpa já empacotada no projeto (`Inter` ou `Plus Jakarta Sans` + `tabular-nums` para medidas em px, tempo de vídeo e porcentagens).
  - Títulos de seção: `18sp–20sp SemiBold`.
  - Rótulos de barras/botões: `12sp–13sp Medium` (nunca texto truncado sem ícone).
- **Formas (Contraste Intencional):**
  - Cards principais e Hero Banner: `20dp` (`RoundedCornerShape(20.dp)`).
  - Botões primários (CTAs): formato **Pílula** (`50%` / `24dp`) para destacar a ação principal do restante dos controles.
  - Chips, tiles de templates e inputs: `12dp` (`12px` no CSS).
  - Bottom Sheets: cantos superiores `24dp` com alça central (*drag handle*) `36dp × 4dp`.
- **Sincronização Compose ↔ WebView:**
  - Ao abrir o editor, `StartPayload` envia `{ theme: 'dark' | 'light', tokens: { ... } }` para o JS aplicar nas CSS Custom Properties de `:root`, garantindo transição sem "flash" branco e identidade 100% alinhada.

### 3.3 Padronização de Iconografia (Fim dos Emojis na UI)
- **Kotlin (Compose):** `material-icons-extended` ou ícones vetoriais próprios (`ImageVector`) estilo *Rounded / Outlined* de espessura uniforme (`1.5dp–2dp`).
- **`editor-web/`:** Criar módulo `editor-web/src/icons.ts` com um mapa tipado de **SVGs inline estilo Lucide** (empacotados offline no bundle JS, zero requisição externa).
- **Benefício duplo:** Visual profissional idêntico em qualquer Android e eliminação do aspecto artesanal sem quebrar acessibilidade (`aria-label` preservado nos botões).

---

## 4. Arquitetura de Informação e Navegação (App Shell)

Atualmente todas as 9 funcionalidades competem na mesma lista em `HomeScreen.kt`. A nova arquitetura organiza o app em **4 pilares na Barra Inferior (*Bottom Navigation*)** + **Ajustes no Topo**:

```
┌──────────────────────────────────────────────┐
│  [Logo/Estúdio]                [🔍]   [⚙️]   │  <- TopBar limpa (Ajustes concentra IA/Modelos)
├──────────────────────────────────────────────┤
│                                              │
│          CONTEÚDO DA ABA ATIVA               │
│                                              │
├──────────────────────────────────────────────┤
│  [🏠 Início]  [🎨 Templates]  [📁 Projetos]  [✨ Marca] │
└──────────────────────────────────────────────┘
```

### Mapeamento de Destinos (De → Para)

| Tela Atual | Novo Destino | Justificativa UX |
| :--- | :--- | :--- |
| `HomeScreen` (9 cards) | **Aba 1: Início (Estúdio)** | Centraliza entrada por intenção: Hero CTA (*Foto de Produto*), Carrossel de Ferramentas IA (*Gerar Imagem*, *Mockup 3D*, *Design em Branco*) e *Continuar Editando*. |
| `EditorStart.Gallery` | **Aba 2: Templates** | Galeria visual nativa em Compose (ou preview rápido) com filtros por categoria (*Produto, Promoção, Stories, Cartão*) + busca. Tocar abre direto no editor já com Brand Kit aplicado. |
| `DraftsScreen` | **Aba 3: Projetos** | Grade visual de 2 colunas com thumbnail grande, dimensões, data e menu rápido `⋮` (*Abrir, Duplicar, Renomear, Excluir*). |
| `BrandKitScreen` | **Aba 4: Marca** | Hub de Brand Kit com **preview ao vivo** (cartão de exemplo reagindo às cores/fontes escolhidas) no topo e seções organizadas abaixo. |
| `ModelsScreen`, `TextAiScreen`, escolha de `RemoverMode` | **⚙️ Ajustes → IA & Offline** | Remove complexidade técnica da Home. Usuário avançado ainda configura provedor de texto, baixa Gemma/Qwen ou força ML Kit/u2netp quando quiser. |

---

## 5. Redesenho Tela a Tela (Especificação Detalhada)

### 5.1 Aba Início (Estúdio) & Primeiro Uso
- **Primeiro Uso (Micro-onboarding não bloqueante):** Sem login obrigatório. Se não houver projetos salvos, exibir um card discreto *"Comece em 30 segundos"* com um botão direto para testar com foto de exemplo ou da galeria.
- **Hierarquia da Tela:**
  1. **Hero Card (Destaque Principal):** *"Foto de Produto com IA"* — miniatura visual Antes/Depois sutil, subtítulo claro (*"Remova o fundo e crie cenas profissionais com sombra real"*) e dois botões diretos no card: `[Escolher Foto]` (CTA primário) e `[Câmera]` (secundário).
  2. **Faixa Horizontal "Ferramentas do Estúdio"** (cards quadrados com ícone vetorial + badge opcional):
     - *Gerar com IA* (badge `IA`)
     - *Mockup 3D*
     - *Novo Design* (abre o `FormatPickerSheet` com ícones de redes sociais)
     - *Remover Fundo Rápido* (atalho que leva direto ao recorte + exportar PNG transparente)
  3. **Carrossel "Templates em Destaque":** 4–6 thumbnails reais clicáveis (`Ver todos →` vai para Aba Templates).
  4. **Seção "Recentes" (se houver rascunhos):** até 4 miniaturas horizontais para retomar em 1 toque.

### 5.2 Fluxo Foto de Produto (`ProductFlowScreen.kt`)
Redução de fricção de **5 etapas rígidas** para uma experiência fluida com barra de progresso em passos (`1. Recorte → 2. Cenário → 3. Estúdio`) e remoção de controles técnicos:

1. **Entrada (Pick/Câmera):**
   - Caso acionada pela Home via *Escolher Foto* ou *Câmera*, o usuário **pula direto para o recorte** sem uma tela intermediária de formulário!
   - A escolha de engine (`Automático`, `ML Kit`, `u2netp`) sai dessa tela e vai para um menu discreto `⋮` na barra superior do passo de Recorte (ou Ajustes), mantendo *"Automático"* como padrão invisível.
2. **Passo 1 — Refinar Recorte (`MaskStep`):**
   - **Canvas full-bleed** escuro (`#0F1117`) com transparência em padrão quadriculado sutil de baixo contraste (`#1C202B` / `#232836`, não branco gritante `#EEEEEE`).
   - **Botão "Comparar (Olho)"** na barra superior: segurar mostra a foto original sobreposta.
   - **Preview do Pincel:** Ao arrastar o slider de tamanho, exibir um círculo translúcido no centro do canvas mostrando o diâmetro exato em tempo real.
   - **Toolbar inferior compacta:** Segmento `[Apagar | Restaurar]`, slider de tamanho, botão `[1×]` para resetar zoom e `[Refazer]` discreto. CTA pílula `[Continuar →]`.
3. **Passo 2 — Escolher Cenário e Posicionar (`SceneStep` + `PositionStep`):**
   - Manter a seleção visual em grade com chips de filtro no topo (*Todos, Estúdio, Madeira, Mármore, Pódio, Minimalista*).
   - No `PositionStep`, adicionar **barra de ações rápidas de 1 toque** acima do botão principal: `[Centralizar]`, `[Alinhar ao chão]`, `[Girar 90°]`, `[Trocar cenário]` — reduzindo dependência exclusiva de gestos de pinça difíceis em telas pequenas.
4. **Passo 3 — Estúdio de Resultado (`ResultStep`):**
   - **Limpeza imediata:** Remover a linha de debug `Composição: X ms / Relighting: Y ms / Outpaint: Z ms` em builds de produção.
   - **Área da imagem:** Fixa nos 55% superiores da tela com botão flutuante de *Comparar Antes/Depois* e zoom rápido.
   - **Painel inferior organizado em Abas Compactas (substituindo o scroll longo):**
     - **Aba `Luz IA`:** Chips visuais com ícone de direção de luz (`Ambiente`, `Esquerda`, `Direita`, `Topo`, `Contra-luz`) + botão `[Aplicar Iluminação IA]`.
     - **Aba `Formato`:** `FormatPicker` compacto + botão `[Expandir Cenário (IA)]`.
     - **Aba `Ajustes Finos`:** Os 4 sliders (`Sombra contato`, `Sombra projetada`, `Cor`, `Luz de borda`) com botão `Resetar`.
   - **Rodapé Fixo de Conversão (sempre visível):**
     - Botão Secundário: `[Criar Anúncio no Editor]` (leva o recorte/cena para o `editor-web`).
     - Botão Primário (CTA): `[Exportar]` (abre um sheet limpo com PNG Alta Qualidade, JPG Otimizado e Compartilhar Direto).

### 5.3 Gerador de Imagem com IA (`ImageGenScreen.kt`)
- **Fim do Cold Start:**
  - Abaixo do campo *"Descreva a imagem que você quer criar..."*, incluir uma faixa de **Chips de Inspiração** (*"Frasco de perfume no mármore"*, *"Tênis flutuando neon"*, *"Logo minimalista cafeteria"*) + botão **Dado/Sparkle ("Surpreender")** dentro do campo.
  - **Seletor Visual de Estilo** (chips horizontais que enriquecem o prompt automaticamente sem o usuário precisar saber engenharia de prompt): `Foto Realista`, `Estúdio Clean`, `3D Render`, `Aquarela`, `Minimalista`.
  - Campo `"Evitar (opcional)"` recolhido dentro de um toggle `"Opções avançadas ▾"`, mantendo a tela inicial limpa.
- **Resultados em Grade:**
  - Cada card gerado mostra ações claras com ícones: `[Editar Anúncio]` (CTA principal do card), `[2× HD]` (upscale local Real-ESRGAN) e `[Salvar]`.

### 5.4 Mockup Studio (`MockupScreen.kt`)
- **Galeria Categorizada:** Chips no topo (`Todos`, `Embalagens`, `Vestuário`, `Telas`, `Impressos`) + indicador discreto de nuvem apenas nos modelos ainda não baixados.
- **Tela de Edição do Mockup:** Preview grande ocupando a metade superior, lista de espaços limpa com miniatura quadrada e botões `[Trocar]` / `[Enquadrar]`, e rodapé fixo com `[Salvar]` (CTA), `[Compartilhar]` e `[Abrir no Editor]`.

### 5.5 Editor de Canvas (`editor-web/`) — A Maior Transformação Visual

O editor web é onde o usuário passa mais tempo. A meta é adotar o padrão **Canva Mobile + Photoroom**, eliminando barras congestionadas e emojis.

#### A. Topbar Enxuta (Máximo 5 elementos)
Substituir os 7 botões atuais por uma faixa limpa de `52px`:
```
[ ← ]   [ ↶ ] [ ↷ ]      Nome do Design ▾      [ 👁 ] [ Exportar ]
Voltar   Desfazer/Refazer  (Toque renomeia)   Preview   CTA Pílula
```
- **Onde vão `Salvar` e `Camadas`?**
  - **Salvar:** O autosave (`saveDraft`) já roda a cada 4s; exibir um micro-indicador sutil ao lado do título (*"Salvo"* ou ponto de sincronização) e opção *"Salvar cópia"* dentro do menu do título/exportação.
  - **Camadas:** Um **botão flutuante discreto** no canto inferior esquerdo do palco (ao lado oposto da pílula de zoom `#zoom-pill`), exatamente como em editores profissionais modernos.

#### B. Painel Contextual Inteligente (`#props` em 2 Níveis)
**Problema atual:** 15+ botões numa lista horizontal única ocupando até `42vh`.  
**Solução:** Quando um objeto é selecionado no canvas, exibir **uma única barra horizontal enxuta (`48px`) com ícone + texto curto**, adaptada ao tipo de objeto:
- **Texto selecionado:** `[Editar]` `[Fonte]` `[Cor]` `[Tamanho]` `[Efeitos]` `[Mais ▾]`
- **Imagem selecionada:** `[Substituir]` `[Recortar]` `[Remover Fundo]` `[Filtros]` `[Ajustes]` `[Mais ▾]`
- **Forma / Selo / Grupo:** `[Cor]` `[Borda/Degradê]` `[Sombra]` `[Opacidade]` `[Organizar]` `[Mais ▾]`
- **Múltiplos objetos:** `[Agrupar]` `[Alinhar]` `[Combinar]` `[Duplicar]` `[Excluir]`

> **Ação `[Mais ▾]` ou toque em qualquer item de ajuste:** Abre um **Bottom Sheet compacto e limpo (`32vh`)** com controles táteis (sliders estilizados, swatches de cor da marca/documento, opacidade, travar, duplicar, excluir, posição X/Y, animação, variável de lote). O objeto selecionado permanece visível acima do sheet.

#### C. Barra Inferior de Ferramentas (`#tabs` Reorganizada)
Reduzir de 13 abas horizontais misturadas para **7 categorias claras com ícone SVG em cima e rótulo de 1 palavra embaixo**:

1. **`Templates`** — Galeria categorizada do acervo
2. **`Texto`** — Títulos, fontes, estilos de oferta e IA (*Gerar / Reescrever*)
3. **`Mídia`** — Galeria, Adesivos, Formas, Desenho livre
4. **`Anúncios`** — Selos de Conversão, QR Code (PIX/WhatsApp), Tabelas de Preço
5. **`Marca`** — Aplicar Brand Kit, Cores da Marca, Logo
6. **`Fundo`** — Cores, Degradês, Cenários, Tamanho/Magic Resize
7. **`Estúdio`** — Vídeo/Animação, Mockup 3D, Exportar em Lote (Data Merge)

#### D. Estilização CSS Moderna (`styles.css`)
- **Sliders customizados (`input[type=range]`):** Trilha fina (`4px`), preenchimento na cor `--accent`, thumb circular de `20px` com halo de toque suave (`40px` hit target).
- **Seletores (`<select>`):** Substituir dropdowns crus do sistema por **botões de seleção estilizados ou grupos de chips** dentro dos sheets.
- **Palco (`#stage`):** Fundo neutro escuro (`#0F1117`) com sombra suave no artboard, pílula de zoom translúcida (`backdrop-filter: blur(8px)`), e barra de páginas (`#pages`) exibida apenas quando o projeto tiver mais de 1 página (ou um botão compacto `+ Página` discreto), economizando ~44px verticais em designs de página única!

---

## 6. Plano de Execução em Fases (Para Etapas Futuras)

Para manter o app compilável, testável e sem regressões nos testes E2E (`tools/e2e/`), a implementação deve seguir **5 fases sequenciais**:

### Fase A — Fundação Visual (Design System & Tema)
- **Escopo:** Criar pacote de tema Compose em `:core:ui` (`Theme.kt`, `Color.kt`, `Type.kt`, `Shape.kt`, `StudioIcons.kt`) + atualizar variáveis CSS base em `editor-web/src/styles.css` + criar `editor-web/src/icons.ts` (SVGs offline).
- **Critério de conclusão:** App compila em tema escuro unificado entre Compose e WebView; `npm test` e `testDebugUnitTest` verdes; zero chamadas de rede.

### Fase B — Nova Arquitetura de Navegação (Home, Templates, Projetos, Ajustes)
- **Escopo:** Reestruturar `MainActivity.kt` / `Navigator.kt` com `NavigationBar` de 4 abas (*Início*, *Templates*, *Projetos*, *Marca*) + tela `SettingsScreen.kt` (agrupando `ModelsScreen`, `TextAiScreen` e preferências de tema/removedor). Redesenhar `HomeScreen.kt`, `DraftsScreen` (grade visual) e `BrandKitScreen.kt` (com preview ao vivo).
- **Critério de conclusão:** Fluxo principal limpo sem cards técnicos na Home; acesso a todas as telas preservado via navegação.

### Fase C — Redesign dos Fluxos Criativos Nativos (Produto, IA e Mockup)
- **Escopo:** Refatorar `ProductFlowScreen.kt` (remover métricas ms em release, compactar `ResultStep` em abas de estúdio, esconder escolha de engine em menu avançado, adicionar preview do pincel e ações rápidas no `PositionStep`), `ImageGenScreen.kt` (chips de estilo/inspiração, opções avançadas recolhidas) e `MockupScreen.kt` (filtros de categoria e rodapé fixo).
- **Critério de conclusão:** Fluxo completo testado no aparelho físico com tempo para primeira exportação reduzido e layout sem cortes em telas de 6".

### Fase D — Redesign do Editor Web (`editor-web/`)
- **Escopo:**
  1. Substituir todos os emojis de UI por ícones SVG de `icons.ts`.
  2. Refatorar `#topbar` para 5 controles + botão flutuante de Camadas no palco.
  3. Agrupar `#tabs` nas 7 categorias com ícone + rótulo.
  4. Implementar `#props` contextual em 2 níveis (barra compacta de 5–6 ações + sub-sheets) e ocultar `#pages` quando houver apenas 1 página (com acesso rápido via sheet/botão).
  5. Modernizar CSS de sliders, chips, sheets e cards.
- **Critério de conclusão:** `npm run build` atualiza `editor/src/main/assets/editor/`, `npx tsc --noEmit` e `npx vitest run` 100% verdes.

### Fase E — Polimento de Produção & Migração dos Testes E2E
- **Escopo:** Haptics sutis ao encaixar guias/sliders (Compose `HapticFeedback`), animações `AnimatedContent` / transições suaves de sheets, validação de acessibilidade (`contentDescription` / `aria-label`, contraste mínimo 4.5:1), e atualização dos seletores nos scripts `tools/e2e/*.mjs` (`cdp.mjs`, `task03..20.mjs`) que hoje buscam textos/emojis antigos (ex.: `"🏷️ Selos"`, `"Camadas"` no topbar, `"Novo design"` na Home).
- **Critério de conclusão:** Suíte E2E completa e testes instrumentados verdes no emulador e no aparelho físico (`moto g86 5G`).

---

## 7. Riscos e Pontos de Atenção Antes de Começar a Codar

1. **Impacto nos Testes Automatizados (`tools/e2e/` e `androidTest/`):**
   - `cdp.mjs::launchEditor()` navega via `uiautomator` procurando por textos exatos como `"Novo design"` e `"Post Facebook"`.
   - Scripts como `task03.mjs` a `task20.mjs` clicam em abas e botões por texto/classe CSS (ex.: `.geometry-btn`, `'Camadas'`, `'🏷️ Selos'`).
   - **Mitigação:** Manter `data-testid` / classes semânticas estáveis no `editor-web` e `testTag` no Compose ao refatorar rótulos e remover emojis, atualizando o `launchEditor()` na Fase B/E.
2. **Performance em Dispositivos Intermediários (Moto G86 / Dimensity 7300):**
   - Evitar uso excessivo de `backdrop-filter: blur(...)` em múltiplos elementos simultâneos dentro da WebView (usar apenas na pílula de zoom ou scrim leve) para manter 60 fps no arrasto e pinça do Fabric.js.
3. **Alinhamento com o Backlog de Produto (`docs/backlog/README.md`):**
   - A nova estrutura de 7 abas do editor e o `ResultStep` em abas já acomodam naturalmente os recursos recentes (ADS-01 Relighting, ADS-02 Outpaint, ADS-04 Selos de Conversão, Vídeo e Mockup 3D) sem precisar reestruturar menus novamente no futuro.

---

## 8. Registro de Execução Aplicado (Novembro 2026)

- **Fase A (Design System & 6 Paletas WCAG):** [`Theme.kt`](file:///c:/projects/sandbox/product_photo_offline/core/ui/src/main/kotlin/com/productphoto/ui/Theme.kt) implementa `StudioThemeStyle` (`VIOLET_STUDIO`, `GRAPHITE_PRO`, `NOIR_GOLD`, `DEEP_OCEAN`, `CRIMSON_STUDIO`, `DAYLIGHT_GALLERY`), validado por [`ThemeContrastTest.kt`](file:///c:/projects/sandbox/product_photo_offline/core/ui/src/test/kotlin/com/productphoto/ui/ThemeContrastTest.kt), persistido em `AppGraph` + seletor visual em [`ThemeSelector.kt`](file:///c:/projects/sandbox/product_photo_offline/app/src/main/kotlin/com/productphoto/app/ThemeSelector.kt) (acessível na Home e em [`SettingsScreen.kt`](file:///c:/projects/sandbox/product_photo_offline/app/src/main/kotlin/com/productphoto/app/SettingsScreen.kt)). Editor web alinhado com `icons.ts` e `styles.css`.
- **Fase B (Navegação, Showcase & Ferramentas Rápidas):** [`HomeScreen.kt`](file:///c:/projects/sandbox/product_photo_offline/app/src/main/kotlin/com/productphoto/app/HomeScreen.kt) com 4 abas (*Início*, *Templates*, *Projetos*, *Marca*), imagens de vitrine em `app/src/main/assets/showcase/`, carrossel horizontal **Ferramentas em Destaque** (*Foto de Produto com IA*, *Remover Fundo IA*, *Upscaler Real-ESRGAN*), **Ferramentas Rápidas** ilustradas (7 acessos incluindo `Foto de Produto IA`, `Remover Fundo` e `Upscaler HD`), carrossel de anúncios e cards ilustrados na aba *Marca*.
- **Telas RÁPIDAS Nativas:** [`QuickToolsScreens.kt`](file:///c:/projects/sandbox/product_photo_offline/app/src/main/kotlin/com/productphoto/app/QuickToolsScreens.kt) entrega `QuickBgRemoverScreen` (recorte PNG transparente com checkerboard e antes/depois) e `QuickUpscalerScreen` (Real-ESRGAN 2×/4× com ajuste automático ≤ 1 MP).
- **Fases C & D:** Fluxos nativos (`ProductFlowScreen.kt`, `ImageGenScreen.kt`, `MockupScreen.kt`) e editor web (`editor-web/src/main.ts`, bundle em `editor/src/main/assets/editor/`) modernizados sem quebrar `"Novo design"` no `cdp.mjs`.
