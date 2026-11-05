# [TASK-05] Gerador de QR Code Vetorial 100% Offline (Link, WhatsApp, PIX) e Tabelas de Preço/Medidas no Canvas

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

