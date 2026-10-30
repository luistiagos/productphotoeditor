# Backlog de Funcionalidades: Criação de Anúncios e IA Remota

> **Contexto do Projeto**: App *Product Photo Offline* com integração de IA remota via `iawrapper` (Vast.ai Serverless / RTX 5090), permitindo inferências de alta velocidade (< 5,5s ponta a ponta com Zero-Hop Base64) somadas ao editor de canvas (Fabric.js) e modelos locais on-device.  
> **Objetivo**: Expandir o produto de "editor/gerador de fotos de produto" para uma **ferramenta completa de criação de criativos e anúncios de alta conversão** para e-commerce (Mercado Livre, Shopee, Amazon) e tráfego pago (Meta Ads, TikTok Ads, Google).

---

## 1. Dores do Usuário & Oportunidade de Mercado

Quem anuncia na internet (gestores de tráfego, lojas virtuais, dropshippers, infoprodutores e pequenas marcas) enfrenta 3 gargalos críticos:
1. **Falta de Volume para Testes A/B**: Campanhas de Meta/TikTok Ads exigem de 5 a 15 variações de criativos por semana para não saturar a audiência.
2. **"Efeito Recorte Amador"**: Produtos recortados colados em fundos genéricos parecem artificiais (falta de sombra de contato, luz incompatível), derrubando a taxa de clique (CTR).
3. **Bloqueio Criativo de Copy**: O lojista tem a foto do produto, mas não sabe quais títulos, selos (badges) ou chamadas para ação (CTAs) aumentam as vendas.

Com o cluster de GPU remota operacional, podemos executar fluxos pesados de inferência que eram inviáveis localmente no smartphone, viabilizando soluções profissionais com latência mínima.

---

## 2. Matriz de Priorização do Backlog

| ID | Funcionalidade | Prioridade | Esforço Técnico | Impacto no Usuário | Backend Remoto / Local | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **ADS-01** | **Harmonização & Relighting Remoto (IC-Light)** | **P0** (Imediato) | Médio | Altíssimo | Remoto (`iawrapper` / ComfyUI) | ✅ **Concluído** |
| **ADS-02** | **Expansão Multiformato (Outpainting 1:1 $\to$ 9:16 / 16:9)** | **P0** (Imediato) | Baixo-Médio | Altíssimo | Remoto (`iawrapper`) | ✅ **Concluído** |
| **ADS-03** | **Geração em Lote (Pacote Teste A/B com 1 Clique)** | **P1** (Curto Prazo) | Baixo | Altíssimo | Remoto + App (Batch Task) | ⏳ A Fazer |
| **ADS-04** | **Badges e Selos de Oferta no Canvas Editável** | **P1** (Curto Prazo) | Baixo | Alto | Local (Fabric.js + Assets) | ✅ **Concluído** |
| **ADS-05** | **Copiloto de Copywriting & Auto-Prompt (Vision LLM)** | **P1** (Curto Prazo) | Médio | Alto | Remoto / Local híbrido | ⏳ A Fazer |
| **ADS-06** | **Modo Catálogo Mercado Livre / Amazon (Fundo Branco)** | **P2** (Médio Prazo) | Baixo | Alto | Local + Remoto (Sombra) | ⏳ A Fazer |
| **ADS-07** | **Infográficos de Benefícios ("Raio-X" do Produto)** | **P2** (Médio Prazo) | Médio | Médio-Alto | App + Canvas + LLM | ⏳ A Fazer |
| **ADS-08** | **Interação Humana (Mão segurando / Modelo vestindo)** | **P2** (Médio Prazo) | Alto | Alto | Remoto (Inpainting / ControlNet) | ⏳ A Fazer |
| **ADS-09** | **Motion Ads (Micro-vídeos MP4 de 3 a 5s)** | **P3** (Futuro) | Alto | Altíssimo | Remoto (LTX-Video / Wan 2.1 / SVD) | ⏳ A Fazer |
| **SEC-01** | **Tirar a credencial do APK: contas individuais no `iawrapper` (Google + e-mail/senha)** | **P1** (Antes de distribuir) | Alto | Alto (custo/segurança) | Remoto (`iawrapper`) + App | ⏳ A Fazer (redesenhado em 2026-10-22) |
| **SEC-02** | **Conta admin e credenciais de teste** | **P0** (Hoje) | Baixo | Crítico | Remoto (produção) | ⏳ A Fazer |
| **SEC-03** | **Webhook RevenueCat: tirar a rota (requisitos da feature futura)** | **P0** (Hoje) | Baixo | Crítico | Remoto (produção + código) | ⏳ A Fazer |
| **SEC-04** | **Segredos e configuração de produção** | **P0** (Hoje) / P1 | Baixo | Crítico | Remoto (Railway) | ⏳ A Fazer |
| **SEC-05** | **Sessão e tokens: `is_active`, refresh, revogação** | **P1** (Antes de distribuir) | Médio | Alto | Remoto (`iawrapper`) | ⏳ A Fazer |
| **SEC-06** | **Autorização e vazamento de dados** | **P1** (Antes de distribuir) | Baixo | Alto (LGPD) | Remoto (`iawrapper`) | ⏳ A Fazer |
| **SEC-07** | **Contas: verificação de e-mail, reset, Google, limites de login** | **P1** (Antes de distribuir) | Médio | Alto | Remoto (`iawrapper`) | ⏳ A Fazer |
| **SEC-08** | **Release do app: keystore própria, R8 e travas no build** | **P1** (Antes de distribuir) | Médio | Alto | App | ⏳ A Fazer |
| **SEC-09** | **Cofre local resiliente + `dataExtractionRules`** | **P1** (Antes de distribuir) | Baixo | Médio | App | ⏳ A Fazer |
| **SEC-10** | **TLS no app: HTTP só para servidor local** | **P1** (Antes de distribuir) | Baixo | Médio | App | ⏳ A Fazer |
| **SEC-11** | **Catálogo remoto: caminho, hosts, tamanho e integridade** | **P1** (Antes de distribuir) | Baixo | Médio | App + HF | ⏳ A Fazer |
| **SEC-12** | **Privacidade, retenção de mídia, moderação e Data Safety** | **P1** (Antes de publicar) | Médio | Alto (publicação/LGPD) | Remoto + App + Loja | ⏳ A Fazer |
| **SEC-13** | **Hub multi-app: isolamento, papéis, orçamento por app, Play Integrity** | **P1** (Antes do 2º app) | Alto | Alto | Remoto (`iawrapper`) | ⏳ A Fazer |
| **SEC-14** | **Administração: Django admin, cascatas, seed, auditoria** | **P1** (Antes de distribuir) | Médio | Médio | Remoto (`iawrapper`) | ⏳ A Fazer |
| **SEC-15** | **Execução, custo e abuso: workflow do usuário, limites, `sync`** | **P0** (Código urgente) | Médio | Crítico | Remoto (`iawrapper`) | ⏳ A Fazer |
| **SEC-16** | **Repositório, build e dependências** | **P2** (Médio Prazo) | Baixo | Médio | Remoto (`iawrapper`) | ⏳ A Fazer |
| **SEC-17** | **Worker 3D Trellis: autenticação e exposição** | **P1** (Se estiver no ar) | Baixo | Alto | Remoto (worker) | ⏳ A Fazer |

---

## 3. Especificação Detalhada dos Épicos

### Épico 1: Harmonização Visual & Relighting Remoto (ADS-01) — ✅ Concluído
- **Problema**: O recorte colado no fundo não recebe a luz nem o tom do ambiente. Parece colagem amadora.
- **Solução**: Implementar pipeline de **IC-Light** ou Relighting via Inpaint condicional na GPU remota.
  - A entrada é o produto recortado + o cenário escolhido/gerado.
  - O modelo re-ilumina as bordas do produto (*rim light*), adiciona reflexos com a cor predominante do cenário e projeta a sombra de contato no solo.
- **Saída**: Imagem realista onde o produto parece ter sido fotografado fisicamente no local.
- **Contrato de API sugerido no `iawrapper`**:
  - `POST /api/tasks/` com `feature_slug: "product-relighting"`
  - Payload: `{ "product_b64": "...", "background_b64": "...", "light_direction": "left|right|top|ambient" }`

---

### Épico 2: Expansão Generativa Multiformato / Outpainting (ADS-02) — ✅ Concluído
- **Problema**: O anunciante monta uma imagem quadrada (1:1) para o feed do Instagram/Facebook, mas precisa com urgência do formato vertical (9:16) para Stories, Reels e TikTok.
- **Solução**:
  - O app envia a cena 1:1 e pede a extensão para 9:16 ou 16:9.
  - O backend remoto expande o topo e a base do cenário organicamente usando Outpainting com Diffusion.
  - **Safe Zone Automática**: O produto e os textos permanecem no miolo central seguro (para não serem cobertos pelo nome do perfil no topo ou botões de like/comentário na lateral do TikTok/Instagram).
- **Contrato de API sugerido**:
  - `feature_slug: "product-outpaint"` com `target_aspect_ratio: "9:16"` ou dimensões `720x1280`.

---

### Épico 3: Geração em Lote para Testes A/B (ADS-03)
- **Problema**: Fazer 5 imagens uma a uma consome muito tempo e gera atrito no app.
- **Solução**:
  - Usuário seleciona o produto recortado e toca em **"Gerar Pacote de Anúncios"**.
  - O app despacha paralelamente (ou em lote) tarefas para 4 estilos comprovados de anúncios:
    1. *Cenário Lifestyle / Em Uso* (ex: pia de mármore, mesa de café, sala de estar);
    2. *Estúdio Clean / Minimalista* (fundo neutro elegante com sombras suaves);
    3. *Pedestal / Luxo* (plataforma geométrica, reflexos de água ou plantas tropicais);
    4. *Estilo UGC (User Generated Content)* (foto com iluminação natural caseira, que parece um post orgânico e converte muito em tráfego pago).
  - Resultados são apresentados em um carrossel onde o usuário pode aprovar, editar no canvas ou salvar todos de uma vez.

---

### Épico 4: Badges e Selos de Conversão no Canvas (ADS-04) — ✅ Concluído
- **Problema**: A imagem de anúncio precisa de gatilhos visuais de confiança e urgência.
- **Solução Implementada**:
  - Adicionada biblioteca de 15 novos selos vetoriais SVG de alta conversão estruturados em 4 categorias oficiais:
    - **Garantia & Confiança**: *"Garantia 30 Dias"*, *"Satisfação Garantida"*, *"Garantia 7 Dias"*, *"Compra 100% Segura"*;
    - **Frete & Entrega**: *"Frete Grátis Brasil"*, *"Envio Imediato 24h"*, *"Pronta Entrega"*;
    - **Avaliação Social**: 5 estrelas amarelas com badge *"Nota 4.9 (+1.200 avaliações)"*, *"#1 Mais Vendido"*, *"100% Original"*;
    - **Promoção & Urgência**: *"50% OFF Hoje"*, *"Compre 1 Leve 2"*, *"Últimas Unidades"*, *"Oferta Relâmpago"*, *"10% OFF no Pix"*.
  - Editor Fabric.js integrado com:
    - Aba dedicada **"🏷️ Selos"** na barra de navegação com filtros por chips de categoria;
    - Inserção direta no canvas como vetor SVG editável (arrastar, girar, redimensionar);
    - Painel de propriedades (`renderProps`) com chips de harmonização com o **Brand Kit** (`Primária`, `Secundária`, `Destaque`, `Texto`);
    - Propagação recursiva inteligente de cores em grupos SVG (preservando elementos de contraste e texto branco);
    - Timeout resiliente com `AbortSignal.timeout(1500)` para carregamento 100% offline;
    - Botão direto no fluxo de produto (`ProductFlowScreen`) para abrir a arte gerada no editor com selos;
    - Teste instrumentado executado e validado no Motorola real (`ZY32LMNN9B`) em 1,38s.

---

### Épico 5: Copiloto de Copywriting & Auto-Prompting (ADS-05)
- **Problema**: Usuários têm dificuldade de criar bons prompts de cenário e boas frases de venda.
- **Solução**:
  - Integração multimodal (Vision LLM remoto ou local):
    - O modelo analisa a foto do produto (ex: *"Tênis esportivo preto e laranja"*).
    - Sugere automaticamente:
      - 3 prompts de cenários ideais para aquele nicho;
      - 3 headlines de anúncio baseadas em fórmulas de marketing (AIDA, PAS - Problema/Solução);
      - Paleta de cores recomendada para o layout.
  - Um clique preenche o prompt de geração e os campos de texto do editor.

---

### Épico 6: Modo Catálogo para Marketplaces (ADS-06)
- **Problema**: Mercado Livre, Amazon e Shopee penalizam anúncios cuja foto principal não possui fundo 100% branco ou reprovam por formato incorreto.
- **Solução**:
  - Função específica **"Padrão Catálogo Mercado Livre / Amazon"**:
    - Fundo forçado em branco puro (#FFFFFF / RGB 255, 255, 255);
    - Geração de sombra de contato suave e realista (sem fundo, apenas a sombra sobre o branco);
    - Centralização com margem de 10-15% (requisito do algoritmo de busca dos marketplaces);
    - Exportação na resolução mínima recomendada (1200×1200 px).

---

### Épico 7: Infográficos de Benefícios / "Raio-X" (ADS-07)
- **Problema**: Na 2ª e 3ª foto de um anúncio de marketplace ou carrossel de Instagram, o cliente quer ver os diferenciais técnicos do produto.
- **Solução**:
  - Template com marcadores e linhas guias automáticas conectadas ao produto.
  - Exemplo: Linha apontando para a tampa: *"Tampa antivazamento"*; linha apontando para a base: *"Material antiderrapante"*; linha para o corpo: *"Aço inox térmico 24h"*.

---

### Épico 8: Interação Humana com o Produto (ADS-08)
- **Problema**: Produtos isolados no espaço têm menor conexão emocional.
- **Solução**:
  - Modelos generativos com ControlNet Inpainting para inserir:
    - Uma mão humana realista segurando a embalagem/produto;
    - Modelos humanos vestindo a peça (para calçados, roupas, óculos e joias).
  - Opções para escolher o perfil do modelo (masculino, feminino, tom de pele).

---

### Épico 9: Motion Ads / Micro-Vídeos MP4 (ADS-09)
- **Problema**: Vídeos em Reels e TikTok têm menor custo por clique (CPC) que fotos estáticas.
- **Solução**:
  - Pipeline de **Image-to-Video** curto (3 a 5 segundos) gerado na GPU remota:
    - Câmera realizando um slow zoom ou órbita suave ao redor do produto;
    - Feixe de luz passando pela embalagem (*light sweep*);
    - Animação de partículas ou fumaça sutil no fundo.
  - Exportação direta em `.mp4` pronta para upload nas plataformas de anúncios.

---

### Épico 10: Token por Instalação Emitido pelo `iawrapper` (SEC-01) — Substituído
> **Substituído em 2026-10-22 (sessão 38).** O dono decidiu por contas individuais: cada usuário cria a própria conta
> no `iawrapper` (login Google + e-mail/senha, sem créditos grátis, login na primeira abertura com a sessão guardada).
> O token anônimo por instalação descrito abaixo não será implementado. O desenho novo está no Épico 11 (Fase 4), e os
> pré-requisitos de backend em SEC-05, SEC-07 e SEC-13. O texto fica como histórico.
- **Origem**: sessão 34 (2026-10-22, `HANDOFF_APP_OFFLINE.md` §44). A tela "Gerar imagem" deixou de pedir servidor e
  credencial ao usuário leigo; a credencial do iawrapper passou a vir **no build** (`iawrapper.credential` do
  `local.properties` → `BuildConfig.IAWRAPPER_CREDENTIAL`, servida pelo `BuiltInSecretStore` do `AppGraph`).
- **Problema**: a credencial embutida é **a mesma em todos os APKs** e dá para extrair (`apktool`/`strings`). Quem a
  extrair gasta os créditos da conta de serviço inteira, e trocá-la exige publicar uma versão nova do app. Também não
  há limite por usuário nem como saber quem gastou o quê.
- **Estado atual verificado** (`d:\projects\iawrapper\ia_wrapper`):
  - `core/views.py::login` (`POST /api/auth/login/`, `AllowAny`): email+senha → `RefreshToken.for_user(user)` e
    devolve `access` + `refresh`.
  - `core/urls.py`: já existem `auth/refresh/` (`TokenRefreshView`), `auth/google/` e `users/`.
  - `settings.py::SIMPLE_JWT`: access de 60 min e refresh de 7 dias (configuráveis por env).
  - Os créditos são por `User` (`credits_balance`, `subscription_credits`, `one_time_credits`;
    `services/credit_service.py::CreditService`); sem saldo, `task_views` responde 402 `insufficient_credits`.
  - App: `IawrapperBackend.resolveAuthHeader` faz login quando o segredo tem `:` e guarda só o `access` em memória;
    num 401, refaz uma vez. **Não usa o `refresh`.**
- **Solução proposta**:
  1. **Backend**: `POST /api/auth/device/` (`AllowAny`), com body `{ "install_id": "<uuid v4>", "app": "product-photo",
     "integrity_token": "<opcional>" }`. Se o `install_id` não existir, cria um `User` de dispositivo (sem email real
     e sem senha utilizável) com uma cota inicial de créditos de teste; se existir, reemite. Devolve `access` + `refresh`
     no mesmo formato do `login`. Aplicar limite de taxa por IP e por `install_id`.
  2. **Anti-abuso**: cada reinstalação gera um `install_id` novo, e com ele créditos grátis. Por isso: cota inicial
     baixa, limite por IP, e numa segunda fase **Play Integrity** (`integrity_token` validado no servidor; sem ele,
     cota zero ou bem menor).
  3. **App**: um `DeviceTokenProvider` gera o `install_id` uma vez e guarda `install_id` + `refresh` na `SecretStore`
     (`FileSecretStore`/Keystore). O `IawrapperBackend` pede o `access` a ele; num 401, tenta o `auth/refresh/`, e se
     isso falhar, chama de novo o `auth/device/`. Depois, retirar o `IAWRAPPER_CREDENTIAL` do `BuildConfig` e o
     `BuiltInSecretStore`.
  4. **Depois (opcional)**: vincular a conta de dispositivo a um login Google (`auth/google/` já existe) para não perder
     créditos ao trocar de aparelho, e para comprar créditos.
- **A verificar antes de implementar**: se `User` exige `email` único e não nulo (nesse caso, usar um email sintético
  do tipo `device-<install_id>@devices.local`); se `RefreshToken.for_user` usa o `pk` desse `User` próprio
  (`core/models.py::User` é `models.Model`, não `AbstractUser`); e como o `TokenRefreshView` resolve esse usuário.
  - **Respondido em 2026-10-22 (Épico 11):** o `TokenRefreshView` não resolve esse usuário (busca no `auth.User`: dá
    500 ou valida o usuário errado), e ligar o `token_blacklist` quebraria o login. O SEC-05 vem antes do SEC-01.
- **Critérios de aceite**:
  - Backend: o teste de `auth/device/` cria o usuário na primeira chamada, reaproveita o mesmo usuário na segunda e
    responde 429 quando o limite de taxa estoura.
  - App: o teste de `IawrapperBackend` cobre access expirado → refresh → sucesso, e refresh inválido →
    re-registro → sucesso.
  - Um APK release sem nenhuma credencial embutida gera imagem no Motorola (`ZY32LMNN9B`).
  - `strings app-release.apk` não encontra a credencial.
- **Prioridade**: P1, obrigatório antes de distribuir o APK fora do círculo de teste.

---

### Épico 11: Segurança para Publicação e Hub Multi-App (SEC-02 a SEC-17)
- **Origem**: sessão 38 (2026-10-22, `HANDOFF_APP_OFFLINE.md` §48). O dono pediu o levantamento de todos os problemas
  de segurança do app e do `iawrapper`, lembrando que o `iawrapper` vai ser um **hub de IA para vários produtos e
  apps**. Só planejamento, sem código.
- **Decisões do dono (2026-10-22)**: cada usuário cria a própria conta no `iawrapper` (a conta padrão é só para
  testes); login Google + e-mail/senha; nenhum crédito grátis; login na primeira abertura, com a sessão guardada
  depois; RevenueCat é feature futura e fala servidor↔servidor com o `iawrapper` (a rota atual é herança do app
  legado). Isso substitui o desenho do Épico 10.
- **Fontes**: código do app; backend `d:\projects\iawrapper\ia_wrapper` (repositório privado `iawrappernew`, commit
  `4b8642c`, deploy no Railway pelo GitHub) e SPA `ia_wrapper_frontend`; 2 probes sem efeito colateral em produção;
  simplejwt 5.5.1 e DRF 3.16.1 lidos nos wheels do PyPI; 2 varreduras automáticas somente leitura.
- **Marcação**: **(V)** aberto e confirmado na sessão 38; **(A)** apontado pela varredura com arquivo:linha, a reabrir
  antes de corrigir.

#### Resumo: o que mais pesa
1. **Produção exposta agora.**
   - Admin com senha trivial (SEC-02).
   - Webhook que dá créditos sem autenticação (SEC-03).
   - `SECRET_KEY` vazado, que permite forjar JWT de admin (SEC-04).
   - Limite de login inútil: trocar o `X-Forwarded-For` troca o contador (SEC-07).
2. **Qualquer usuário com crédito roda o que quiser na GPU paga (SEC-15.1).**
   - O `workflow_json` do usuário substitui o da feature.
   - Os schemas aceitam qualquer campo, sem limite de tamanho, passos ou resolução.
   - Hoje a cadeia é: cadastro aberto + webhook aberto = créditos ilimitados + GPU livre. Remover o webhook e tirar o
     admin de teste fecham a cadeia até o código ser corrigido.
3. **Um usuário derruba o hub de todos os apps (SEC-15.5).**
   - `?sync=1` liberado para qualquer usuário.
   - Uma thread por task, sem teto.
   - 4 workers síncronos com timeout menor que o do provedor.
4. **O hub ainda não é multi-app (SEC-13).**
   - O `AppClient` existe, mas nada o usa; nenhum dado é separado por app.
   - Conta, carteira, catálogo e admin são globais.
   - As chaves de provedor são as mesmas para todos.
5. **A autenticação não aguenta contas reais (SEC-05/07).**
   - Não há verificação de e-mail nem revogação.
   - O refresh está quebrado e o `is_active` é ignorado.
6. **Dados pessoais sem prazo (SEC-12).** As fotos de entrada e saída ficam para sempre no banco (base64) e no CDN
   público, mesmo depois de excluir a conta.
7. **App (SEC-01, 08, 11).**
   - Credencial embutida no APK.
   - Release assinado com a chave de debug.
   - Catálogo remoto que grava fora da pasta.

#### iawrapper

##### SEC-02: Conta admin e credenciais de teste (P0)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | Crítico (V) | `admin@test.com` é admin em produção com senha de lista de senhas comuns. Ela está literal em `create_admin.py`, no `local.properties` e 3× no `IawrapperEndToEndInstrumentedTest.kt` (sem commit) | Admin real com senha forte. `admin@test.com` com senha aleatória e sem `is_admin`. Conta de teste comum. E2E por argumentos de instrumentação |
| 2 | Alto (A) | Credencial literal também em `test_full_iawrapper_flow.py:14` e `add_credits.py:6` | Ler de env |
| 3 | Alto (V) | `db.sqlite3` no histórico (`5af9d2b` a `7f1c4ae`) com o hash do mesmo admin. Repositório privado | Senha tratada como comprometida (item 1). Limpar o histórico antes de dar acesso a terceiros |

##### SEC-03: Webhook RevenueCat (P0 agora; requisitos da feature futura)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | Crítico (V) | A rota está no ar e falha aberta (probe com token inválido → 400). Credita os dígitos do `product_id` | Tirar `webhooks/revenuecat/` do `core/urls.py` até a feature |
| 2 | Futuro (V+A) | Idempotência por `exists()` sem `unique` (corrida credita 2×). `!=` em vez de `compare_digest`. Usuário buscado por id **ou** e-mail. Sem app nem checagem de sandbox. Plano → 500. `delete_user` apaga o ledger | Falhar fechado. `compare_digest`. `unique` em `external_ref`. `app_user_id` = id. Segredo e projeto por app. Ignorar sandbox. Conferir a compra na API REST. Ledger nunca apagado |

##### SEC-04: Segredos e configuração de produção (P0/P1)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | Crítico (V) | `SECRET_KEY` vazou num print (§44) e é o `SIGNING_KEY` HS256: forja JWT de admin | Rotacionar `SECRET_KEY`, `VAST_API_KEY`, `REPLICATE_API_TOKEN` e `CLOUDINARY_API_SECRET` |
| 2 | Alto (V+A) | Defaults inseguros: `SECRET_KEY` literal, `DEBUG=True` (e com ele `BACKGROUND_INLINE_TASKS`), `USE_SQLITE=True`, `CORS_ALLOW_ALL_ORIGINS=DEBUG` | Segredo sem default. Tudo desligado por padrão. Não subir sem as envs de produção |
| 3 | Médio (A) | Sem `SECURE_SSL_REDIRECT`, HSTS ou CSP. Browsable API ligada. `ALLOWED_HOSTS` default com `testserver` e `10.0.2.2` | Ligar redirect + HSTS. Browsable API desligada. Hosts só do env |
| 4 | Médio (A) | Token de provedor em texto puro no `config_json` (visível no Django admin) | Token só em env (`api_token_env`) |
| 5 | Baixo (A) | `api_token_env` aceita qualquer env (`SECRET_KEY`, `DATABASE_URL`). A mesma chave Vast faz rota e DELETE de instância | Allowlist de nomes. Chaves com escopo mínimo |
| 6 | A confirmar | Produção tem `DATABASE_URL`? Sem ela é SQLite no container: some a cada deploy e o `select_for_update` não trava | Confirmar no Railway. Exigir Postgres |

##### SEC-05: Sessão e tokens (P1)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | Alto (V) | `CustomJWTAuthentication.get_user`, `login` e `google_login` ignoram `is_active`: banir não corta acesso | Checar nos três e no refresh |
| 2 | Alto (V) | `auth/refresh/` busca no `auth.User` → 500 ou usuário errado | `TOKEN_REFRESH_SERIALIZER` próprio |
| 3 | Alto (V+A) | Nada revoga token. O `logout` falha calado. O `token_blacklist` quebraria o login. Trocar senha ou e-mail não derruba sessões | `User.token_version` no token, conferido na autenticação e no refresh. **Parte feita (SEC-07.8, `d19e073`, 2026-10-30):** logout e rotação revogam o refresh (blacklist com `CoreRefreshToken`). **Falta:** troca de senha/e-mail derrubar as sessões (implementado em `7082a78`, sem push) |
| 4 | Baixo (A) | `SessionAuthentication` ligada: a sessão do Django admin vale como outro `core.User` com o mesmo id | Tirar da API |
| 5 | Médio (A) | O SPA guarda o refresh em `localStorage` e não tem CSP | Cookie `HttpOnly`/`Secure`/`SameSite` + CSP |

##### SEC-06: Autorização e vazamento de dados (P1)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | Alto (V) | `GET /api/users/<id>/` sem checagem de dono: e-mail, saldo e `is_admin` de qualquer id | Só o próprio ou admin |
| 2 | Médio (A) | `GET features/*` e o detalhe da task expõem `config_json` (cadeia, margens, provedores), `worker_url` (IP:porta), `storage_key` e `model_ref` | Serializers públicos sem os dados internos |
| 3 | Médio (A) | `error_message = str(e)` com o corpo cru do provedor (trace do ComfyUI, IP do worker, account id do R2). Também vai para a `note` do ledger | Mensagem pública + código. Detalhe só no log |
| 4 | Baixo (A) | `UserSerializer` com `is_admin`/`email` graváveis (latente). Logs com e-mail e query string | `read_only_fields`. `LOGGING` com filtro de PII |

##### SEC-07: Contas individuais, cadastro e login (P1)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | Alto (V+A) | Cadastro e troca de e-mail sem verificação, e o Google liga por e-mail sem `email_verified`. Pré-sequestro: o atacante cria a conta com o e-mail da vítima e a vítima entra nela pelo Google | Verificar e-mail no cadastro e na troca. `email_verified` obrigatório. Só ligar contas verificadas |
| 2 | Alto (V) | Limite anônimo burlável: sem `NUM_PROXIES`, o DRF 3.16.1 usa o `X-Forwarded-For` inteiro como chave. Sem lockout. PBKDF2 em 4 workers síncronos (DoS de CPU) | `NUM_PROXIES` certo. `ScopedRateThrottle` por IP e por e-mail. Backoff. Cache compartilhado |
| 3 | Médio (A) | Sem `validate_password` no `core.User`. E-mail único sensível a caixa. Enumeração (mensagem e tempo) | Validadores. `lower(email)` único. Resposta e tempo iguais |
| 4 | Médio (V) | Conta Google não consegue se excluir | Confirmar com ID token novo. Exclusão no app e na web (Play) |
| 5 | — | Não há recuperação de senha nem envio de e-mail. Só um `GOOGLE_OAUTH_CLIENT_ID` | Reset com token de uso único. Provedor de e-mail. Audiences por app |

##### SEC-15: Execução, custo e abuso (P0 no código / P1)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | **Crítico (V)** | `vast_serverless_provider.py:86`: `payload.get('workflow_json')` tem prioridade sobre o binding, e `:91` faz o mesmo com o `modifier`. Nenhum schema tem `additionalProperties:false` (V). Com 1 crédito, o usuário roda um grafo ComfyUI arbitrário: qualquer nó, modelo ou lote na GPU paga, e talvez leia `input/`/`output/` de outros usuários no worker (A) | Workflow só do servidor. `additionalProperties:false` em todo schema. Campos permitidos por feature |
| 2 | Alto (V) | `width`/`height`/`steps`/`strength` sem mínimo e máximo, base64 sem tamanho máximo, preço fixo de 1 crédito. No timeout, o worker não é cancelado (A) | Limites por feature. Preço proporcional ao custo. Cancelar no deadline |
| 3 | Alto (V) | `passthrough_unmapped_inputs=True` em 2 bindings Replicate (`seed_product_photo_features.py:73,101`): o usuário passa `num_outputs`, `disable_safety_checker` ou `image=<URL>` (A) | Desligar o passthrough. Allowlist explícita |
| 4 | Alto (A) | O cancel estorna 100% e o provedor continua (`mark_processing` ignora estado terminal). Um loop criar/cancelar queima GPU de graça e pode entregar output de task estornada | Estornar só o cancelado de fato. Lock no fluxo. Limite de cancelamentos |
| 5 | Alto (A) | `?sync=1` para qualquer usuário. 1 thread por task, sem teto. gunicorn com 4 workers síncronos, `--timeout 120` (menor que os 240/540 s dos provedores). Sem limite de tasks em voo. Quatro requests travam a API de **todos os apps** | `sync` só interno. Fila (Temporal) com concorrência por usuário e por app. Timeouts alinhados |
| 6 | Alto (A) | Sem `MAX_IMAGE_PIXELS` (PNG de ~170 MP decodificado). Até 100 arquivos por request, reencodados e enviados ao CDN. O base64 não é validado nem tem o EXIF removido | `MAX_IMAGE_PIXELS`. Só os arquivos do schema. Limite de corpo (`DATA_UPLOAD_*` + gunicorn). Remover EXIF |
| 7 | Médio (V) | `_call_worker` faz POST com `verify=False` para a `url` que a Vast devolve, sem validar host nem esquema, levando fotos e URLs pré-assinadas | Verificar TLS (CA da Vast). Validar host e esquema. Sem redirect |
| 8 | Médio (A) | `image_url`/`photo`/`multiview_urls` de qualquer `http(s)` (localhost, 10.x, 169.254.x) vão ao worker, que baixa sem limite e devolve o erro: varredura da rede do host | Só URLs do nosso storage, ou só upload |
| 9 | Médio (A) | Tasks órfãs em `processing` nunca são tratadas; erro de upload deixa a task debitada | Reaper de `processing` com estorno. Estornar na falha de despacho |
| 10 | Médio (A) | Toda falha estorna por inteiro, e o Temporal tenta 3×. No Replicate, `classify_error` devolve `str` (vira TypeError e é retentado). Input que falha tarde custa até 3 execuções ao dono | Classificar o erro certo. Limitar retries |
| 11 | Baixo/Médio (A) | Retry sem lock (2 retries = débito 2× e execução 2×). `POST /tasks` sem Idempotency-Key. Refund não idempotente | Lock + chave de idempotência |
| 12 | Baixo (A) | `daily/monthly_credit_limit` são NULL por padrão e contam uso bruto. Sem teto global, por app ou em USD. `cost_estimate` não é usado | Teto em USD por usuário, app e global. Registrar o custo real de cada task |
| 13 | Baixo (A) | Deadline do RunPod compara `time.time()` com `monotonic()`. "nan" passa em min/max. Listagem N+1 com base64 duplicado (respostas enormes). Textos sem limite. Presigned PUT sem limite de tamanho, com o Content-Type definido pelo worker | Corrigir cada ponto |

##### SEC-12: Privacidade, retenção e moderação (P1, publicação)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | Alto (A) | Fotos em base64 para sempre em `input_payload`, `raw_request_json`, `result_payload`, `payload_json` e `raw_response_json`. O purge só zera `external_url`. Não existe `delete_object`. `delete_user` deixa os arquivos no CDN | Não guardar base64 no banco. Expurgo real (banco + CDN) com prazo. Excluir a conta apaga a mídia |
| 2 | Médio (A) | Cloudinary público, sem expiração e sem pasta por usuário ou app. R2 público sem assinatura (lifecycle a confirmar). A expiração é cosmética (`include_expired`, dados ainda devolvidos). Purge não agendado | URLs assinadas e curtas. Pasta por app e usuário. Lifecycle. Purge agendado |
| 3 | Médio (A) | Sem moderação de prompt nem de saída. Consentimento só em alguns seeds. `disable_safety_checker` acessível (SEC-15.3) arrisca banir as contas compartilhadas | Moderação por app. Consentimento em toda feature com foto de pessoa |
| 4 | — | Política de privacidade (fotos vão a GPUs de terceiros no Vast.ai), Data Safety, exclusão de conta | Antes de publicar |

##### SEC-13: Hub multi-app (P1, antes do 2º app)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | Alto (V+A) | `AppClient.api_key` não é lida por nenhum código, fica em texto puro e não rotaciona. `app_client` nunca é gravado nem filtrado. O JWT não carrega o app | App no cadastro e no token (`aud`). Filtro por app em todas as consultas |
| 2 | Médio (A) | Conta, carteira e catálogo globais. Faltam FKs de app em `Feature`, `CreditOffer`, `CreditTransaction`, `Payment` e `Task` | FKs + filtros (modelo de conta em aberto) |
| 3 | Médio (A) | `is_admin` global e único papel | Papéis: admin do produto × admin do hub |
| 4 | Alto | Chaves de provedor, CDN e limites compartilhados: um app abusado esgota o saldo e pode fazer banir as contas de todos. Sem custo, cota ou kill-switch por app | Orçamento, teto, throttle e kill-switch por app. Subconta ou chave por app quando o provedor permitir. Alerta de gasto |
| 5 | — | CORS, audiences do Google e segredos de webhook são globais | Configuração por app |

Identificação do app:
- App mobile não guarda segredo: uma chave no APK repete o SEC-01.
- Mobile: `app_id` público + **Play Integrity** (pacote + certificado) validado no servidor no login e no cadastro. O
  `aud` do JWT amarra a sessão ao app.
- Chave secreta (hash, prefixo, rotação) só para clientes servidor↔servidor.

##### SEC-14: Administração (P1)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | Médio (A) | Django admin em `/admin/` sem 2FA, allowlist ou limite. Edita `is_admin`, hash de senha e créditos sem ledger | Desligar em produção ou restringir (IP + 2FA). Crédito só pelo ledger |
| 2 | Médio (A) | `delete_user` apaga pagamentos, ledger e tasks em cascata. `DELETE feature` apaga as tasks de todos | Soft-delete + anonimização, mantendo o ledger |
| 3 | Médio (V) | `seed_features` a cada boot (`ia_wrapper/Dockerfile:20`) reverte `active`, `credit_cost`, `input_schema_json` e `config_json` (A): desfaz o kill-switch e os limites do SEC-15 | Seed só cria, nunca sobrescreve |
| 4 | Baixo (A) | `topup` sem validação. `refund_task` estorna 2×. `retry` ignora `feature.active`. Sem auditoria. `admin.py:126-128` aceita `javascript:` em href. `prompt_file` sem normalizar (só admin) | Validar. Idempotência. Respeitar o kill-switch. Log de auditoria. Só `https://`. Normalizar o caminho |

##### SEC-16: Repositório, build e dependências (P2)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | Médio (V+A) | Sem `.dockerignore`: um build local embute `.env` e `db.sqlite3` (o deploy pelo GitHub não, o `.gitignore` cobre). O `.gitignore` só pega `.env` exato. `deploy.ps1` faz `git add .` e push na main. 45 `.pyc` versionados. Dois Dockerfile/railway.json divergentes. Imagem roda como root, com tag flutuante e gcc | `.dockerignore`. `.gitignore` amplo. Deploy sem `git add .`. Um só Dockerfile, não-root, tag fixa, multi-stage |
| 2 | Baixo (V) | Django 5.2.8. O 5.2.9 corrigiu CVE-2025-13372 (SQLi em `FilteredRelation`/PostgreSQL) e CVE-2025-64460 (DoS no XML); já existe o 5.2.11. Risco baixo aqui, porque nenhum dict do usuário chega a `annotate` | Último 5.2.x. `pip-audit` e `npm audit` no CI |
| 3 | Baixo (A) | Código morto com débito sem lock (`views-image-nanobanana.py`, `service_utils.py`). `test_cloudinary.py` imprime o prefixo da chave | Remover |

##### SEC-17: Worker 3D Trellis (P1 se estiver no ar)
| # | Grav. | Achado | Correção |
|---|---|---|---|
| 1 | Alto (A) | Sem autenticação, HTTP em 0.0.0.0, CORS `*` com credentials, roda como root. O README manda expor a porta. Não valida `auth_data`. Se estiver público, qualquer um usa a GPU de graça (está atrás do PyWorker da Vast? a confirmar) | Só atrás do PyWorker ou com token. Não-root. CORS fechado |
| 2 | Médio (A) | `pytorch:2.1.2` (CVE-2025-32434 em `torch.load`, segundo a varredura). Requirements sem versão fixa. `git clone` sem commit fixo. Baixa URL sem limite e devolve `str(e)` | torch ≥ 2.6. Fixar versões e commit. Limitar downloads |

#### App Android
| ID | Grav. | Achado | Correção |
|---|---|---|---|
| SEC-01 | Alto (V) | Credencial do iawrapper no `BuildConfig` | Contas individuais (Fase 4) |
| SEC-08 | Alto (V) | Release assinado com a chave de debug, sem R8, sem trava contra credencial ou `http://` | Keystore própria + Play App Signing. R8. Trava no Gradle |
| SEC-09 | Médio (V) | `FileSecretStore` quebra quando a decifragem falha. Sem `dataExtractionRules` (D2D no Android 12+) | Regras de extração. Cofre ilegível → novo login |
| SEC-10 | Médio (V) | Tráfego sem TLS liberado para qualquer host | `domain-config` sem cleartext para iawrapper e HF. `http://` só para localhost ou IP privado |
| SEC-11 | Médio (V) | `file`/`thumb` (`MockupLibrary.kt:201-254`) e `id` (`SceneLibrary.kt:160`) do catálogo remoto viram caminho sem validação: um `../` grava fora da pasta. Aceita qualquer host, inclusive `http://`. Downloads sem limite de tamanho | Validar o nome + `canonicalPath`. Allowlist HTTPS. Limite de bytes e pixels. 2FA na conta HF. Catálogo fixado num commit ou assinado |
| — | Baixo (V) | `Http.call` e `downloadBytes` leem a resposta inteira na memória | Limite de tamanho |

#### O que já está bom (conferido)
- **App:**
  - editor isolado: `WebViewAssetLoader`, ponte restrita à origem, sem acesso a arquivo, CSP `script-src 'self'`;
  - a ponte só expõe salvar, compartilhar, imprimir, mockup e IA;
  - cofre no Keystore;
  - SHA-256 dos modelos;
  - tradução local (ML Kit);
  - o JWT não vai para o CDN;
  - logs sem segredo.
- **Backend:**
  - tasks, mídia e transações filtradas por usuário;
  - débito e estorno com `atomic` + `select_for_update` (no Postgres);
  - sem `eval`, `pickle`, `shell=True` ou SQL cru;
  - feature inativa → 404;
  - nome de upload não chega ao disco;
  - claims do JWT não usadas para autorização;
  - token de provedor mascarado na API;
  - `DEBUG` desligado em produção;
  - nenhum padrão de chave no histórico do git (backend e frontend).

#### Provas (comandos e resultados)
- **Webhook:** `curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer probe-invalido" -d '{}'
  https://iawrappernew-production.up.railway.app/api/webhooks/revenuecat/` → **HTTP 400**
  `{"error":"Campo event.type obrigatório"}`. Com o token configurado, seria 401.
- **DEBUG:** `curl https://iawrappernew-production.up.railway.app/api/rota-inexistente-probe/` → 404 genérico, sem a
  página de debug.
- **Senha do admin:** um script comparou, sem imprimir, `local.properties` × `create_admin.py` × os 3 literais do E2E
  → iguais. 8 caracteres, presente numa lista de senhas comuns.
- **Repositório:** `curl https://api.github.com/repos/luistiagos/iawrappernew` → 404 (privado).
- **Histórico:**
  - backend: `git -C ia_wrapper log --all --oneline -- db.sqlite3` → `7f1c4ae`, `5af9d2b`;
  - app: `git log --all -S"admin@test.com"` → vazio.
- **simplejwt 5.5.1 (wheel):**
  - `TokenRefreshSerializer.validate` faz `get_user_model().objects.get(...)` sem `try`;
  - `OutstandingToken.user` é FK para `AUTH_USER_MODEL`;
  - `JWTAuthentication.get_user` checa `CHECK_USER_IS_ACTIVE`, e o override do projeto não.
- **DRF 3.16.1 (wheel):** `SimpleRateThrottle.get_ident` sem `NUM_PROXIES` → `''.join(xff.split())`;
  `UserRateThrottle` usa o ident para anônimos.
- **Schemas:** `grep -rn additionalProperties core` → vazio. `vast_serverless_provider.py:86` lê
  `payload.get('workflow_json')` antes do binding.
- **Logs do app:** `grep` de `Log.*`/`println` com token/secret/senha em `src/main` → vazio.
- **Android 12+:** `allowBackup="false"` não bloqueia D2D (`IGNORE_ALLOW_BACKUP_IN_D2D`; documentação de behavior
  changes do Android 12 e de Auto Backup).
- **Django:** o 5.2.9 (2025-12-02) corrigiu CVE-2025-13372 e CVE-2025-64460, e existe o 5.2.11 (djangoproject.com).

#### Hipóteses descartadas
- *O JWT vaza para o CDN ao baixar o `external_url`*: não, `Http.call` usa `sendAuth = !isAbsolute`.
- *Produção está com `DEBUG=True`*: não, o 404 é o genérico.
- *O admin consegue redirecionar as chamadas dos provedores*: não. O `config_json` só tem token (mascarado no GET) e
  nome/id de endpoint da própria conta, sem URL.
- *Ligar o `token_blacklist` resolve a revogação*: não. `OutstandingToken.user` é FK para `auth.User`, e o login
  quebraria. Usar `token_version`.
- *R8/ofuscação protege a credencial do APK*: não. Só tirar a credencial resolve (SEC-01).
- *Cadastro aberto dá créditos grátis*: não (saldo inicial 0). Os créditos grátis vinham do webhook aberto.
- *O build do Railway embute `.env`/`db.sqlite3`*: não. O deploy vem do GitHub, e o `.gitignore` cobre os dois; só um
  build local embute.
- *O Dockerfile da raiz `d:\projects\iawrapper` é o de produção*: não. A raiz não é repositório; o deploy usa
  `ia_wrapper/Dockerfile`, que roda `seed_features` a cada boot.
- *A tradução do prompt usa serviço remoto com chave*: não, é o ML Kit local.
- *A ponte do editor abre URL, intent ou caminho escolhido pela página*: não. Só salvar, compartilhar, imprimir, mockup
  e IA.
- *Os blobs do editor permitem path traversal*: não, usam UUID + extensão validada.

#### Fases (para quando for implementar)
- **Fase 0, hoje, ações do dono:** SEC-02.1, SEC-03.1, SEC-04.1, e confirmar SEC-04.6 e SEC-17.1. Com isso se fecha a
  cadeia "cadastro + créditos grátis + GPU livre".
- **Fase 1, backend urgente:** SEC-15.1–3 (workflow, schemas, passthrough), SEC-14.3 (seed), SEC-15.5 (sync/threads),
  SEC-07.2 (`NUM_PROXIES`).
- **Fase 2, base de contas:** SEC-04.2–5, SEC-05, SEC-06, SEC-07, o restante do SEC-15, SEC-14, SEC-12.1–2, SEC-16.
- **Fase 3, hub:** SEC-13 (app no cadastro e no token, FKs, papéis, orçamento por app, Play Integrity).
- **Fase 4, app (SEC-01 + SEC-08 a SEC-11):**
  1. Tela de entrada na primeira abertura (Google via Credential Manager → `auth/google/`; e-mail/senha com cadastro,
     login, esqueci a senha e aviso de verificação).
  2. `AuthSession`: refresh no `FileSecretStore`, access em memória. Num 401, refresh; se falhar, volta à tela de login.
  3. Sessão de cerca de 90 dias com rotação.
  4. Sem rede, o app abre normalmente.
  5. 402 e `email_not_verified` com mensagem para leigo.
  6. Sair e excluir conta.
  7. Remover `IAWRAPPER_CREDENTIAL` e o `BuiltInSecretStore`.
- **Fase 5, publicação:** SEC-12.3–4 (moderação, privacidade, Data Safety). **Futuro:** RevenueCat (SEC-03.2).

#### Verificação (quando for implementado)
- **Backend:**
  - probe do webhook → 404;
  - senha antiga do admin → 401;
  - task com `workflow_json` ou campo extra → 400;
  - `width=16384` → 400;
  - `?sync=1` de usuário comum → recusado;
  - tasks em voo acima do limite → 429;
  - cancel não estorna o que o provedor executou;
  - imagem de 170 MP → 400;
  - verificação de e-mail e reset de uso único;
  - Google `email_verified=false` → 401;
  - refresh de `core.User` → 200;
  - inativo → 401;
  - após logout ou troca de senha, refresh antigo → 401;
  - A lendo B → 404;
  - limite → 429 mesmo trocando o `X-Forwarded-For`;
  - token do app A numa feature do app B → 403;
  - expurgo apaga banco e CDN;
  - reiniciar não reverte o que o admin mudou.
- **App:**
  - teste do `AuthSession`;
  - no moto (`ZY32LMNN9B`): login na primeira abertura, reabrir sem login, gerar com a conta do usuário, abrir sem
    rede;
  - catálogo com `../` é recusado;
  - `assembleRelease` com credencial falha;
  - `strings` no APK release não acha credencial.

#### A confirmar / decisões em aberto
- ~~Produção tem `DATABASE_URL` (Postgres)? (SEC-04.6)~~ Sim (2026-10-30): o serviço `iawrappernew` tem
  `DATABASE_URL`, e o Postgres responde (ver "SEC-13.2 — cadastro por app").
- O worker Trellis está exposto ou atrás do PyWorker da Vast? (SEC-17.1)
- Existe lifecycle no R2 e cron do `purge_expired_tasks`? (SEC-12.2)
- Conta e carteira: únicas para todos os apps ou por app? (SEC-13.2) — **decidido e desenhado em 2026-10-30, ver
  "SEC-13.2 — cadastro por app (desenho)".** Registro original: isonomia por app. Crédito comprado num app não vale em outro, então o cadastro fica ligado
  a um app: baixar outro app = outro cadastro, mesmo com o mesmo e-mail Google. O custo em créditos por
  funcionalidade continua global no iawrapper; o que varia por app é a monetização (preço do crédito, créditos de
  cortesia, planos), que é feature separada e não entra nessa discussão. A conta admin de teste pode seguir única
  para todos os apps. Pontos do código que essa decisão toca (abertos em 2026-10-29/30, ainda sem desenho):
  `User.email` é `unique=True` global (`core/models.py:22`) e teria de virar único por (app, e-mail); `User.app_client`
  já existe (migração `0009`) mas nunca é gravado (SEC-13.1); o `google_login` e o `login` buscam só por e-mail; o
  contador do SEC-07.7 (`LoginFailure.email`) e a isenção `LOGIN_LOCKOUT_EXEMPT_EMAILS` são por e-mail, sem app; o
  JWT não carrega o app (`aud`); como o app se identifica sem segredo no APK está nas notas "Identificação do app"
  do SEC-13.
- Provedor de e-mail. Validade da sessão.

#### Fase 1: registro da implementação (2026-10-26)
Backend `d:\projects\iawrapper\ia_wrapper`, sobre o `4b8642c` + as mudanças sem commit do provider Vast (deadline
monotônico, autocura de workers), que foram preservadas. Linha de base: `python manage.py test core.tests` → 139 OK
(`manage.py test core` falha por conflito `core/tests.py` × `core/tests/`).

**Símbolos abertos:**
- `vast_serverless_provider.py::_process_image` — `workflow_json` e `modifier` do payload vencem o binding (SEC-15.1).
  Os demais campos já são lidos um a um (`prompt`, `width`…); com o schema fechado, só chegam campos permitidos.
- `task_service.py::_validate_input` — `jsonschema.validate` com o schema do banco; sem schema, não valida nada.
  `_normalize_input` faz `int()`/`float()` sem `try` (string ruim → 500) e aceita `"nan"`.
- `task_views.py::task_list_create` — todo campo do corpo (menos `feature_slug`) vira `input_payload`, inclusive
  `sync`. `sync` roda `_run_inline` no request para qualquer usuário. `_start_background_inline` = 1 thread por task.
  `task_retry` despacha de novo sem teto.
- `replicate_provider.py::_build_provider_input` — `passthrough_unmapped_inputs` copia qualquer chave do payload.
- `seed_features.py` (roda a cada boot, `Dockerfile:20`) usa `update_or_create` em provider, binding e feature. Os
  seeds Vast/product-photo/serverless não rodam no boot (só à mão), mas também sobrescrevem.
- `settings.py::REST_FRAMEWORK` sem `NUM_PROXIES`; só `UserRateThrottle` (300/min, também para anônimos).
- DRF 3.16.1 instalado, `BaseThrottle.get_ident`: com `NUM_PROXIES=n`, usa `xff.split(',')[-n]`; sem XFF, `REMOTE_ADDR`.
  `SimpleRateThrottle.THROTTLE_RATES` é atributo de classe lido no import (teste precisa de `patch.object`).

**O que o app manda (não pode quebrar):** `IawrapperBackend.kt` envia `sync=true` por padrão e **faz polling** se a
resposta não for terminal; `product-photo-vast` recebe `prompt, negative_prompt, width, height, steps, seed,
init_image, mask_image, strength` (os 4 últimos fora do schema atual); relight manda `steps` (fora do schema) e
`light_direction` ∈ `LightDirection` (AMBIENT, LEFT, RIGHT, TOP, BACKLIGHT); outpaint manda `negative_prompt` e `steps`
(fora do schema). Texto→imagem do app: lado ≤ 1024 (`GEN_MAX_SIDE`). Outpaint: tamanho da foto de origem. O SPA só
envia os campos das `properties` do schema (`FeaturePage.tsx`).

**Hipóteses descartadas:**
- *Corrigir os seeds basta para os limites chegarem à produção*: não. Seed passa a só criar, e os seeds Vast nem rodam
  no boot; os schemas novos vão por **migração de dados**.
- *Confiar no `additionalProperties:false` gravado no banco*: não basta; um admin ou feature sem ele reabre. O fechamento
  é feito no código, para todo schema (o do banco também ganha o campo, por documentação).
- *Recusar `sync` com 403*: quebraria o app em campo (sync padrão). O `sync` de usuário comum é **ignorado** (vira
  assíncrono, o app já faz polling); só admin roda síncrono.

**Tasks (arquivo → teste):**
1. SEC-15.1: workflow/modifier só do binding (`_process_image`) → `test_vast_ignores_user_workflow_and_modifier`.
   Schema sempre fechado (`_validate_input`), `sync` fora do payload (view) → POST com `workflow_json`/campo extra = 400.
2. SEC-15.2: limites por feature nos schemas Vast (seed + migração `0011`); erro de conversão e `nan` → 400 →
   `width=16384` = 400; `steps=500` = 400; payload do app = 201.
3. SEC-15.3: passthrough removido do código e dos seeds → teste do `_build_provider_input` sem chave extra.
4. SEC-14.3: todos os seeds com `get_or_create` → mudar feature, rodar `seed_features`, nada revertido.
5. SEC-15.5: `sync` só admin; teto de tasks em voo por usuário (429, sem débito) no create e no retry; pool limitado
  no lugar de 1 thread por task; gunicorn `--timeout 300` (> 240 s do Vast) → testes de sync e 429.
6. SEC-07.2: `NUM_PROXIES` (env, padrão 1 = proxy do Railway) → 429 mesmo trocando o XFF.

**Fora da Fase 1, anotado:** preço proporcional ao custo e cancelar o worker no deadline (resto do SEC-15.2); o
`webhooks/revenuecat/` ainda está no `core/urls.py` (SEC-03.1, Fase 0). Confirmar por probe que o Railway tem 1 hop.

**Resultado (implementado, sem commit no `iawrapper`):**
- Arquivos: `vast_serverless_provider.py`, `replicate_provider.py`, `task_service.py` (`ensure_in_flight_capacity`,
  `TooManyTasksInFlightError`, schema fechado, conversão segura), `task_views.py` (`sync` só admin, 429, pool
  `_get_inline_executor`), `settings.py` (`INLINE_TASK_WORKERS=8`, `MAX_IN_FLIGHT_TASKS_PER_USER=3`,
  `IN_FLIGHT_WINDOW_SECONDS=900`, `NUM_PROXIES=1`, todos por env), os 4 seeds (`get_or_create`; schemas em
  `seed_vast_features.py`), `migrations/0011_harden_feature_input_schemas.py`, `Dockerfile`/`Procfile`
  (`--timeout 300`). Testes: `core/tests/test_security_phase1.py` (31).
- `python manage.py test core.tests` → **170 OK** (139 + 31). `makemigrations --check` → sem mudança de modelo.
- **Depois do deploy, conferir:** POST com `workflow_json` → 400; `width=16384` → 400; o app gera no moto (agora
  assíncrono, por polling); login com XFF trocado → 429 na 301ª tentativa/min. Se o limite anônimo disparar para
  todos ao mesmo tempo, o Railway tem mais de 1 hop: ajustar `NUM_PROXIES`.
- **Risco no app:** sem `sync`, o `IawrapperBackend` faz polling a cada 250 ms (240 GET/min por geração) contra o
  limite de 300/min por usuário. Cabe, mas apertado: subir `pollMs` para ~1500 e mandar `sync=false`. Relight com foto
  acima de ~12 MB em base64 agora dá 400 (o app cai no relight local).

#### Próxima sessão: SEC-03.1 + commit da Fase 1 (passagem de bastão, 2026-10-26)
Estado: Fase 1 pronta e verde (170 OK), **sem commit**, no `main` do `iawrapper` (repo `iawrappernew`, deploy no
Railway a cada push na `main`). Testes: `cd d:\projects\iawrapper\ia_wrapper; python manage.py test core.tests`
(o rótulo `core` sozinho falha: conflito `core/tests.py` × `core/tests/`). Banco de teste = SQLite (`.env` sem
`DATABASE_URL`).

1. **SEC-03.1, tirar o webhook do ar** (o dono já tinha aprovado a correção no épico; é a Fase 0 que falta em código):
   - `core/urls.py:12` — remover o `path('webhooks/revenuecat/', ...)` e o import `revenuecat_views` (linha 8).
     **Manter** `core/revenuecat_views.py`: é a base da feature futura (SEC-03.2).
   - `core/tests/test_revenuecat_and_app_client.py::RevenueCatWebhookTests` (5 testes) usa
     `reverse('revenuecat_webhook')` no `setUp` (linha 44) → `NoReverseMatch`. Corrigir chamando a view direto com
     `APIRequestFactory` (ou um `ROOT_URLCONF` de teste só para essa classe), sem religar a rota.
   - Teste novo: `POST /api/webhooks/revenuecat/` → **404** (é a verificação "probe do webhook → 404" do épico).
   - Rodar a suíte: esperado 171 OK.
   - **Análise na execução (2026-10-26):** a classe tem **6** testes, não 5, e há um **7º chamador**:
     `test_credit_buckets_and_margin.py::test_revenuecat_webhook_subscription_vs_package_routing` faz POST no caminho
     literal `/api/webhooks/revenuecat/` (linhas 289 e 318). Correção escolhida: `ROOT_URLCONF` de teste
     (`core/tests/revenuecat_urls.py`, só a rota `api/webhooks/revenuecat/`) via `@override_settings` na classe e
     nesse método; os testes continuam pelo cliente HTTP, sem reescrever as chamadas. O 404 em produção está garantido:
     o catch-all do SPA em `ia_wrapper/urls.py` exclui `api/` (`^(?!api/|admin/|static/).*`), então a rota removida
     não cai no `index.html`.
2. **Commit no `iawrapper`:** criar branch (não commitar direto na `main`, que faz deploy). Incluir: Fase 1 (lista
   em "Resultado" acima), migração `0011`, `test_security_phase1.py`, o SEC-03.1 e as mudanças anteriores do provider
   Vast (`vast_serverless_provider.py` + `test_serverless_providers.py`, deadline monotônico e autocura).
   **Não incluir** `test_full_iawrapper_flow.py` nem `test_generate_image.py` (soltos, com credencial literal, SEC-02.2).
   Antes do merge/push na `main` (= deploy), **perguntar ao dono**.
   **Feito (2026-10-26):** passos 1 e 2 concluídos. `python manage.py test core.tests` → **171 OK**;
   `makemigrations --check` → sem mudança. Commit `36e4e7a` na branch local `security/phase1-hardening` (18 arquivos,
   **sem push**). Ficaram fora, não rastreados: `test_full_iawrapper_flow.py` e `test_generate_image.py`.
   Branch publicada em `origin/security/phase1-hardening` (2026-10-26); `origin/main` ainda em `4b8642c`, então o
   merge é fast-forward. **Próximo passo:** o dono faz o merge na `main` (= deploy); o push direto da sessão foi
   bloqueado pela permissão de deploy em produção.
   **Deploy feito pelo dono (2026-10-26):** `origin/main` = `36e4e7a`.
   **Probes pós-deploy, sem login (2026-10-26):** `GET /health/` → 200; `POST /api/webhooks/revenuecat/` → **404**
   (antes do deploy, 400; prova que o código novo está no ar); `POST /api/rota-inexistente-probe/` → 404. **SEC-03.1
   fechado.** Os demais checks do "Resultado" pedem login (`/api/features/*` e `/api/tasks/` são `IsAuthenticated`).
   **Checks com login (2026-10-26):** usuário de teste comum criado a pedido do dono (`luistiago.andrighetto@gmail.com`,
   id 2, 0 crédito, não admin; **apagado depois, a pedido do dono**: delete → 200, login → 401). `GET /api/features/product-photo-vast/`
   → 200, `width` com `maximum: 1024` e `additionalProperties: false` (a `0011` rodou). `POST /api/tasks/` com
   `workflow_json` → **400** ("Additional properties are not allowed"); `width=16384` → **400**; `steps=500` →
   **400**. A validação vem antes do débito e da criação da task (`TaskService.create_task`), então nada foi criado.
   **Pendentes:** login com XFF trocado → 429 (301 logins contra produção, aguarda OK do dono) e o app no moto (dono).
   **Achado novo (fora do escopo da Fase 1):** `settings.py` não define `CACHES` → o throttle do DRF
   (`UserRateThrottle`, `user: 300/min`, único da API; o `login` não tem throttle próprio) conta no `LocMemCache`, que
   é **por processo**, e o gunicorn sobe com `--workers 4` (`Procfile`/`Dockerfile`). Limite efetivo: entre 300 e
   ~1200/min por IP, conforme o balanceamento entre workers; ~~o `task_create: 30/min` sofre o mesmo~~ (errado: o
   `task_create` não é aplicado em view nenhuma, ver análise SEC-07.6 de 2026-10-29). Correção: cache
   compartilhado (Redis ou `DatabaseCache`). Teste do XFF: requisições baratas (login com e-mail inexistente, sem
   hash de senha) com XFF diferente em cada uma, até o 1º 429 ou 1300 requisições.
   **Resultado (2026-10-26):** usuário descartável `teste-a600ce6f@example.com` criado (201, login 200; senha fora do
   repo). Rajada de **1300 logins com XFF trocado → 1300 × 401, nenhum 429**. Inconclusivo: o controle (mesma rajada
   **sem** XFF, medindo o tempo) foi bloqueado pela permissão da sessão. Hipóteses abertas: (a) contador por worker
   (certo pelo código; com 4 workers precisa de >1200 em 60 s, e a duração da rajada não foi medida); (b) mais de uma
   réplica no Railway; (c) o edge do Railway **não acrescenta** o IP real no XFF e o DRF 3.16.1 pega o último item
   (`throttling.py::BaseThrottle.get_ident`: `addrs[-min(num_proxies, len(addrs))]`), aí o XFF forjado escapa.
   **Próximo passo (dono):** rodar `throttle_control.py noxff 1300` (no scratchpad desta sessão) e comparar; se sem
   XFF der 429 e com XFF não → (c). Independente disso: cache compartilhado para o throttle (vira task própria).
3. **Depois do deploy** (o dono avisa): rodar as conferências de "Resultado" e o probe do webhook
   (`curl -X POST .../api/webhooks/revenuecat/` → 404). Em produção a `0011` roda no boot (`migrate` do Dockerfile).
4. Opcional, no app (este repo): `IawrapperOptions` em `IawrapperBackend.kt:20-26` → `pollMs` ~1500 e `sync=false`.
   **Feito (2026-10-26):** defaults `sync = false`, `pollMs = 1_500`. Único construtor de produção é
   `ImageFactories.kt::IawrapperImageFactory.options` (só slug e passos, herda o resto). Sem `sync`, o campo nem vai
   no corpo (o servidor ignoraria para não admin). Teste: `IawrapperBackendTest` → defaults não mandam `sync`.
5. **Teste no moto (2026-10-26, em andamento):** `app/build.gradle.kts::iawrapper()` passou a dar precedência a
   `-P` > env `IAWRAPPER_*` > `local.properties` (antes o arquivo vencia, e o `local.properties` aponta para
   `http://127.0.0.1:8000` com o admin). APK debug gerado com `IAWRAPPER_URL` de produção e a credencial do
   descartável `teste-a600ce6f@example.com` (não admin, recebeu 50 créditos via `/api/admin/credits/topup/` → 200).
   Falta: aparelho no `adb devices` (estava vazio), instalar, gerar uma foto e conferir no logcat o polling a 1,5 s.
   **Resultado (23:34–23:39 local):** moto g86 por ADB sem fio, APK instalado, "Gerar imagem" com prompt e 512×512.
   O app criou a **task 22 assíncrona** (`processing` logo após o POST, sem `sync`). Às 02:38:58Z o servidor a marcou
   `failed`: "Vast.ai sem capacidade para endpoint iawrapper (deadline excedido)", ~4 min; crédito estornado (saldo
   voltou a 50). Lado app inconclusivo: às 23:35 outro app foi para o primeiro plano e o `moto_freezer` congelou o
   processo, então o fim do polling e a mensagem de erro na tela não foram vistos. **Pendente:** (a) worker do Vast
   sem capacidade em produção (dono: conferir o endpoint no Vast); (b) repetir no moto com o app em primeiro plano.
   Nota: o login do `admin@test.com` com a senha do `local.properties` **funciona em produção** (Fase 0 pendente).

#### Próxima sessão: Vast sem capacidade em produção (passagem de bastão, 2026-10-28)
**Sintoma:** task 22 (usuário descartável `teste-a600ce6f@example.com`, feature `product-photo-vast`, criada pelo app no
moto, assíncrona) → `failed` com "Vast.ai sem capacidade para endpoint iawrapper (deadline excedido)". Criada
02:34:56Z, encerrada 02:38:58Z (2026-10-27) = **~242 s**. Crédito estornado (saldo 50).

**O que já se sabe (código aberto):**
- `core/providers/vast_serverless_provider.py::VastAIServerlessProvider._get_route` (l. 383–440) — loop no
  `POST https://run.vast.ai/route/` com `{endpoint, cost}`. A mensagem exata vem da **l. 401**: o prazo acabou no topo
  do loop, ou seja, o `/route/` respondeu 2xx **sem `url`** durante todo o prazo (worker não ficou pronto). Erros que
  ele NÃO deu: 401/4xx → `ProviderInputError`; 429 → `ProviderRateLimitError`; 5xx → `ProviderServerError`; falha de
  rede → `ProviderConnectionError`. Logo a chave Vast em produção **autentica** e o endpoint `iawrapper` existe.
- Prazo: `process` (l. 65–76) usa `binding.config_json['max_wait_seconds']`, padrão `_DEFAULT_MAX_WAIT_SECONDS = 240`
  (l. 31). O seed (`seed_vast_features.py:114–116`) não define `max_wait_seconds` → 240 s, que bate com os 242 s.
- Autocura (l. 432–437, `_heal_unavailable_workers` l. 442–467): após 30 s e a cada 60 s, destrói só workers com
  status `'unavail'`; falha dela só vira `logger.warning`. Não mexe em `loading`/`stopped`/inexistente.
- Cache de rota `_ROUTE_CACHE` (TTL 180 s, l. 26–28) é por processo; não influi aqui (falhou antes de obter rota).

**Hipóteses a testar (na ordem):**
1. Endpoint sem worker quente (`min_load`/`cold_workers` = 0) e cold start do ComfyUI > 240 s. Prova: config do
   endpoint e status dos workers durante uma geração.
2. Workers presos em `loading`/`stopped` (a autocura só pega `unavail`). Prova: lista de workers.
3. Saldo da conta Vast esgotado → autoscaler não aluga máquina. Prova: saldo da conta.
4. Sem oferta de GPU que case com o template (preço máximo/filtro). Prova: logs/eventos do endpoint no console Vast.
- *Descartada:* chave Vast inválida/rotacionada — daria 401 → `ProviderInputError`, não "sem capacidade".

**Comandos (somente leitura; chave = `VAST_API_KEY` do Railway; a do `.env` local existe mas pode ser outra):**
- Endpoint: `GET https://console.vast.ai/api/v0/endptjobs/` (Bearer) → item com `endpoint_name == 'iawrapper'`:
  anotar `id`, `min_load`, `cold_workers`, `max_workers`, `target_util`.
- Workers: `POST https://run.vast.ai/get_endpoint_workers/` `{"id": <id>}` → status de cada worker.
- Saldo: `GET https://console.vast.ai/api/v0/users/current/` → `credit`.
- Logs do Railway na janela 02:34–02:39Z de 2026-10-27: procurar "Autocura de workers Vast.ai falhou",
  "Destruindo worker Vast.ai", "Reutilizando worker route".
- Reproduzir sem o app: `POST /api/tasks/` com o descartável e observar os workers em paralelo. Credencial e scripts
  (`watch_tasks.py`, `topup_throwaway.py`) ficaram no scratchpad da sessão de 2026-10-26:
  `C:\Users\luist\AppData\Local\Temp\claude\c--projects-sandbox-product-photo-offline\2b13696e-73ee-453c-a57b-220d1e114d7d\scratchpad\`
  (`iawrapper_throwaway_user.txt`). Se a pasta tiver sumido, criar outro descartável (`POST /api/users/`).

**Tasks prováveis (decidir depois da prova):**
- Se H1: `max_wait_seconds` maior no binding (assíncrono agora aguenta; o app espera 300 s em `IawrapperOptions.maxWaitMs`
  → subir junto) e/ou `cold_workers >= 1` no endpoint (custo: dono decide). Teste: task de ponta a ponta = `success`.
- Se H2: estender a autocura a `stopped`/`loading` além de N s → teste em `test_serverless_providers.py`.
- Se H3/H4: ação do dono no console Vast, sem código.

**Resultado da investigação (2026-10-28, chave = `VAST_API_KEY` do Railway via `railway run --service iawrappernew`;
scripts `vast_probe*.py` e `repro_watch.py` no scratchpad da sessão `bfbee94e-...`):**
- Config (`GET endptjobs` + `GET autojobs`): endpoint `iawrapper` id **42006**, `min_load 0`, `cold_workers 0`,
  `max_workers 2`, `inactivity_timeout 600`; workergroup 52129: `min_load 1`, `cold_workers 5`, template 457471,
  `gpu_ram >= 4000`, `verified`, imagem `vastai/comfy:v0.20.1-cuda-12.9-py312`. Nenhum worker quente garantido.
- Estado hoje antes do teste: **1 worker, 57906263 (RTX 5090, machine 145047), `unavail`**, instância `stopped`
  (`intended_status stopped`, parada por inatividade). A GPU dessa máquina está **alugada por outro** (`bundles`
  com `machine_id 145047, rentable` → 0 ofertas; a oferta 45669486 aparece com `rented: true`), então a instância
  não volta. O autoscaler **não** recrutou o 2º worker sozinho, apesar de `max_workers 2`.
- **Causa da task 22 = H1.** A instância 57906263 tem `start_date` = **2026-10-27 02:35:03Z, 7 s após a task 22**
  (02:34:56Z): não havia worker, o autoscaler criou um na hora e ele não ficou pronto em 240 s (`ready_ever: true` →
  ficou pronto depois do prazo). A autocura rodou sem achar `unavail` (prova abaixo de que o log chega ao Railway;
  na janela 02:30–02:45Z só há access log). Cold start varia por host: >240 s nessa RTX 5090 vs. 48 s hoje.
- **Reprodução (task 23, 10:18 local, 512×512, 8 passos, descartável):** +11 s worker `unavail` → +47 s a autocura
  destrói (log no Railway: "Destruindo worker Vast.ai 57906263 indisponivel no endpoint iawrapper") → +58 s
  autoscaler cria 58099685 (RTX PRO 5000) → `created` → `model_loading` → `idle` em +106 s → **`success` em 118 s**,
  saldo 50 → 49. Ou seja: H2 é real (worker `unavail` bloqueia o recrutamento) e a autocura atual resolve; se a
  próxima task tivesse caído num host lento, falharia de novo por H1.
- H3 descartada: `credit` **US$ 6,83**, `can_pay: true` (baixo: avisar o dono). H4 descartada: 461 ofertas casam
  com o `search_query`; recrutamento em 11 s.
- Achado lateral: log "Task 23 já está em estado terminal (success). Ignorando complete_success." → a conclusão é
  chamada duas vezes no caminho de sucesso (inofensivo hoje; registrar à parte).

**Restrição do dono (2026-10-28):** aumentar o prazo está fora de questão; em produção a imagem tem de sair "na hora".

**Medição do worker frio (2026-10-28, `cold_resume.py`, log `cold_resume.log` no mesmo scratchpad):**
- O worker frio da task 23 (58099685, machine 147614) parou por inatividade e, em < 1h30, a GPU foi realugada por
  outro (`bundles` `machine_id 147614, rentable` → 0) → `unavail`. **2 de 2** workers parados foram "roubados".
- Task 24 (sem worker utilizável): autocura destrói o `unavail` em +38 s, worker novo (RTX 5070 Ti) `idle` em +107 s,
  **`success` em 112 s**.
- Task 25, disparada logo que o worker parou (`stopping`/`stopped`, 10 min sem uso): `starting` → `idle` em ~20 s,
  **`success` em 29 s**. É o melhor caso do frio (GPU com certeza livre).
- Conclusão: frio = ~30 s se a GPU continuar livre, ~110 s ou falha (task 22) se foi realugada, o que é o comum.
  Não atende "na hora". Só o worker quente (`min_load > 0`, GPU paga 24 h) dá ~10 s; ou fallback por imagem
  (Replicate) quando não há worker pronto.

**Decisão do dono (2026-10-28): Replicate (FLUX Schnell) como principal, Vast como fallback.** Até 20 s é
espera demais para o cliente.

**Análise para a implementação (repo `d:\projects\iawrapper\ia_wrapper`, `main` = `36e4e7a`):**
- `core/task_views.py::_run_inline` (l. 137–169) — caminho de **produção** (`FORCE_INLINE_TASKS=True` no Railway →
  `_dispatch_task` → `_start_background_inline`, thread no worker do gunicorn). Roda **só** `task.provider_key` com
  `provider.process(task, attempt)`, **sem `binding` e sem `deadline`** (o Vast cai no padrão de 240 s). **Ignora a
  `execution_chain`.** Em erro: `complete_failure` com `str(e)`. No sucesso chama `_db_mark_success` (que já chama
  `TaskService.complete_success`) **e** `complete_success` de novo → é a origem do log "Task 23 já está em estado
  terminal" (inofensivo, corrigir junto).
- `core/temporal/workflows.py::DynamicFallbackWorkflow` (l. 76–147) — a semântica de cadeia já especificada:
  por elo, `1 + max_retries` tentativas com `retry_backoff_seconds`; `input_error` falha a task na hora (falharia em
  qualquer provedor); elo com provider/binding inativo é pulado; erro fora de `failover_conditions` (padrão `["all"]`)
  não transborda; no fim "Cadeia de provedores esgotada. Último erro: ...". Só roda com Temporal (não usado em prod).
- `core/temporal/activities.py` — `_db_start_attempt` (cria `TaskAttempt` com `metadata_json.step/model_binding_key`,
  ou registra o pulo e devolve `None`), `_db_close_attempt` (marca `failed` + `error_kind`), `_db_mark_success`
  (troca `task.provider_key`/`model_binding` pelo vencedor, cria `TaskOutput` a partir de `result['outputs']`,
  ignora task terminal), `process_step_activity` (resolve binding pela tentativa, passa `binding`/`deadline` só se a
  assinatura de `process` aceitar). Funções síncronas, reaproveitáveis no inline.
- `core/services/execution_chain.py::validate_execution_chain` — contrato da cadeia em `Feature.config_json`
  (`step` sequencial, `provider_key`, `model_binding_key` ativo e do provider, `timeout_seconds` 10–3600,
  `failover_conditions` ⊂ {timeout, 5xx, rate_limit, connection_error, capacity, unknown, all}); exige `task_queue`.
- `core/services/task_service.py::create_task` (l. 101–163) — o crédito vem de `feature.model_binding` (Vast,
  1 crédito), **não** do elo 1: Replicate primeiro não muda o preço. Com cadeia, `task.model_binding`/`provider_key`
  nascem do elo 1 e `execution_chain_json` guarda o snapshot.
- `core/providers/replicate_provider.py::ReplicateProvider.process(task, attempt, binding, deadline)` — genérico por
  binding: `_build_provider_input` só repassa o que está em `input_mapping_json` + `default_input_json`; com
  `attempt` não cria `TaskOutput` (fica para `_db_mark_success`, via `result['outputs']`); sobe o PNG no Cloudinary
  **síncrono**; respeita `deadline`; `failed` → `classify_error(RuntimeError)` = **retorna** (não levanta) uma string
  `"unknown"` — bug: `raise classify_error(...)` levanta `TypeError` (string não é exceção), que vira `unknown` na
  cadeia de qualquer jeito, mas a mensagem se perde. Corrigir para `raise ProviderServerError(...)`.
- Binding existente no seed: `replicate_product_background` (`seed_product_photo_features.py:80–104`) =
  `black-forest-labs/flux-schnell` versão `c846a699...` (= `latest_version` hoje), mapeia `prompt` e
  `aspect_ratio`, default `num_inference_steps 4`, `png`. Não sei se existe em produção: a leitura do banco de
  produção foi negada pela permissão da sessão. O `seed_features` do boot não chama os outros seeds e seed só cria,
  então a configuração em produção tem de ir por **migração de dados** (padrão da `0011`).
- Schema do FLUX Schnell (API da Replicate, 2026-10-28): `prompt`, `aspect_ratio` ∈ {1:1, 16:9, 21:9, 3:2, 2:3,
  4:5, 5:4, 3:4, 4:3, 9:16, 9:21}, `megapixels` ∈ {"1", "0.25"}, `num_inference_steps` 1–4, `output_format`
  {webp, jpg, png}, `go_fast`, `seed`. **Sem `width/height`.** O app manda `width/height` (≤ 512×768,
  `ImageGenScreen.kt::generationSize`) e já corta/escala o resultado para o formato exato (`fitToFormat`), então
  basta a proporção mais próxima.
- App: `IawrapperBackend.kt:178–191` lê `outputs[0].b64_data` **ou** `external_url` → resultado da Replicate
  (só URL) funciona sem mudar o app.
- Latência medida direto na Replicate (`flux_latency.py`): 1 MP → **4,1 s** até pronto (inferência 0,8 s) + 1,8 s
  de download (1 MB); 0,25 MP → **2,2 s** (0,23 s) + 1,3 s (263 KB). Uma chamada logo em seguida voltou **sem
  `urls`** (provável limite de rajada da conta; o corpo não foi impresso): 429 tem de transbordar para o Vast.
- Estimativa de ponta a ponta com Replicate: ~6–9 s (POST + Replicate + download + upload Cloudinary síncrono +
  polling de 1,5 s do app + download no app).

**Tasks (implementação):**
1. `core/task_views.py::_run_inline`: se `task.execution_chain_json` tiver elos, percorrer a cadeia com a mesma
   semântica do `DynamicFallbackWorkflow`, reaproveitando `_db_start_attempt` / `_db_close_attempt` /
   `_db_mark_success` / `_db_mark_failure`; `deadline = monotonic() + timeout_seconds` do elo; `binding` do elo;
   `kind = classify_error(e)`. Sem cadeia: comportamento atual. Tirar o `complete_success` duplicado.
   Teste: `core/tests/` — elo 1 levanta `ProviderRateLimitError` → elo 2 roda e a task fica `success` com o
   `provider_key` do elo 2; `ProviderInputError` no elo 1 → `failed` sem chamar o elo 2; elo inativo pulado; erro
   fora de `failover_conditions` não transborda; todos falham → "Cadeia de provedores esgotada".
2. `ReplicateProvider._build_provider_input`: opção de binding `aspect_ratio_from_size` (lista de proporções
   aceitas) → calcula a mais próxima de `width/height` do payload quando `aspect_ratio` não veio. Teste unitário com
   512×512 → 1:1, 512×768 → 2:3, 768×432 → 16:9. Corrigir o `raise classify_error(...)`.
3. Migração de dados `0012`: `get_or_create` do binding `replicate_flux_schnell_product_photo` (flux-schnell,
   `megapixels "1"` ou `"0.25"` — dono escolhe; `png`; mapeia `prompt`) e `config_json.execution_chain` do
   `product-photo-vast` = [elo 1 Replicate, `timeout_seconds` 30, `failover_conditions ["all"]`; elo 2 Vast
   `vast_comfy_product_photo`, `timeout_seconds` 240] + `task_queue` mantido. Reversa: remove a cadeia.
   Teste: migração aplicada em SQLite → `validate_execution_chain` passa.
   **Dono escolheu `megapixels "1"`** (2026-10-28).

**Achados da leitura antes de implementar (2026-10-28, branch `feat/replicate-primary-vast-fallback`; base
`python manage.py test core.tests` = 171 OK; `python manage.py test core` quebra por `core/tests.py` coexistir com
`core/tests/`):**
- Com cadeia, `task.model_binding` nasce com o binding do elo 1 (Replicate). O `VastAIServerlessProvider.process`
  usa `binding or task.model_binding` → no elo 2 o `binding` do elo **tem** de ser passado, senão o Vast roda com o
  binding da Replicate.
- `get_provider('replicate')` devolve `ReplicateProvider()` sem `ai_provider`; ele usa `binding.provider` → token por
  `config_json.api_token_env` (`REPLICATE_API_TOKEN`). Token ausente = `ValueError` → `unknown` → transborda (serve
  de caso de fallback local).
- O provider `replicate` pode não existir em produção: a `0012` faz `get_or_create` dele também (defaults do seed).
- 429 da Replicate chega como `replicate.exceptions.ReplicateError` → `classify_error` = `unknown` → com `["all"]`
  transborda.

**Feito (2026-10-28): tasks 1–3 no commit `7695877` da branch `feat/replicate-primary-vast-fallback` (sem push).**
`core/task_views.py::_run_inline_chain`, `ReplicateProvider._closest_aspect_ratio` + `ProviderServerError`, migração
`0012_product_photo_replicate_primary`, testes em `core/tests/test_inline_execution_chain.py` (15). `core.tests` =
186 OK; `makemigrations --check` limpo; `0012` aplicada e revertida num SQLite com `seed_features` +
`seed_vast_features` → `validate_execution_chain` passa. Além do pedido: a `0012` troca `workflow_type` para
`DynamicFallbackWorkflow` (o `GenerateTaskWorkflow` ignora a cadeia se um dia voltar ao Temporal; a reversa volta
ao antigo). Precisa de `REPLICATE_API_TOKEN` no Railway (`iawrappernew`); sem ele todo pedido cai no Vast.
**Próximo passo:** dono revisa e faz merge/deploy → task 4.

**Passagem de bastão (2026-10-28, fim da sessão de implementação):**
- Railway (`railway variables --service iawrappernew --kv`, só nome/tamanho, sem imprimir valor):
  `REPLICATE_API_TOKEN` existe (40 caracteres — se é válido não foi testado); `FORCE_INLINE_TASKS=True`. Último
  deploy `b8bbf8ab` SUCCESS em 2026-10-26 19:28. Remoto: `github.com/luistiagos/iawrappernew`; build por Dockerfile
  (`migrate` + `seed_features` no boot → a `0012` roda sozinha no deploy).
- ~~**Falta autorização do dono para:** push da branch, merge na `main` e deploy.~~ Feito em 2026-10-28 (ver task 4).
- **Task 4, passo exato depois do deploy:** com o descartável (credencial no scratchpad da sessão de 2026-10-26, ver
  acima; se sumiu, `POST /api/users/`), `POST /api/tasks/` `feature_slug=product-photo-vast`, `prompt`, `width 512`,
  `height 768`; acompanhar `GET /api/tasks/<id>/` → esperado `success` em < 10 s, `model_binding =
  replicate_flux_schnell_product_photo`, `outputs[0].external_url` do Cloudinary, 1 crédito debitado. Fallback:
  desativar por instantes o binding `replicate_flux_schnell_product_photo` (admin) → nova task `success` pelo Vast
  com `model_binding = vast_comfy_product_photo` e `TaskAttempt` do elo 1 `cancelled`/`skipped`; reativar em
  seguida. Depois, repetir pelo app no moto (comandos do APK abaixo).
- Se o elo 1 falhar em produção: o motivo fica em `TaskAttempt.error_message` / `metadata_json.error_kind` e no log
  "Task N: elo 1 falhou: ..." do Railway.

4. Aceite em produção (depois do deploy, o dono avisa): task com o descartável → `success` em < 10 s, com
   `provider_key = replicate`; e um caso de fallback (binding Replicate inativo por instantes, ou token inválido em
   teste local) → `success` pelo Vast.
   **Deploy (2026-10-28, autorizado pelo dono):** push da branch, `main` fast-forward `36e4e7a..7695877`, Railway
   `09a4ea3a` SUCCESS; log do deploy: `Applying core.0012_product_photo_replicate_primary... OK`. Antes do push:
   `core.tests.test_inline_execution_chain` = 15 OK (a suíte inteira saiu com exit 0, mas a linha "Ran/OK" não foi
   capturada).
   **Caminho principal: APROVADO.** Script `accept_task4.py` (scratchpad da sessão `43ff3edf-...`, lê a credencial do
   descartável do scratchpad `2b13696e-...`): task **26**, 512×768, `queued` → `processing` +1,9 s → **`success` em
   6,0 s** do POST (started→finished no servidor: 4,1 s), `model_binding = replicate_flux_schnell_product_photo`,
   `outputs[0].external_url` no Cloudinary, `b64_data` vazio, 1 crédito (saldo 47 → 46).
   **Fallback: APROVADO.** Com autorização do dono, a chave `~/.ssh/id_ed25519.pub` foi registrada na Railway
   (`railway ssh keys add --name luist-pc-claude`) e o host `ssh.railway.com` (ED25519
   `SHA256:+S1xg92FrnHz6pY3bpkmh1OGtWQGNANXilPzlxA7B1g`) entrou no `known_hosts`. Para rodar código no container sem
   brigar com aspas: `railway ssh --service iawrappernew -i ~/.ssh/id_ed25519 -- "echo <b64> | base64 -d | python
   manage.py shell"` (o `-c "..."` perde as aspas no caminho). Binding Replicate `active=False` das 13:44:54 às
   13:47:25 (reativação num `trap EXIT`, conferida depois: `True`). Task **27**: `success` em **144,6 s** pelo Vast
   (worker frio, igual às medições anteriores), `provider_key = vast_ai_serverless`, `model_binding =
   vast_comfy_product_photo`, Cloudinary + `b64_data`, 1 crédito (46 → 45). `TaskAttempt`: 1 `replicate`
   `cancelled` "provider inativo" `error_kind skipped`; 2 `vast_ai_serverless` `success`. Task 26: um só attempt,
   `replicate` `success`.
   **Task 4 concluída.** Falta só o teste pelo app no moto (seção "Depois" abaixo).

**Passagem de bastão (2026-10-28, fim da sessão de aceite):**
- Estado: `ia_wrapper` local na `main` = `origin/main` = `7695877`, em produção (Railway `09a4ea3a`). Cadeia
  Replicate → Vast ativa no `product-photo-vast`; binding Replicate **ativo** (conferido depois do teste).
  Untracked no `ia_wrapper` (`test_full_iawrapper_flow.py`, `test_generate_image.py`) já estavam lá antes e não são
  desta sessão.
- **Próximo passo exato (task 5, app no moto):** o APK instalado já aponta para produção com o descartável e o app
  não precisa mudar (`IawrapperBackend.kt` lê `outputs[0].external_url`; a Replicate só devolve URL). (1) `adb mdns
  services` → `adb connect`; (2) abrir o app **em primeiro plano** (o `moto_freezer` congela o app se outro app
  abrir), gerar uma foto de produto pela tela de geração; (3) esperado: imagem em ~6–9 s. Se o APK sumiu, gerar de
  novo pelos comandos da seção "Depois".
  Conferir a task no servidor (pega a última do descartável):
  `railway ssh --service iawrappernew -i ~/.ssh/id_ed25519 -- "echo <b64> | base64 -d | python manage.py shell"`,
  com `<b64>` = base64 de
  `from core.models import Task, TaskAttempt; t=Task.objects.filter(user__email="teste-a600ce6f@example.com").latest("id"); print(t.id, t.status, t.provider_key, t.model_binding.key, t.started_at, t.finished_at); print(list(TaskAttempt.objects.filter(task=t).values_list("attempt_number","provider_key","status","error_message")))`
  (rodar de `d:\projects\iawrapper\ia_wrapper`, onde o projeto Railway está ligado). Aceite: `success`,
  `provider_key = replicate`, um único attempt.
- Script de aceite por API: `accept_task4.py` no scratchpad da sessão
  `43ff3edf-0171-49e9-9dca-c2e3dec6322f` (`python -I <caminho> [w h]`); credencial do descartável em
  `...\2b13696e-73ee-453c-a57b-220d1e114d7d\scratchpad\iawrapper_throwaway_user.txt` (saldo 45). A senha vazou uma
  vez no chat desta sessão: dono decide se troca.
- Pontos abertos (não são desta frente): o fallback pelo Vast leva ~145 s com worker frio (abaixo dos 300 s do
  `IawrapperOptions.maxWaitMs`, então não estoura, mas é lento); a suíte `core.tests` inteira demora > 10 min
  localmente (rodar em background, sem `Select-Object -Last`); chave SSH `luist-pc-claude` registrada na Railway
  (remover com `railway ssh keys remove` se não for mais usar).

5. **Aceite pelo app no moto (2026-10-28): funcional APROVADO, latência REPROVADA (18–22 s, não 6–9 s).**
   APK de 2026-10-26 (0.4.0) sem reinstalar; moto `ZY32LMNN9B` já conectado. Tela "Gerar imagem", Quadrado
   512×512:
   - Task **28** ("garrafa de perfume em marmore branco..."): app "Pronta em **18.4 s**"; servidor started→finished
     15,2 s. Task **29** ("tenis branco sobre fundo azul..."): app **21.7 s**; servidor 18,7 s. As duas `success`,
     `model_binding = replicate_flux_schnell_product_photo`, `provider replicate`, `retry_count 0`,
     `outputs[0].external_url` Cloudinary, `b64_data null`. A imagem aparece na tela. Saldo 45 → 43.
   - Conferido pela API pública (`GET /api/tasks/<id>/` com o descartável, script `last_task.py` no scratchpad da
     sessão `b734e607-61bd-408e-bb36-3725a23ff59e`). O `railway ssh ... manage.py shell` para ler os `TaskAttempt`
     foi **negado** pela permissão da sessão (leitura de produção). Dá para substituir: `GET /v1/predictions` da
     Replicate (token do `.env` do `ia_wrapper` = mesma conta de produção) mostra **uma única** prediction por task
     → nenhuma retentativa no elo 1.
   - **Onde vai o tempo** (`GET /v1/predictions/<id>`): `predict_time` 0,78 s nas duas; **fila da Replicate**
     (created → started) **11,2 s** (task 28) e **15,2 s** (task 29). No resto: servidor → Replicate ~1 s, download
     + upload Cloudinary ~1,9 s, app (polling 1,5 s + download) ~3 s. A task 26 (4,1 s no servidor) pegou fila
     curta. O app e o iawrapper não são o gargalo: é a fila compartilhada do modelo público
     `black-forest-labs/flux-schnell`.
   - Durante o teste um app de controle de jogo abriu por cima e o app foi reiniciado na home (efeito do
     `moto_freezer` já registrado); refeito em seguida, sem efeito no resultado.
   - **Decisão do dono (próximo passo):** aceitar 15–20 s, ou cortar a fila: (a) ~~*deployment* dedicado na
     Replicate~~ **descartado pelo dono (2026-10-28): nada cobrado por hora**; (b) outro provedor como elo 1,
     cobrado por imagem (precisa de medição antes, como a do `flux_latency.py`); (c) `megapixels "0.25"` não
     ajuda: o tempo é fila, não inferência. Aceite de qualquer opção: 3 gerações seguidas pelo app com "Pronta em"
     < 10 s.

6. **Cloudinary fora do caminho crítico na Replicate (pedido do dono, 2026-10-28: "não é para somar no tempo de
   geração").** Ganho esperado ~1,9 s por task; **não** mexe na fila da Replicate (item 5).
   - **Linha do tempo da task 29** (horários do servidor + da própria Replicate): task criada 17:03:00,455 →
     `started_at` 00,546 (0,1 s) → prediction criada na Replicate 01,426 (**0,9 s nosso**: binding, cliente, POST)
     → prediction `started` 16,654 (**15,2 s de fila na Replicate**; `created_at`/`started_at` são carimbos dela)
     → `completed` 17,432 (0,78 s de inferência) → `finished_at` 19,296 (**1,9 s nosso**: fim do polling +
     `urlretrieve` da replicate.delivery + `cloudinary.uploader.upload` síncrono + gravação). Do servidor, 2,8 s
     são nossos e 16 s são da Replicate.
   - Símbolos abertos (`ia_wrapper` `main` = `7695877`):
     - `core/providers/replicate_provider.py::process` (l. 17–95): `_run_prediction_with_timeout` →
       `_write_output_to_temp` (baixa a URL com `urllib.request.urlretrieve`, ou lê o `FileOutput`) →
       `upload_generated_image` **síncrono** → `outputs[0].external_url` = URL do Cloudinary. Com `attempt` (caminho
       da cadeia) não cria `TaskOutput`; quem cria é `_db_mark_success`. O `finally` apaga o temporário.
     - `_run_prediction_with_timeout` (l. 119–181): polling com `time.sleep(client.poll_interval)` +
       `prediction.reload()`; `failed` → `ProviderServerError`; timeout → `ProviderTimeoutError` (cancela a
       prediction).
     - `core/cloudinary_service.py::upload_generated_image`: `cloudinary.uploader.upload(path)` → `secure_url`; em
       erro levanta (sem `except`).
     - `core/temporal/activities.py::_db_mark_success` (l. 99–): cria um `TaskOutput` por descritor de
       `result["outputs"]`, com `external_url` e `payload_json = out_desc`; ignora task terminal.
     - Padrão já existente: `vast_serverless_provider.py` (l. 150–186), "Zero-Hop": devolve o `b64_data` na
       hora e sobe no Cloudinary numa `threading.Thread(daemon=True)`, depois faz
       `TaskOutput.objects.filter(task_id=..., kind='image').update(external_url=...)` com 10 × 0,5 s de espera
       pelo `TaskOutput`. Em erro só registra `warning`.
     - App: `IawrapperBackend.kt:178–193` usa `outputs[0].b64_data`, senão baixa `external_url`;
       `Http.kt::call` (l. 38/46) **não manda `Authorization` para URL absoluta** → baixar direto da
       replicate.delivery não vaza o token.
   - **O que fazer:** em `ReplicateProvider.process`, quando o output é URL `https` (caso do FLUX), devolver
     `external_url` = URL da Replicate na hora (sem baixar nem subir) e disparar uma thread que baixa, sobe no
     Cloudinary e troca `TaskOutput.external_url` + `payload_json.external_url` da task (espera o `TaskOutput`
     existir, como no Vast, com teto maior: ~30 × 0,5 s; `close_old_connections` no fim da thread). Output que
     não é URL (`FileOutput`/`data:`): comportamento atual. Caminho sem `attempt` (cria o próprio `TaskOutput`):
     mesma troca, já que o `TaskOutput` existe na hora.
     Risco aceito: a URL da replicate.delivery expira (~1 h); se o upload falhar, a task fica com uma URL que vai
     morrer (só `warning` no log, igual ao Vast). O app baixa na hora, então não afeta o app.
     Teste (`core/tests/`): com a Replicate mockada devolvendo URL, `process` retorna antes de
     `upload_generated_image` ser chamado (upload mockado bloqueado num `Event`) e com `external_url` = URL da
     Replicate; depois de liberar o upload, o `TaskOutput` passa para a URL do Cloudinary; com upload levantando,
     a task continua `success` com a URL da Replicate.
   - Descartado: devolver `b64_data` como no Vast. Exigiria o servidor baixar a imagem antes de responder (~1 MB,
     o mesmo custo que se quer tirar) e aumentaria o JSON do polling.
   - **Dono aprovou o desenho (2026-10-28):** entregar a URL da Replicate na hora, Cloudinary em segundo plano.
   - **Análise da implementação (2026-10-28, branch `feat/replicate-async-cloudinary` a partir de `7695877`):**
     - Lib `replicate` 1.0.7 (fonte lida): `FileOutput` só nasce em `run()`/`stream()` (`transform_output`);
       `predictions.create` + `Prediction.reload()` copiam o JSON cru (`output: Any`) → no FLUX chega `list[str]`
       com URL `https`. O caminho rápido vale em produção.
     - `task_views.py::_run_inline`/`_run_inline_chain`: `process` e `_db_mark_success` rodam fora de
       `transaction.atomic` → cada `TaskOutput.objects.create` comita na hora e a thread o enxerga.
     - API (`task_views.py` l. 45–66): `outputs[].external_url` vem de `TaskOutput.external_url`; `payload_json` vai
       inteiro → trocar os dois. `Task.result_payload` (`output_url` e `outputs[0].external_url`) e
       `TaskAttempt.raw_response_json` **ficam** com a URL da Replicate: trocar o `result_payload` corre contra o
       `complete_success` (que o grava logo depois) e o app não lê esses campos.
     - **`CONN_MAX_AGE = 600`** em produção (`settings.py` l. 176): `close_old_connections()` numa thread que vai
       morrer não fecha a conexão nova (idade < 600 s) → vazaria uma conexão por task. Na thread de uso único:
       `connections.close_all()` no `finally`.
     - Troca filtrada por `external_url = <URL da Replicate>` (não por `kind`): a URL é única por prediction, então
       retry da mesma task ou outro output não são sobrescritos. `TaskFile.size` tem `default=0` (caminho sem
       `attempt`, onde não há arquivo local para medir).
     - Binding FLUX tem `output_format: png` (0012) → `mime_type` pelo caminho da URL, com fallback `image/png`.
     - Testes locais: SQLite em memória com cache compartilhado; a thread usa outra conexão → `TransactionTestCase`
       (com `TestCase` a thread não veria as linhas da transação do teste).
   - **Implementado (2026-10-28, branch `feat/replicate-async-cloudinary`, sem push):**
     `ReplicateProvider.process` → `_direct_output_url` (só `str`/`.url` `https`, nunca `FileOutput`) →
     `_build_output_desc`/`_build_result` com a URL da Replicate → `_start_background_upload` (thread daemon
     `replicate-upload-<id>`) → `_upload_and_swap_url`: reaproveita `_write_output_to_temp` + `upload_generated_image`,
     espera o `TaskOutput` (30 × 0,5 s) e troca `external_url` + `payload_json.external_url` (e o `TaskFile` de
     output, no caminho sem `attempt`); erro → `warning`; `finally` apaga o temporário e faz
     `connections.close_all()`. `data:`/`FileOutput`: upload síncrono como antes (`_create_output_records` extraído).
     Teste `core/tests/test_replicate_async_upload.py` (4): sucesso antes do upload (upload bloqueado num `Event`) e
     troca depois; upload levantando → `success` com a URL da Replicate + `warning`; caminho sem `attempt`; `data:`
     segue síncrono. Prova de que testam a coisa certa: contra o provider de `7695877` (patch tolerante temporário)
     3 dos 4 falham — o principal em `assertFalse(upload_returned)` (upload no caminho crítico); o `data:` passa,
     como esperado (guarda o comportamento antigo). `test_replicate_async_upload` + `test_inline_execution_chain` +
     `test_provider_contracts` + `test_security_phase1` = 54 OK.
     Fica de fora, por decisão desta sessão: `Task.result_payload` e `TaskAttempt.raw_response_json` continuam com a
     URL da Replicate (vai expirar; o app não lê). Se a task terminar sem `TaskOutput` (cancelada no meio), a imagem
     fica órfã no Cloudinary (`warning` "TaskOutput ... nao apareceu") — mesmo comportamento do Vast; entra no SEC-12.
     **Commit `2fc4482`** na branch `feat/replicate-async-cloudinary` (sem push). `core.tests` inteira = **190 OK**
     (446 s; base 186 + 4 novos).
     **Revisão do `2fc4482` (2026-10-28): sem defeito bloqueante.** Conferido, abrindo: `_db_mark_success`
     (`activities.py` l. 99–149) cria o `TaskOutput` com `external_url = out_desc["external_url"]` e
     `payload_json = out_desc` → o filtro da thread pela URL da Replicate casa; a thread monta um dict novo, não muta
     o `out_desc` compartilhado com `result_payload`. `_direct_output_url` → `_pick_first_output` levanta na lista
     vazia como antes; output irreconhecível cai no caminho antigo e levanta o mesmo `ValueError`. `connections` é
     por thread → `close_all()` só fecha as da thread de upload. Produção roda inline (`FORCE_INLINE_TASKS`,
     `task_views.py` l. 176/383) em gunicorn `--workers 4` sync sem `--max-requests` (`Procfile`/`Dockerfile`) → a
     thread daemon sobrevive ao fim do request; só morre num redeploy/restart no meio (~2 s de janela: fica a URL
     da Replicate, igual ao upload que falha). Teste: `patch('urllib.request.urlretrieve')` vale porque o provider
     acessa `urllib.request.urlretrieve` pelo módulo. Observação, não defeito: a URL da replicate.delivery passa a
     sair na API (pública, sem auth, expira ~1 h), aceito no desenho.
     **Deploy (2026-10-28, autorizado pelo dono):** branch com push; `main` fast-forward `7695877..2fc4482` e push;
     Railway `iawrappernew` deployment `9e968536` = SUCCESS (18:37).
     **Aceite em produção (2026-10-28): troca de URL APROVADA; `finished − completed` < 0,5 s REPROVADO por pouco.**
     3 gerações pelo app no moto (`ZY32LMNN9B`, APK 0.4.0, tela "Gerar imagem", Quadrado 512×512), medidas com
     `watch_tasks.py`/`pred_check.py` (scratchpad da sessão `f0f9340a-c01f-4cc0-be7a-31bc21904afe`; leem o
     descartável e o `REPLICATE_API_TOKEN` do `.env` sem imprimir; a API da Replicate dá 403 sem `User-Agent`):

     | task | app "Pronta em" | servidor started→finished | fila Replicate | predict | URL no `success` | troca p/ Cloudinary | finished − completed |
     |---|---|---|---|---|---|---|---|
     | 35 | 7,9 s | 3,98 s | 1,3 s | 0,76 s | replicate.delivery | 1,8 s depois | 0,62 s |
     | 36 | 5,4 s | 3,09 s | 0,5 s | 0,80 s | replicate.delivery | 2,0 s depois | 0,76 s |
     | 37 | 4,9 s | 2,47 s | 0,0 s | 0,79 s | replicate.delivery | 1,0 s depois | 0,56 s |

     As três `success`, `replicate_flux_schnell_product_photo`; saldo do descartável 38 → 35. O que sobra depois do
     `completed` (0,56–0,76 s, antes ~1,9 s) **não é Cloudinary**: é o polling. `_run_prediction_with_timeout`
     dorme `client.poll_interval` entre `reload()`s, e na lib `replicate` 1.0.7 `Client.__init__` faz
     `poll_interval = float(os.environ.get("REPLICATE_POLL_INTERVAL", "0.5"))` → 0–0,5 s até ver o `succeeded` +
     o `reload()` HTTP + `_db_mark_success`/`complete_success`. O critério de < 0,5 s foi escrito sem contar o
     polling. **Decisão do dono:** aceitar como está, ou pôr `REPLICATE_POLL_INTERVAL=0.2` no Railway (sem código,
     ganho médio ~0,15 s, 2,5× mais `reload()` durante a fila).
     Observação (item 5): nesta janela a fila da Replicate foi de 0–1,3 s e as 3 gerações deram < 10 s no app, mas
     foi fila curta naquele horário, não correção. O item 5 continua dependendo do item 7.
     **Próximo passo (superado):** dono autoriza push/merge/deploy (nada disso feito). Depois, o aceite em produção da
     passagem de bastão abaixo (3 gerações pelo app no moto; `external_url` da replicate.delivery no `success`,
     Cloudinary segundos depois; `finished_at − completed_at` < 0,5 s).

**Passagem de bastão (2026-10-28, fim da sessão de aceite pelo app → implementação do item 6):**
- Estado: `ia_wrapper` (`d:\projects\iawrapper\ia_wrapper`) na `main` = `origin/main` = `7695877`, em produção
  (Railway `09a4ea3a`). Untracked antigos (`test_full_iawrapper_flow.py`, `test_generate_image.py`) não são desta
  frente. ~~Nada do item 6 foi escrito ainda.~~ Superado: item 6 implementado, ver a passagem de bastão seguinte.
- **Próximo passo exato:** branch `feat/replicate-async-cloudinary` a partir da `main`; abrir de novo (regra do
  CLAUDE.md) `core/providers/replicate_provider.py::process`, `_write_output_to_temp`, `_pick_first_output`,
  `_output_to_url` (l. 302–360) e o bloco "Zero-Hop" do `vast_serverless_provider.py` (l. 150–186); implementar
  conforme "O que fazer" acima; teste novo em `core/tests/test_replicate_async_upload.py` com os três casos
  listados. Rodar só os módulos tocados: `python manage.py test core.tests.test_replicate_async_upload
  core.tests.test_inline_execution_chain` (a suíte `core.tests` inteira passa de 10 min: rodar em background, sem
  `Select-Object -Last`; base 186 OK em `7695877`). Não usar `python manage.py test core` (quebra por
  `core/tests.py` coexistir com `core/tests/`).
- Pontos de atenção: a thread nasce **dentro** do `process`, antes do `_db_mark_success` criar o `TaskOutput` →
  esperar por ele; usar `close_old_connections()` no fim da thread (o executor do inline já usa, ver
  `task_views.py` l. 242/260); conferir se `raw_output` do FLUX chega como `FileOutput` (lib `replicate` ≥ 1.0)
  ou `str` — `_output_to_url` decide; o caminho rápido só vale quando sai uma URL `https`.
- Depois do commit: dono revisa e autoriza push/merge/deploy (nada disso sem pedido). Aceite em produção: 3
  gerações pelo app no moto (comandos do item 5; script `last_task.py` no scratchpad da sessão
  `b734e607-61bd-408e-bb36-3725a23ff59e`) → `outputs[0].external_url` começa com a URL da replicate.delivery logo
  no `success` e, segundos depois, passa a ser do Cloudinary; `finished_at − completed_at` da prediction < 0,5 s.
- Fica pendente com o dono (item 5): medir a fila da Replicate (~5 predictions seguidas) ou avaliar outro
  provedor cobrado por imagem como elo 1. → Virou o item 7 (Cloudflare Workers AI).

**Passagem de bastão (2026-10-28, fim da implementação do item 6 → revisão, deploy e aceite):**
- **Concluído em 2026-10-28:** revisão, deploy (`main` = `2fc4482`, Railway `9e968536`) e aceite feitos; resultado
  no item 6 ("Aceite em produção"). ~~Pendente só a decisão do dono sobre `REPLICATE_POLL_INTERVAL`.~~
  **Decidido (dono, 2026-10-29): fica como está** — variável não definida no Railway, vale o default 0,5 s da lib
  `replicate` 1.0.7; com o Workers AI como elo 1 (item 7) a Replicate só atende em falha, e o ganho de ~0,15 s não
  compensa. A 7.4 já pode partir da `main`.
- Estado (antes do deploy): `ia_wrapper` na branch local `feat/replicate-async-cloudinary` = `2fc4482` (1 commit sobre `7695877`;
  **sem push**). `main` = `origin/main` = `7695877`, ainda em produção (Railway `09a4ea3a`). Árvore limpa fora os
  untracked antigos (`test_full_iawrapper_flow.py`, `test_generate_image.py`). Tocados: só
  `core/providers/replicate_provider.py` e `core/tests/test_replicate_async_upload.py` (novo). `core.tests` = 190 OK.
  O que foi feito, as decisões e o que ficou de fora: item 6, blocos "Análise da implementação" e "Implementado".
- **Próximo passo exato (depende do dono, nada disso sem pedido):** (1) revisão do `2fc4482` (`git show 2fc4482`
  em `d:\projects\iawrapper\ia_wrapper`); (2) com autorização: `git push -u origin feat/replicate-async-cloudinary`,
  `main` fast-forward para `2fc4482`, push da `main` → o Railway (`iawrappernew`) faz o deploy sozinho pelo GitHub;
  conferir com `railway deployment list --service iawrappernew` (rodar de `d:\projects\iawrapper\ia_wrapper`) até
  SUCCESS. Sem migração nem variável nova.
- **Aceite em produção (depois do deploy):** 3 gerações pelo app no moto (`adb mdns services` → `adb connect`; app
  em primeiro plano por causa do `moto_freezer`; tela "Gerar imagem"; o APK 0.4.0 já aponta para produção com o
  descartável e o app não muda). Para cada task, pela API pública (`last_task.py`, scratchpad da sessão
  `b734e607-61bd-408e-bb36-3725a23ff59e`): logo no `success`, `outputs[0].external_url` começa com
  `https://replicate.delivery/`; consultado de novo segundos depois, é do `res.cloudinary.com`. Ganho: o servidor
  (started → finished) cai ~1,9 s em relação às tasks 28/29 do item 5; com `GET /v1/predictions/<id>` da Replicate,
  `finished_at` da task − `completed_at` da prediction < 0,5 s. O "Pronta em" no app continua dominado pela fila
  da Replicate (item 5), então **não** é critério deste item.
- Se a URL não trocar para o Cloudinary: procurar no log do Railway "Falha no upload assincrono Cloudinary task N"
  ou "TaskOutput com a URL da Replicate nao apareceu" (`core.providers.replicate_provider`).
- Conflito com o item 7: a 7.4 (provider do Workers AI) mexe no mesmo `ia_wrapper` e deve partir da `main` **depois**
  do merge do `2fc4482` (ou rebasear sobre ele). Ela pode reaproveitar `_start_background_upload`/
  `_upload_and_swap_url` como modelo do upload em segundo plano.

7. **Cloudflare Workers AI como elo 1 (dono, 2026-10-28).** O dono tem um worker de IA na conta Cloudflare, com
   token. Objetivo: cortar a fila do item 5 sem nada cobrado por hora. Cadeia alvo do `product-photo-vast`:
   **Workers AI → Replicate → Vast**. Item 6 (URL da Replicate na hora) continua valendo para o elo 2.
   - **O que já se sabe:** nenhum código de Workers AI no disco. `ia_wrapper` só usa Cloudflare para R2
     (`core/services/storage_service.py`); os projetos com `wrangler` em `C:\projects` (`rea/website`,
     `VoiceStudio/deploy/install-worker`, `xb-homebrew-vault`) não usam binding de IA. O worker existe só na conta.
   - **Não verificado (memória, confirmar na doc da Cloudflare ou numa chamada):** o Workers AI tem
     `@cf/black-forest-labs/flux-1-schnell`, cobrado por uso (neurons), com cota grátis diária; entrada `prompt` +
     `steps` (máx. ~8); saída `{"image": "<base64 JPEG>"}`; tamanho controlável ou não — **ver**. Base64 na
     resposta permite devolver `b64_data` ao app como no Vast (o app já decodifica, `IawrapperBackend.kt:182–187`).
   - **Credencial:** não colar o token no chat. Dono põe numa variável de ambiente da sessão
     (`CLOUDFLARE_API_TOKEN`, e `CLOUDFLARE_ACCOUNT_ID` se a chamada for pela API REST) ou num arquivo no scratchpad;
     scripts leem dali e nunca imprimem o valor (padrão do `accept_task4.py`).
   - **Tasks:**
     1. **Descobrir o worker** (perguntar ao dono nome/URL, ou `npx wrangler whoami` + `GET
        /accounts/{id}/workers/scripts` com o token): é um Worker próprio com binding `AI` (então ver o código dele:
        rota, auth, formato) ou chamada direta à REST `POST
        https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/black-forest-labs/flux-1-schnell`?
        Registrar aqui o contrato (entrada, saída, auth, erros).
     2. **Medir** (script no scratchpad, `python -I`): 5 gerações seguidas + 1 após ~10 min parado, prompt de foto de
        produto, tamanho do app (512×512 e 512×768 se aceitar). Anotar por chamada: tempo total, tamanho da
        resposta, dimensões da imagem, status de erro/limite. Comparar com a Replicate (item 5: 0,78 s de
        inferência + 11–15 s de fila hoje). Ver a qualidade das imagens com o dono.
     3. **Decisão do dono** com os números. Critério sugerido: mediana < 5 s e nenhuma > 10 s nas 6 chamadas.
     4. **Se aprovado — implementação no `ia_wrapper`** (sessão própria, depois do item 6): provider novo em
        `core/providers/` (seguir `replicate_provider.py::process(task, attempt, binding, deadline)`; com `attempt`
        não criar `TaskOutput`, devolver `outputs` com `b64_data`; upload Cloudinary em segundo plano como no item
        6; erros mapeados para `ProviderRateLimitError`/`ProviderServerError`/`ProviderTimeoutError`/
        `ProviderInputError` de `core/providers/errors.py` para a cadeia transbordar certo); registro em
        `get_provider`; migração `0013` com `get_or_create` do provider/binding (token por `config_json.api_token_env`)
        e `execution_chain` = [Workers AI, `timeout_seconds` 40 (decisão 7.3); Replicate (elo atual); Vast (elo atual)];
        reversa volta à cadeia da `0012`. Testes como os de `core/tests/test_inline_execution_chain.py`. Variáveis
        novas no Railway (`iawrappernew`) só com autorização do dono.
     5. Aceite: 3 gerações pelo app no moto com "Pronta em" < 10 s, task com o provider do Workers AI e um único
        attempt (comandos do item 5).

**Passagem de bastão (2026-10-28 → sessão do item 7, Workers AI):**
- Começar pela task 7.1: pedir ao dono o nome/URL do worker e que ponha o token em `CLOUDFLARE_API_TOKEN` (não no
  chat). Nada foi chamado na Cloudflare ainda. Não depende do item 6 para medir; a implementação (7.4) vem depois
  dele para não conflitar no `ia_wrapper`.
- Referências: script de medição da Replicate `flux_latency.py` (scratchpad da sessão
  `bfbee94e-2f3f-4dac-a61d-f2f307052c0d`); leitura de task pela API pública `last_task.py` (scratchpad da sessão
  `b734e607-61bd-408e-bb36-3725a23ff59e`).

**7.1 feito (2026-10-28) — contrato do Workers AI:**
- **Não é Worker próprio:** é a REST direta. `POST https://api.cloudflare.com/client/v4/accounts/f6d54e5b1002b3d1deb6aa69b5ae6d7c/ai/run/<modelo>`,
  `Authorization: Bearer <token>`, corpo JSON. Token do dono (`cfut_…`, token de usuário) fica fora do repo; na
  sessão, em `cf_token.txt` no scratchpad `c288e241-c74c-41c1-b868-6763c76766b2` (foi colado no chat → **revogar ou
  trocar depois da medição**).
- O token só tem Workers AI dessa conta: `GET /user/tokens/verify` = 200 `active`, mas `GET /accounts` = `[]`,
  `/memberships` e `/user` = 403, `wrangler whoami` falha. O `account_id` `312a0af0…` do
  `VoiceStudio/deploy/install-worker/wrangler.jsonc` é **outra conta** (401/403 em tudo) — descartado.
- `@cf/black-forest-labs/flux-1-schnell` (`GET …/ai/models/schema?model=…`): entrada **só** `prompt` (1–2048
  chars, obrigatório) e `steps` (≤ 8, default 4), `additionalProperties: false`. Saída `{"result": {"image":
  "<base64>", "usage": {"neurons": …}}, "success": true, "errors": []}`.
- Medido (`cf_contract.py`): steps 4 → 200 em **1,81 s**, JPEG **1024×1024 fixo** (324 KB; 432 KB de JSON),
  **172,8 neurons** por imagem (header `cf-ai-neurons`); steps 1 → 1,84 s. **Não aceita tamanho:** `width`/`height`
  → 400, código **5006** "Additional or unevaluated properties". Erros de entrada: 400 + `errors[0].code = 5006`
  (`steps` > 8, sem `prompt`) → mapear para `ProviderInputError`. 429/5xx ainda não vistos.
- Consequência para o app (512×512/512×768): com o schnell só sai quadrado 1024 → reduzir/cortar no `ia_wrapper`
  ou no app. Modelos de imagem da conta com `width`/`height` (`/ai/models/search?task=Text-to-Image`):
  `flux-2-klein-4b`, `flux-2-klein-9b`, `flux-2-dev` (entrada multipart), `leonardo/lucid-origin`,
  `leonardo/phoenix-1.0`, `bytedance/stable-diffusion-xl-lightning`, `lykon/dreamshaper-8-lcm`, `sdxl-base-1.0`.
- `flux-2-klein-4b`: schema só diz `{"multipart": …}`; na REST mandar o corpo como `multipart/form-data` com
  `prompt`, `width`, `height` (`steps` também aceito). Saída `{"result": {"image": "<base64 JPEG>"}}` (sem `usage`;
  custo no header `cf-ai-neurons` = **104,2**). Tamanho é arredondado para múltiplo de 16 (500×768 → 496×768).

**7.2 feito (2026-10-28) — medição** (`cf_measure.py <rodada> <n> [espera_s]`, scratchpad acima; log em
`measure/results.jsonl`, imagens em `measure/*.jpg`). 5 seguidas (18:38) + 1 após 10 min parado (18:49), por
configuração, 5 prompts de foto de produto. Tempo = ida e volta do PC do dono (GRU) até o retorno do JSON:

| Config | Tempos (s), 6 chamadas | Mediana | Máx. | OK | Saída | Neurons |
|---|---|---|---|---|---|---|
| schnell, steps 4 | 2,19 1,78 1,88 1,53 1,88 · parado 2,19 | **1,88** | 2,19 | 6/6 | JPEG 1024² (170–460 KB) | 172,8 |
| klein 512×512 | 6,31 4,83 *5,73* 5,05 9,19 · parado 4,56 | 5,39 | 9,19 | 5/6 | JPEG 512² (48–150 KB) | 104,2 |
| klein 512×768 | 4,07 6,16 *6,64* 4,77 5,51 · parado 6,44 | 5,84 | 6,64 | 5/6 | JPEG 512×768 (80–280 KB) | 104,2 |

- Em itálico: **400, `errors[0].code = 3030`** "Your output has been flagged. Please choose another prompt" — o
  klein barrou o prompt dos tênis (`running sneakers on a pastel background`) **nas duas vezes**: falso positivo
  de moderação. Não é erro de entrada do usuário: no provider, 3030 deve **transbordar** para o próximo elo (não
  `ProviderInputError` se este parar a cadeia — conferir em `errors.py`/executor na 7.4). O schnell gerou o mesmo
  prompt sem problema.
- Parado 10 min não mudou nada (sem cold start visível). Nenhum 429/5xx em 21 chamadas.
- Contra a Replicate (item 5: 0,78 s de inferência + 11–15 s de fila): o schnell fica ~6–8× mais rápido de ponta
  a ponta.
- Critério sugerido (mediana < 5 s, nenhuma > 10 s): **schnell passa**; o klein fica abaixo de 10 s, mas a
  mediana passa de 5 s (5,4/5,8).
- Qualidade (olhei caneca e sérum): os dois servem como foto de produto. O schnell inventa texto ilegível em
  rótulo ("Delleria Suicer Serum"); o klein é mais fotográfico e já sai no tamanho do app.
- Cota/preço **não verificado** (memória; conferir na página de preços da Cloudflare): 10.000 neurons grátis/dia
  → ~57 imagens schnell ou ~96 klein por dia; acima disso ~US$ 0,011/1.000 neurons (≈ US$ 0,0019 por schnell).
- Teste do 3030 (`cf_seed_test.py`): o klein **aceita `seed`** no multipart e **não é determinístico** sem ela
  (caneca 2× sem seed → hashes diferentes). Tênis com 3 seeds aleatórias: 3030, **200**, 3030 — o bloqueio é
  probabilístico (nesse prompt, 4 de 5 no total), e a imagem que passou é um tênis comum, sem pessoa: falso
  positivo do filtro de saída. Recusa leva o tempo de uma geração (3,9–7 s) e veio sem header `cf-ai-neurons`.

**7.3 decidido pelo dono (2026-10-28):**
- Cadeia de infra: **Workers AI → Replicate → Vast** (como já previsto).
- Dentro do Workers AI: **klein-4b principal** (tamanho nativo do app), **schnell como fallback** (1024² →
  reduzir/cortar para o tamanho pedido).
- **`timeout_seconds` do elo Workers AI = 40** (dono, 2026-10-28; substitui o ~20 da task 4).
- **3030 (output flagged): repetir uma vez no mesmo modelo** com `seed` aleatória nova; se der 3030 de novo, aí
  passa para o próximo modelo/elo. Outros erros seguem o mapeamento normal sem retry.
- Pior caso antes de sair do Workers AI: klein (~6 s) + retry (~6 s) + schnell (~2 s) ≈ 14 s → coberto pelo `timeout_seconds` = 40; conferir na implementação se o retry/fallback interno conta
  como um attempt só.
- Pendente com o dono: revogar/trocar o token colado no chat (e criar o definitivo para o Railway na 7.4).

**Passagem de bastão (2026-10-28, fim da análise do item 7 → sessão da 7.4, implementação no `ia_wrapper`):**
- Estado: 7.1–7.3 feitos (blocos acima). `ia_wrapper` (`d:\projects\iawrapper\ia_wrapper`) com `main` = `2fc4482`
  (item 6 em produção); branches antigas `feat/replicate-async-cloudinary` e `feat/replicate-primary-vast-fallback`
  já incorporadas. Nenhuma linha de código do Workers AI escrita. Desta sessão **nada do `ia_wrapper` foi aberto**:
  os símbolos citados abaixo vêm do texto do item 7/item 6 e precisam ser abertos antes de escrever código
  (regra do CLAUDE.md).
- **Próximo passo exato:** branch `feat/workers-ai-primary` a partir da `main`; abrir inteiros
  `core/providers/replicate_provider.py::process` (modelo do provider: `process(task, attempt, binding, deadline)`,
  `_start_background_upload` do item 6), `core/providers/errors.py` (quais erros fazem a cadeia transbordar e qual
  para — decide onde cai o 3030 duplo e o 400/5006), `get_provider` (registro), o executor da cadeia
  (`core/tests/test_inline_execution_chain.py` mostra quem é) e a migração `0012` (formato do `execution_chain` e
  do binding). Então implementar:
  1. `core/providers/workers_ai_provider.py`: POST `…/accounts/{account_id}/ai/run/@cf/black-forest-labs/flux-2-klein-4b`
     em `multipart/form-data` (`prompt`, `width`, `height`, `seed` aleatória); em 400 com `errors[0].code == 3030`
     repetir **uma vez** com seed nova; 3030 de novo → `@cf/black-forest-labs/flux-1-schnell` em JSON
     (`prompt`, `steps: 4`), redimensionar/cortar o JPEG 1024² para o `width`×`height` pedido (ver se o
     `ia_wrapper` já tem Pillow); falha do schnell → erro que transborda para a Replicate. Resposta
     `result.image` (base64 JPEG) → com `attempt`, devolver `outputs` com `b64_data` sem criar `TaskOutput`;
     upload Cloudinary em segundo plano como no item 6. Mapear: 429 → `ProviderRateLimitError`; 5xx →
     `ProviderServerError`; timeout de rede → `ProviderTimeoutError`; 400/5006 → `ProviderInputError`. O retry e
     o fallback interno respeitam o `deadline` (elo de 40 s).
  2. Registro em `get_provider`; migração `0013` com `get_or_create` do provider/binding (`config_json`:
     `api_token_env` = `CLOUDFLARE_API_TOKEN`, `account_id`, modelos principal/fallback) e `execution_chain` =
     [Workers AI 40 s; Replicate (elo atual); Vast (elo atual)]; reversa volta à cadeia da `0012`.
  3. Testes em `core/tests/test_workers_ai_provider.py` (HTTP mockado): sucesso klein; 3030 → retry → sucesso;
     3030 ×2 → schnell → imagem no tamanho pedido; 3030 ×2 + schnell 5xx → erro que transborda; 429 →
     `ProviderRateLimitError`; 400/5006 → `ProviderInputError`; com `attempt` não cria `TaskOutput`.
     Rodar só os módulos tocados + `core.tests.test_inline_execution_chain` (não `manage.py test core`; a suíte
     `core.tests` inteira passa de 10 min, base 190 OK em `2fc4482`, rodar em background).
- Contrato e números: blocos 7.1/7.2/7.3 acima. Scripts de referência (formato multipart que funcionou:
  `cf_measure.py`, `cf_seed_test.py`) no scratchpad da sessão `c288e241-c74c-41c1-b868-6763c76766b2`.
- Fica com o dono, nada disso sem pedido: token definitivo (só Workers AI da conta `f6d54e5b…`) e as variáveis
  `CLOUDFLARE_API_TOKEN`/conta no Railway (`iawrappernew`); revisão, push, merge e deploy; aceite 7.5 no moto.

**7.4 — análise da implementação (2026-10-28, aberto antes de escrever código; branch `feat/workers-ai-primary` sobre `2fc4482`):**
- `core/task_views.py::_run_inline_chain` (caminho de produção): um `TaskAttempt` por chamada de `process` → o
  retry do 3030 e o fallback klein→schnell **dentro** do provider contam como **um** attempt (responde a dúvida da
  7.3). `deadline = time.monotonic() + step['timeout_seconds']`. Em erro: `classify_error(e)`; **`input_error` encerra
  a task na hora** (`_db_mark_failure`, "falharia em qualquer provedor"); os outros transbordam se o kind estiver em
  `failover_conditions` (as da 0012 são `['all']`). Exceção que não é `ProviderError` vira `unknown` e também transborda.
- `core/providers/errors.py`: `ProviderInputError` (`input_error`), `ProviderTimeoutError`, `ProviderServerError`
  (`5xx`), `ProviderRateLimitError`, `ProviderConnectionError`, `ProviderCapacityError`. → 3030 duplo **não** pode
  ser `ProviderInputError` (pararia a cadeia); vai para o schnell e, se o schnell falhar, `ProviderServerError`.
- `core/temporal/activities.py::_db_mark_success`: com attempt, cria um `TaskOutput` por item de `result['outputs']`
  com `payload_json = out_desc` → o `b64_data` chega ao app por `_task_detail` (`task_views.py:57–64`), como no
  Vast (`vast_serverless_provider.py::_process_image`, que devolve `external_url: ""` + `b64_data`).
- `replicate_provider.py::_start_background_upload`/`_upload_and_swap_url`: thread daemon, espera até 15 s o
  `TaskOutput` aparecer, troca `external_url` (e `payload_json.external_url`), `connections.close_all()` no fim.
  Modelo copiado; aqui o filtro é `external_url=''` (não há URL provisória).
- `registry.py::get_provider`: `_PROVIDER_CLASSES[key]` ou `AIProvider.config_json.provider_type`.
- Migração 0012: chain de 2 elos (Replicate 30 s, Vast 240 s), `workflow_type` `DynamicFallbackWorkflow`. Teste
  dela em `test_inline_execution_chain.py::ReplicatePrimaryMigrationTests` (chama as funções com `django_apps`).
- Schema da feature (0011 `PRODUCT_PHOTO_SCHEMA`): `prompt` ≤ 2000 (a CF aceita ≤ 2048), `width`/`height` 64–1024.
  → um 400/5006 do Workers AI quase nunca é culpa do usuário. Mantido `ProviderInputError` (decisão 7.3: "outros
  erros seguem o mapeamento normal"), mas **risco para o dono:** se a Cloudflare mudar o contrato, ou o klein recusar
  um tamanho do intervalo 64–1024, a task falha sem tentar a Replicate. 400 com outro código, 401/403 →
  `ProviderServerError` (transborda: token/conta não é culpa do input).
- Dependências: `Pillow==11.3.0` e `requests` já no `requirements.txt` (corte/redimensionamento do schnell com PIL).
- Decisões desta sessão: `account_id` por env (`config_json.account_id_env` = `CLOUDFLARE_ACCOUNT_ID`; aceita
  `account_id` literal), para não gravar a conta no repo; a 0013 **prefixa** o elo Workers AI à cadeia atual da
  feature (preserva ajuste manual da Replicate/Vast) e a reversa remove esse elo e renumera (= cadeia da 0012).
- Tasks: (1) `core/providers/workers_ai_provider.py` + registro `cloudflare_workers_ai`; (2) `0013` provider
  `cloudflare_workers_ai` + binding `workers_ai_flux2_klein_product_photo` (`model_ref` klein,
  `config_json.fallback_model_ref` schnell); (3) `core/tests/test_workers_ai_provider.py` com os casos da passagem
  acima + migração; rodar só esse módulo + `test_inline_execution_chain` + `test_replicate_async_upload`.

**7.4 implementado (2026-10-28, branch `feat/workers-ai-primary`, sem commit):**
- `core/providers/workers_ai_provider.py::WorkersAIProvider` (`key = 'cloudflare_workers_ai'`): klein em multipart
  (`prompt`, `width`, `height`, `seed` aleatória; default 512×512 se o payload não trouxer tamanho); 3030 →
  `flagged_retries` (1) com seed nova; 3030 de novo → `fallback_model_ref` (schnell, JSON `prompt` + `steps: 4`),
  `PIL.ImageOps.fit` (corte central + LANCZOS) para o tamanho pedido, JPEG q90; 3030 também no schnell →
  `ProviderServerError`. Mapeamento: 429 → `RateLimit`; ≥ 500 → `Server`; 400 + 5006 → `Input`; outros 4xx
  (401/403, outros códigos) → `Server`; `requests.Timeout` → `Timeout`; outra `RequestException` → `Connection`;
  menos de 2 s até o `deadline` antes de uma chamada → `Timeout`; cada chamada usa o resto do prazo como timeout.
  Sem `deadline` (fora da cadeia): 40 s. Sem token/conta → `ValueError` (`unknown`, transborda para a Replicate).
- Saída: `outputs[0]` = `image/jpeg`, `external_url: ""`, `b64_data`, `metadata` com `model_ref` que gerou e
  `width`/`height` reais. Upload Cloudinary em thread (`_upload_and_set_url`, cópia do item 6) preenche a URL do
  `TaskOutput`/`TaskFile` com `external_url=''`. Diagnóstico por chamada em `attempt.metadata_json.workers_ai_calls`
  (`model`, `status`, `code`, `seconds`, `neurons`), gravado também em erro → no aceite 7.5 dá para ver se foi
  klein ou schnell e quantas tentativas.
- `registry.py::_PROVIDER_CLASSES['cloudflare_workers_ai']`.
- `core/migrations/0013_product_photo_workers_ai_primary.py`: provider (`api_token_env` `CLOUDFLARE_API_TOKEN`,
  `account_id_env` `CLOUDFLARE_ACCOUNT_ID`, `cost_estimate` 0,0019) + binding `workers_ai_flux2_klein_product_photo`
  (`model_ref` klein, `fallback_model_ref` schnell, `credit_cost` 1, sem `input_mapping_json`: o provider lê só
  `prompt`/`width`/`height`); prefixa o elo de 40 s à cadeia atual e renumera; idempotente; sem cadeia na feature
  não mexe; reversa tira o elo (volta exatamente à cadeia da 0012).
- Testes: `core/tests/test_workers_ai_provider.py`, 24 casos (provider com HTTP mockado, provider dentro do
  `_run_inline` — 3030×2 + schnell = 1 attempt; 500 → Replicate; 5006 para a cadeia —, upload em segundo plano em
  `TransactionTestCase`, migração). `test_workers_ai_provider` + `test_inline_execution_chain` +
  `test_replicate_async_upload` = **43 OK**; `core.tests` inteira = **214 OK** (190 da base + 24 novos, 202 s); `makemigrations --check` = sem mudanças. Multipart do `requests`
  conferido offline: mesmo corpo do `cf_seed_test.py`. **Nenhuma chamada real à Cloudflare nesta sessão.**

**Deploy (2026-10-29):** commit do dono `0691064` ("*", inclui também os scripts soltos `test_full_iawrapper_flow.py`
— com `admin@test.com`/`<senha do admin>` — e `test_generate_image.py`; o dono escolheu subir assim). `main` = `0691064`,
Railway `38820079` = SUCCESS, log: `Applying core.0013_product_photo_workers_ai_primary... OK`. Falta o dono criar
`CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no `iawrappernew`; até lá o elo 1 falha na hora (`unknown`) e a
Replicate atende. Depois: aceite 7.5 (abaixo).
- 2026-10-29: dono criou as duas variáveis (conferido só nome/tamanho: conta 32, token 53) e redeployou
  (`e2ff789f` = SUCCESS). Smoke com as credenciais de produção (`railway run --service iawrappernew python
  wai_smoke.py`, scratchpad da sessão `92d5b7ad-6066-4fc2-9f10-ca0dacbdef25`, chama `WorkersAIProvider._run` sem
  banco): klein 512×768 → 200, JPEG 512×768 (142 KB), 7,0 s do PC do dono, 104,2 neurons. Falta o aceite 7.5 no moto.

**7.5 aceite no moto (2026-10-29, 09:43–09:45): funcional APROVADO; latência 2 de 3 abaixo de 10 s.**
APK 0.4.0 sem reinstalar, `ZY32LMNN9B` já no `adb devices`, tela "Gerar imagem". Leitura pela API pública com
`accept_7_5.py [task_id]` (scratchpad da sessão `92d5b7ad-6066-4fc2-9f10-ca0dacbdef25`; resume a task sem b64/senha):

| task | formato | app "Pronta em" | servidor started→finished | chamada klein | modelo | chamadas |
|---|---|---|---|---|---|---|
| 38 (perfume em mármore) | 512×512 | **9,6 s** | 6,44 s | 6,32 s | klein | 1 (200) |
| 39 (tênis em fundo azul) | 512×512 | **6,0 s** | 4,14 s | 4,04 s | klein | 1 (200) |
| 40 (sérum âmbar, pedra) | 512×768 | **11,1 s** | 10,0 s | 9,84 s | klein | 1 (200) |

- As três `success`, `model_binding = workers_ai_flux2_klein_product_photo`, `result.provider =
  cloudflare_workers_ai` (elo 1 venceu → nenhum outro attempt), `retry_count 0`, `image/jpeg` no tamanho pedido
  (metadata 512×512 / 512×768), `b64_data` presente, e `outputs[0].external_url` já em `res.cloudinary.com` na
  leitura logo depois. Saldo 35 → 32. Nenhum 3030 (os prompts em português passaram; o 3030 da 7.2 era em inglês).
- O excedente da task 40 é **tempo do próprio klein** (9,84 s na Cloudflare; na 7.2 o máximo foi 9,19 s): o
  `ia_wrapper` soma ~0,2 s e o app ~1 s (polling 1,5 s + decodificação). Contra o item 5 (18–22 s pela Replicate),
  o ganho é 2–3×. Para garantir < 10 s sempre, as opções são do dono: schnell como principal (mediana 1,9 s, mas só
  1024² cortado e pior em rótulo) ou aceitar a cauda do klein.
- Qualidade: "tenis branco" (sem acento) gerou uma **bola de tênis** — ambiguidade do prompt em português, não do
  provider; perfume e sérum fotográficos.
- Credencial: script lê o descartável de `...\2b13696e-...\scratchpad\iawrapper_throwaway_user.txt`, nada impresso.
- **Decisão do dono (2026-10-29): klein continua principal** (melhor qualidade e 104,2 vs 172,8 neurons do
  schnell); a cauda acima de 10 s do klein (task 40) fica aceita. Schnell segue só como fallback do 3030.
  Configuração em produção já é essa (0013): nada a mudar. **Item 7 concluído.** Pendências que ficam com o dono:
  revogar o token colado no chat (7.1) e trocar a senha do `admin@test.com` (agora também no histórico do GitHub,
  `test_full_iawrapper_flow.py` em `0691064`).
- **Decisão do dono (2026-10-29): 400/5006 passa a transbordar** (risco da análise da 7.4). `8cc17d2` em
  `fix/workers-ai-5006-failover` → `main`: tirado o ramo `ProviderInputError` de `WorkersAIProvider._run`; todo 4xx
  que não é 3030 nem 429 vira `ProviderServerError`. Testes trocados (`test_schema_error_is_server_error_not_input_error`,
  `test_schema_error_falls_over_to_replicate`); os 3 módulos = 43 OK. Railway `572af48f` = SUCCESS. O provider do
  Workers AI não levanta mais `ProviderInputError` em nenhum caso.

**Passagem de bastão (2026-10-28, fim da 7.4 → revisão, deploy e aceite 7.5):**
- Estado: `ia_wrapper` em `feat/workers-ai-primary` (a partir de `main` = `2fc4482`), alterações **sem commit**:
  novos `core/providers/workers_ai_provider.py`, `core/migrations/0013_product_photo_workers_ai_primary.py`,
  `core/tests/test_workers_ai_provider.py`; editado `core/providers/registry.py`.
- Próximo passo exato (dono): (1) revisar e commitar na branch; (2) criar o token definitivo (só Workers AI da conta
  `f6d54e5b…`) e revogar o colado no chat; (3) no Railway (`iawrappernew`) definir `CLOUDFLARE_API_TOKEN` e
  `CLOUDFLARE_ACCOUNT_ID` **antes** do deploy (sem elas o elo 1 falha em ~0 s e tudo vai para a Replicate, sem quebrar);
  (4) merge/push da `main` → deploy roda a 0013.
- Aceite 7.5: 3 gerações pelo app no moto (comandos do item 5/6), "Pronta em" < 10 s; na task, `provider_key` =
  `cloudflare_workers_ai`, um único attempt, e `metadata_json.workers_ai_calls` mostrando o modelo usado; segundos
  depois `outputs[0].external_url` em `res.cloudinary.com`. Se falhar: log "elo 1 falhou: cloudflare_workers_ai [kind]".
- Risco aberto (decidir com o dono): 400/5006 para a cadeia sem tentar a Replicate (ver análise acima).

**Próximo passo antigo (substituído pela decisão acima):** (a) `max_wait_seconds` no binding do `product-photo-vast` para ~480–600 e
`IawrapperOptions.maxWaitMs` do app junto (hoje 300 s, menor que isso mataria a espera antes do servidor);
(b) e/ou worker quente: `cold_workers >= 1` no endpoint (instância parada, custa só disco) ou `min_load > 0` (GPU
ligada, custo/hora). Teste de aceite: task de ponta a ponta = `success` com o endpoint sem worker.

**Depois:** repetir no moto com o app em primeiro plano (o `moto_freezer` congelou o app quando outro app abriu). O APK
de teste já está instalado (produção + descartável); para gerar de novo:
`$env:IAWRAPPER_URL='https://iawrappernew-production.up.railway.app'; $env:IAWRAPPER_CREDENTIAL='<email:senha>';
.\gradlew.bat :app:assembleDebug` e `adb install -r app\build\outputs\apk\debug\app-debug.apk` (moto por ADB sem
fio; `adb mdns services` acha o aparelho).

Fica com o dono (Fase 0): senha e `is_admin` do `admin@test.com`, rotação de segredos, ~~confirmar `DATABASE_URL`~~ e o
worker Trellis no Railway.
- **SEC-04.6 confirmado (2026-10-29):** `railway variables --service iawrappernew --json` (só nomes/prefixo, valores
  não impressos): `DATABASE_URL` definida e começa com `postgres` → Postgres, não SQLite. Na mesma leitura:
  `SECRET_KEY` definida (se foi rotacionada depois do vazamento, só o dono sabe), `FORCE_INLINE_TASKS` definida,
  **sem** `REDIS_URL`/`CACHES` (o throttle segue no `LocMemCache` por processo) e sem `NUM_PROXIES` como variável
  (não conferido se o `settings.py` tem default).

**Passagem de bastão (2026-10-29, fim do item 7 → próxima sessão: throttle com cache compartilhado, SEC-07):**
- Item 7 e item 6 fechados (blocos acima). Fase 0 restante é do dono: senha/`is_admin` do `admin@test.com` (também
  no histórico do GitHub, `0691064`), rotação da `SECRET_KEY`, revogar o token da Cloudflare colado no chat, Trellis.
- Próxima tarefa (backend, `d:\projects\iawrapper\ia_wrapper`, branch nova a partir da `main` = `8cc17d2`): o achado
  da Fase 1 — sem `CACHES`, o throttle do DRF conta por processo (4 workers do gunicorn). Nada foi aberto para isso
  nesta sessão: abrir `ia_wrapper/settings.py` (`CACHES`, `REST_FRAMEWORK` throttle rates, `NUM_PROXIES`),
  `Procfile`/`Dockerfile` (`--workers`), e decidir entre `DatabaseCache` (sem serviço novo; precisa
  `createcachetable` no boot/migração) e Redis no Railway (serviço novo, decisão do dono). Teste: throttle
  compartilhado entre dois clientes de cache distintos (ou o mesmo backend em processos diferentes).
- Junto ou depois: controle do teste de XFF (`throttle_control.py noxff 1300`, scratchpad da sessão da Fase 1) —
  1300 requisições a produção, **só com OK do dono**.

**SEC-07.6 — throttle com cache compartilhado: análise (2026-10-29, nenhum código editado ainda)**

Backend `d:\projects\iawrapper\ia_wrapper`, `main` = `8cc17d2`, árvore limpa. DRF 3.16.1 e Django 5.2.8 (os mesmos
do `requirements.txt`), fonte lida em `C:\Users\luist\AppData\Roaming\Python\Python314\site-packages`.

Símbolos abertos:
- `ia_wrapper/settings.py::REST_FRAMEWORK` (l. 84-104): só `UserRateThrottle` global; rates `user: 300/min` e
  `task_create: 30/min`; `NUM_PROXIES = int(os.getenv('NUM_PROXIES', '1'))` (default 1 já existe no código; a
  variável não estar no Railway não importa). **Nenhum `CACHES`** no arquivo (`Select-String -Pattern CACHE`, sem
  diferenciar maiúsculas: zero ocorrências; também não há `SESSION_ENGINE` de cache).
- `settings.py::DATABASES` (l. 155-198): com `DATABASE_URL` → Postgres, `CONN_MAX_AGE=600`; sem ela e com
  `USE_SQLITE` (default `True`) → SQLite. O `.env` local não tem `DATABASE_URL` → testes rodam em SQLite.
- `Dockerfile` `CMD`: `migrate && seed_features && gunicorn ... --workers 4`. O `railway.json` usa o builder
  `DOCKERFILE`, então quem vale é o `CMD`; o `Procfile` (`release: migrate`, mesmo `--workers 4`) não é usado no
  Railway. Lugar do `createcachetable`: no `CMD`, entre `migrate` e `gunicorn`.
- `rest_framework/throttling.py::SimpleRateThrottle`: `cache = default_cache` (o proxy `django.core.cache.cache`,
  resolvido por requisição → `override_settings(CACHES=...)` funciona em teste). `allow_request` faz
  `cache.get(key, [])` → poda → `cache.set(key, history, duration)`. **Ler-e-gravar não atômico**: dois workers
  simultâneos leem o mesmo histórico e gravam n+1 → numa rajada concorrente passa um pouco acima do limite. Igual em
  Redis (o DRF não usa `incr`). Aceitável: o salto de hoje é ×4.
- `BaseThrottle.get_ident`: `addrs[-min(num_proxies, len(addrs))]` (confirma o registro da Fase 1).
- `django/core/cache/backends/db.py::DatabaseCache`: `set` = `SELECT COUNT(*)` (fora do `try`) + transação com
  `SELECT` + `UPDATE`/`INSERT`; `get` = 1 `SELECT`. **Em erro:** falha de `UPDATE/INSERT` (`DatabaseError`, ex.:
  corrida de `INSERT` da mesma chave) → `return False` silencioso (só perde aquela contagem); **tabela inexistente →
  o `COUNT`/`SELECT` levanta → toda requisição da API dá 500**. Por isso o `createcachetable` tem de rodar antes do
  `gunicorn`. Custo: ~4 queries por requisição autenticada/anônima na API, numa tabela pequena (cull acima de 300
  entradas por padrão).
- `createcachetable`: idempotente (`table_names()` já tem → "already exists" e retorna). O test runner do Django chama
  `createcachetable` no `create_test_db`, então os testes ganham a tabela sem mudança.
- Uso de cache no projeto: `git grep "from django.core.cache"` → só `core/tests/test_security_phase1.py`
  (`cache.clear()` no `ForwardedForThrottleTests`). O "cache de rota" do `vast_serverless_provider.py` é estado de
  módulo, não o cache do Django. Trocar o `default` só muda o throttle.
- `core/task_views.py::task_list_create` (l. 298-301) e `core/views.py::login` (l. 84-86): só `@api_view` +
  `@permission_classes`; **nenhum `@throttle_classes`/`throttle_scope` em todo o projeto** (`git grep -E
  "throttle_scope|throttle_classes|ScopedRate|AnonRate"` → zero). **Correção do registro da Fase 1 (l. ~602):** o
  `task_create: 30/min` não "sofre o mesmo" — ele **não é aplicado em lugar nenhum**; criar task só tem o
  `user: 300/min`. O limite próprio do login (por IP e por e-mail) também não existe; é a SEC-07.2 restante.

Hipóteses descartadas:
- "`NUM_PROXIES` ausente em produção": o default 1 está no `settings.py`.
- "Algum código depende do `LocMemCache`": nenhum uso fora do throttle e do teste.
- "Redis resolve a corrida": não resolve; o DRF faz get/set nos dois backends. Redis só ganha em latência.

**Decisões do dono (2026-10-29):** `DatabaseCache` (não Redis); task 4 = **aplicar** o `task_create` agora, no
mesmo branch; task 5 = o agente roda o aceite em produção depois do deploy (OK dado).

Próximo passo exato: branch nova no `ia_wrapper` a partir de `8cc17d2`; tasks 1-4 abaixo, nessa ordem; antes da
task 4, abrir o `POST` inteiro de `task_list_create` (l. 300 em diante) e conferir como `@api_view` +
`@throttle_classes` combinam com o `UserRateThrottle` global (o decorator **substitui** a lista padrão; manter os dois).

Tasks (com `DatabaseCache`):
1. `settings.py`: `CACHES = {'default': {'BACKEND': 'django.core.cache.backends.db.DatabaseCache', 'LOCATION':
   'django_cache'}}`. Teste: o backend `default` não é `LocMemCache`/`DummyCache` (falha se alguém tirar o `CACHES`).
2. `Dockerfile` `CMD` (e o `release` do `Procfile`, por coerência): `python manage.py createcachetable` depois do
   `migrate`. Prova: build local + boot; em produção, `/health/` 200 e uma chamada autenticada 200.
3. Teste de compartilhamento: duas instâncias **independentes** do backend (`caches.create_connection('default')`),
   uma por "worker", cada uma num `UserRateThrottle` com rate baixo; esgotar na A → a B nega. Limite do teste:
   com `LocMemCache` duas instâncias de mesmo `LOCATION` no mesmo processo também compartilham, então quem pega
   regressão é o teste da task 1; este prova que o histórico do DRF sobrevive ao pickle do `DatabaseCache`.
4. (decisão do dono, pode ir junto) aplicar o `task_create` de verdade: `ScopedRateThrottle` + `throttle_scope =
   'task_create'` só no `POST` do `task_list_create`, ou apagar o rate morto.
   **Correção (2026-10-29, ao abrir `rest_framework/decorators.py::api_view`):** o `api_view` copia
   `throttle_classes`, `permission_classes` etc. do func para a `WrappedAPIView`, mas **não** copia `throttle_scope`
   → `ScopedRateThrottle.allow_request` não acha o escopo e deixa tudo passar. Além disso `@throttle_classes` vale para
   GET e POST. Desenho adotado: `core/throttling.py::TaskCreateRateThrottle(UserRateThrottle)` com `scope =
   'task_create'` e `get_cache_key` → `None` fora do `POST` (chave `None` = `allow_request` devolve `True` sem contar);
   no view, `@throttle_classes([UserRateThrottle, TaskCreateRateThrottle])` (o decorator substitui a lista padrão).
   `THROTTLE_RATES` é atributo de classe lido no import → teste usa `patch.object(..., 'THROTTLE_RATES', ...)`, como o
   `ForwardedForThrottleTests`. O `POST /api/tasks/<id>/retry/` (`task_retry`) fica fora, como pedido.
5. Aceite em produção (**OK do dono**, requisições baratas: login com e-mail inexistente): `throttle_control.py noxff
   1300` → espera 429 por volta da 301ª em 60 s. Se der 429 sem XFF e não der com XFF trocado → hipótese (c) da Fase 1
   (edge do Railway não anexa o IP real), aí `NUM_PROXIES` precisa de outro tratamento.

**SEC-07.6 — tasks 1-4 implementadas (2026-10-29)**, branch `sec-07-6-throttle-shared-cache` do `ia_wrapper` (a partir
de `8cc17d2`), **ainda sem commit**:
- `settings.py::CACHES` = `DatabaseCache`/`django_cache`; `Dockerfile` `CMD` e `Procfile` `release` com
  `createcachetable` depois do `migrate`; `core/throttling.py::TaskCreateRateThrottle`; `task_list_create` com
  `@throttle_classes([UserRateThrottle, TaskCreateRateThrottle])`.
- Testes em `core/tests/test_security_phase1.py`: `SharedThrottleCacheTests` (tasks 1 e 3) e `TaskCreateThrottleTests`
  (task 4: 3º POST no minuto → 429 e só 2 tasks; GET não gasta `task_create`; `user` global continua no view).
  `python manage.py test core.tests` → 219 OK (eram 214). O label `core` sozinho não roda (`ImportError` do
  discover, `core/tests/` × `core`); usar `core.tests`.
- Mutação, um teste derrubado por vez: `CACHES` → LocMem derruba `test_default_cache_is_not_per_process`; tirar o
  `TaskCreateRateThrottle` derruba `test_third_task_in_a_minute_is_throttled`; tirar o `UserRateThrottle` derruba
  `test_global_user_rate_still_applies_to_the_view`; contar GET derruba `test_listing_tasks_does_not_spend_task_create`.
- Task 2: sem Docker na máquina, **build da imagem não provado**. Boot local (`runserver`, SQLite de dev): sem a tabela
  `/health/` 200 e `POST /api/auth/login/` **500** (`no such table: django_cache`); depois de `createcachetable` (2×,
  a 2ª "already exists") login 401 e 1 linha em `django_cache`. Confirma que o `/health/` sozinho não pega a falta da
  tabela: o aceite pós-deploy precisa de uma chamada na API.

Próximo passo: commit + merge/deploy (dono); depois do deploy, `/health/` 200 + uma chamada da API ≠ 500 e a task 5.

**Deploy e aceite (2026-10-29, dono pediu "pode testar direto no railway"):** commit `7ee4410` com fast-forward na
`main` e push; o Railway faz deploy pela `main` do GitHub (`railway deployment list`: `SUCCESS 7ee4410`; o `8cc17d2`
ficou `REMOVED`). Gunicorn com 4 workers. `/health/` 200; login com e-mail inexistente 401 (não 500 → a
`django_cache` existe).
- Task 5, `throttle_control.py noxff 1300` (16 threads): `{401: 952, 429: 348}` em 22 s, **primeiro 429 na 913ª**
  (esperado ~301). Melhor que antes (4 contadores separados = 1200), mas não é o limite de 300.
- Hipótese: a corrida de ler-e-gravar sem atomicidade do `SimpleRateThrottle` (ver a análise acima), maior do que a
  estimativa "um pouco acima": workers que atendem ao mesmo tempo leem a mesma lista e gravam n+1, e as contagens se
  perdem. Teste: mesma rajada com 2 threads, depois de 65 s.
- 2 threads (`throttle_conc.py 2 400 65`, scratchpad da sessão `fac98281…`): `{401: 400}` em 55 s, **nenhum 429**.
  Não separa as hipóteses: (a) corrida — com 2 em paralelo pode perder ~metade e contar ~200; (b) a chave do
  throttle varia entre requisições (o IP que o edge anexa por último no XFF não é estável → várias chaves).
- 1 thread não serve de teste: ~3,6 req/s → ~220 em 60 s, nunca chega a 300. Cancelado.
- Teste decisivo (pendente, **bloqueado pela permissão do agente para leitura em produção**): via `railway ssh
  --service iawrappernew`, `python manage.py shell` listando as chaves `%throttle%` da `django_cache` e o tamanho de
  cada histórico logo depois de uma rajada. Uma chave com histórico ≤ 300 → (a); várias chaves `throttle_user_<ip>`
  com IPs diferentes → (b).
- Pista a favor de (a): o primeiro 429 da rajada de 16 threads veio **sem** `Retry-After`. O `wait()` só devolve
  `None` quando o histórico tem ≥ 301 entradas, então naquela chave a lista passou do limite.
- Se for (a): o `SimpleRateThrottle` não serve com concorrência real. Correção = throttle próprio com contador
  atômico (janela fixa: `UPDATE ... SET n = n + 1 RETURNING n` no Postgres, ou `INCR` no Redis). O `incr` do
  `DatabaseCache` também é get+set (`BaseCache.incr`), então não resolve. Se for (b): `NUM_PROXIES`/identificação do
  cliente precisa de outro tratamento (hipótese (c) da Fase 1).
- Estado em produção: `7ee4410` no ar e saudável. É melhor que o `8cc17d2` (bloqueia parte da rajada) e não precisa
  de rollback.

**Decisão do dono (2026-10-29), depois da discussão sobre a corrida:**
- A corrida do throttle **não será corrigida agora** (nem Redis, nem contador atômico). Motivo: 900/min ou 300/min
  por IP dão praticamente a mesma proteção contra adivinhação de senha (lista de 10 mil senhas em ~11 min ou ~33
  min); o que muda o quadro é o limite **por conta**. Hipóteses (a) corrida × (b) chave variando ficam **sem
  confirmação** (teste no `railway ssh` não rodou); quem retomar o throttle começa pela consulta descrita acima.
- O padrão de mercado, se um dia voltar: `RedisCache` do Django (`add` = `SET NX EX`, `incr` = `INCR`, atômicos;
  conferido em `django/core/cache/backends/redis.py:96,137`) com um limitador `add` + `incr` (padrão do
  `django-ratelimit`, código não aberto). O `incr` do `DatabaseCache` é get+set (`base.py:268-272`), sem garantia.
- Cloudflare na frente: só quando houver domínio próprio (o app chama `*.up.railway.app` direto,
  `app/build.gradle.kts:32`); pré-requisitos: cabeçalho secreto Cloudflare → Django, IP do cliente pelo
  `CF-Connecting-IP` em vez do `NUM_PROXIES=1`, e bloqueio com 429, nunca captcha (o app espera JSON).
- **Próximo: SEC-07.7, limite de falhas de login por e-mail** (bloco abaixo), antes de distribuir fora do círculo
  de teste.

##### SEC-07.7 — limite de falhas de login por e-mail: análise inicial e passagem de bastão (2026-10-29)

Objetivo: depois de N senhas erradas seguidas no mesmo e-mail, o login daquele e-mail responde 429 por M minutos,
venha a tentativa de qualquer IP. Contra credential stuffing e adivinhação distribuída, que o limite por IP não pega.
Backend `d:\projects\iawrapper\ia_wrapper`, `main` = `7ee4410` (deploy automático no Railway a cada push na `main`).

Símbolos abertos nesta sessão:
- `core/views.py::login` (l. 84-130): `@api_view(['POST'])` + `AllowAny`; sem throttle próprio (pega só o
  `UserRateThrottle` global, chave por IP para anônimo). `LoginSerializer` (`core/serializers.py:5`) =
  `EmailField` + `CharField`; **não normaliza maiúsculas**. Fluxo: `User.objects.get(email=email)` → `DoesNotExist`
  → 401 `Invalid credentials`; `check_password` falso → mesmo 401; sucesso → JWT (`RefreshToken.for_user`). **Não usa
  `authenticate()`** → e-mail inexistente responde sem calcular hash: dá para descobrir quais e-mails existem pelo tempo
  de resposta (achado lateral; registrar à parte, não é desta task).
- App Android, `ai/remote-http/.../IawrapperBackend.kt::resolveAuthHeader` (l. 208-247): guarda `email:senha` na
  config e faz login **de novo sempre que não tem token em memória** (processo novo, ou 401 em `POST /api/tasks/`,
  l. 140-142). Resposta fora de 2xx vira `AiError.Remote(code, corpo)`. **Consequência para o desenho:** uma senha
  salva errada no app gera uma falha a cada geração → o próprio dono da conta se bloqueia. E uma conta de teste
  compartilhada entre aparelhos é bloqueada para todos por um aparelho só. Por isso: bloqueio **curto e temporário**
  (nunca permanente), mensagem de 429 legível no app, contador zerado no login bem-sucedido.
- `django.core.cache` agora é `DatabaseCache` (SEC-07.6), com get+set não atômico: **não usar cache para este
  contador**. Contar no Postgres com escrita atômica.

Desenho proposto (a próxima sessão confirma ou corrige antes de editar):
1. Modelo `LoginFailure` (ou campo no `User`; preferir tabela própria, porque e-mail inexistente também tem de contar,
   senão o bloqueio revela quais e-mails existem): `email` normalizado (`strip().lower()`), `failures`,
   `first_failure_at`, `locked_until`. Incremento atômico: `update_or_create` não é atômico; usar
   `select_for_update()` dentro de `transaction.atomic()`, ou `UPDATE ... SET failures = F('failures') + 1`.
2. No `login`: antes de procurar o usuário, se `locked_until > agora` → 429 com `Retry-After` e a mesma mensagem para
   e-mail existente ou não. Falha (inexistente ou senha errada) → incrementa; ao chegar a N → `locked_until = agora +
   M`. Sucesso → apaga/zera a linha.
3. N e M por env no `settings.py` (sugestão: N = 10 em 15 min, M = 15 min; abaixo de 10 o caso "senha salva errada no
   app" bloqueia rápido demais). Migração nova.
4. App: conferir como o `AiError.Remote(429, ...)` aparece para o usuário no fluxo de geração (abrir quem trata
   `AiError.Remote` na UI antes de mexer); se mostrar só "erro", trocar por "muitas tentativas de login, tente em X
   min".

Provas (testes no `core/tests/`, padrão do `test_security_phase1.py`; rodar com `python manage.py test core.tests`,
o label `core` sozinho não funciona):
- N falhas no mesmo e-mail → a (N+1)ª responde 429, **mesmo com a senha certa** e mesmo trocando `X-Forwarded-For`.
- E-mail inexistente bloqueia igual ao existente (mesmo status e mesmo corpo).
- `Email@X.com` e `email@x.com` contam no mesmo contador.
- Login certo antes de N zera o contador.
- Depois de M (mock do relógio), volta a aceitar.
- Outro e-mail não é afetado.
- Mutação: tirar o incremento ou o teste do `locked_until` derruba o teste correspondente.
- Aceite em produção depois do deploy: N+1 logins com um e-mail inexistente → 429 na (N+1)ª; login com conta real
  continua 200. **Commit, push e requisições a produção só com OK do dono.**

Confirmação da sessão de implementação (2026-10-29, antes de editar):
- Backend `7ee4410`, árvore limpa. `core/views.py::login` e `LoginSerializer` conferem com o descrito acima.
  `User.email` = `EmailField(unique=True)`, busca exata (`email=email`): a busca **não** muda nesta task (só a chave do
  contador é normalizada). Testes rodam em SQLite (`USE_SQLITE` padrão `True`): `select_for_update` vira no-op lá,
  então a atomicidade vem do `UPDATE ... SET failures = F('failures') + 1`, que vale nos dois bancos.
- **Achado que muda o desenho:** o app não usa conta por usuário. `AppGraph.kt:102-105` injeta
  `BuildConfig.IAWRAPPER_CREDENTIAL` (`app/build.gradle.kts:34`, `email:senha` de `local.properties`) como o segredo
  de imagem de **toda** instalação. Ou seja: uma conta de serviço, com e-mail e senha dentro do APK. Para essa conta
  o bloqueio não protege nada (quem extrai o APK já tem a senha) e cria um DoS: 10 senhas erradas a cada 15 min
  bloqueiam a geração de imagem de todos os usuários que abrirem o app (processo novo → login → 429).
  Decisão de implementação: `LOGIN_LOCKOUT_EXEMPT_EMAILS` (env, lista separada por vírgula, vazia por padrão) isenta
  e-mails do bloqueio. **Pendente com o dono:** pôr o e-mail da conta de serviço nessa env no Railway antes ou junto
  do deploy. Conta de serviço no APK é um problema próprio (fora do escopo): registrar.
- App: `ImageGenScreen.kt::describeImageError` (l. 83-90) trata 401 e 402; 429 cai no genérico "Tente de novo em
  instantes". O `Retry-After` não chega até lá (`IawrapperBackend.kt:237` só leva o corpo). Task: ramo 429 com mensagem
  de "muitas tentativas, aguarde alguns minutos", prova em `ImageGenConfigTest`.

Tasks (operacional):
1. `core/models.py::LoginFailure` + migração `0014` (`email` único, `failures`, `first_failure_at`, `locked_until`).
2. `core/login_lockout.py`: `is_locked(email)`, `register_failure(email)`, `clear(email)`; janela de N em W min,
   bloqueio de M min; env `LOGIN_LOCKOUT_MAX_FAILURES` (10), `LOGIN_LOCKOUT_WINDOW_MINUTES` (15),
   `LOGIN_LOCKOUT_MINUTES` (15), `LOGIN_LOCKOUT_EXEMPT_EMAILS`.
3. `core/views.py::login`: checa bloqueio antes da busca; falha conta; sucesso limpa. Prova:
   `core/tests/test_login_lockout.py`.
4. App: ramo 429 em `describeImageError`. Prova: `ImageGenConfigTest`.

Feito (2026-10-29, sem commit, aguardando OK do dono):
- Backend (`d:\projects\iawrapper\ia_wrapper`): `core/models.py::LoginFailure`, `core/migrations/0014_login_failure.py`,
  `core/login_lockout.py` (`seconds_locked`, `register_failure`, `clear`; janela vencida recomeça em 1 por UPDATE
  condicional, senão `F('failures') + 1`; ao chegar a N grava `locked_until` e zera o contador), 4 settings
  `LOGIN_LOCKOUT_*` em `ia_wrapper/settings.py`, `core/views.py::login` (429 com `Retry-After` e `retry_after` no
  corpo, antes da busca do usuário). A busca do usuário segue exata, sem normalizar.
- `python manage.py test core.tests.test_login_lockout`: 9 testes OK. Mutações: tirar o filtro de `locked_until` → 4
  falhas; trocar o incremento por `pass` → 4 falhas. Restaurado. Suíte inteira `core.tests`: 228 testes OK.
- App: `describeImageError` com ramo 429; `gradlew :app:testDebugUnitTest --tests ImageGenConfigTest` OK.
- Decisão do dono (2026-10-29): `LOGIN_LOCKOUT_EXEMPT_EMAILS` **não** será configurada agora; vai para o backlog
  (item abaixo). Risco aceito enquanto isso: quem extrair o e-mail da conta de serviço do APK pode bloquear a geração
  de imagem de todo o app por 15 min a cada 10 senhas erradas.
- No ar (2026-10-29): backend `c0f00a9` (push na `main`), deploy Railway `86510fb0` SUCCESS. Aceite em produção:
  11 logins com e-mail inexistente `sec077-accept-<epoch>@example.invalid` → `401 ×10, 429`; o 12º trouxe
  `Retry-After: 898` e `{"error":"Too many failed login attempts. Try again later.","retry_after":898}`; login com a
  conta real (credencial do `local.properties`) → 200. **SEC-07.7 concluído.** As mudanças do app (ramo 429) seguem
  sem commit no `product_photo_offline`, junto das outras alterações pendentes da árvore.

##### SEC-07.8 — isentar a conta de serviço do APK do bloqueio por e-mail (backlog, 2026-10-29)

O código já existe (SEC-07.7): basta pôr `LOGIN_LOCKOUT_EXEMPT_EMAILS=<e-mail da conta de serviço>` (lista separada
por vírgula) nas variáveis do serviço `iawrappernew` no Railway. Prova: 11 logins errados com esse e-mail e o 12º,
com a senha certa, responde 200. Some de vez quando o app deixar de usar conta de serviço embutida (item da conta de
serviço no APK, acima).

##### SEC-05.1 + SEC-05.2 + SEC-06.1 — `is_active`, refresh e `GET /users/<id>/` (análise, 2026-10-30)

Escolha do dono depois do SEC-07.7. Backend em `c0f00a9`.

Símbolos abertos:
- `core/authentication.py::CustomJWTAuthentication.get_user`: sobrescreve o do SimpleJWT e busca `core.User` por
  `user_id`; **não** confere `is_active`. O original (SimpleJWT 5.5.1, `inspect.getsource`) confere
  `CHECK_USER_IS_ACTIVE`; a sobrescrita perdeu isso. Usuário inexistente → `AuthenticationFailed` (401).
- `core/views.py::login`: depois da senha certa emite JWT sem olhar `is_active`. `google_login`: `get_or_create`
  por e-mail e JWT, também sem `is_active`.
- `auth/refresh/` = `TokenRefreshView` do SimpleJWT (`core/urls.py:23`). `TokenRefreshSerializer.validate` busca o
  `user_id` em `get_user_model()` = **`auth.User`** (`AUTH_USER_MODEL` não definido), com `.get()` sem `try`: id
  sem `auth.User` igual → `DoesNotExist` → 500; id que coincide com um `auth.User` (superusuário do admin) → confere o
  `is_active` do usuário errado. `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=False`, sem o app
  `token_blacklist` (`outstand()` devolve `None`). Quem chama: o SPA (`ia_wrapper_frontend/src/services/api.ts:46-55`)
  em todo 401; falhou, apaga o token (logout). O app Android não usa refresh (faz login de novo).
- `core/views.py::get_user` (`GET /api/users/<id>/`): permissão padrão `IsAuthenticated`, sem checagem de dono.
  Nenhum cliente chama essa rota (SPA usa `users/me/` e `users/list/`; o app nenhuma). `delete_user` já faz
  "admin ou o próprio" com `getattr`/`hasattr` (por causa da `SessionAuthentication`, SEC-05.4).

Desenho:
1. `get_user` da autenticação: `is_active` falso → `AuthenticationFailed('User is inactive', code='user_inactive')`.
2. `login`: senha certa e conta inativa → 403 `Account disabled` (só revela com a senha certa; não conta falha no
   SEC-07.7). `google_login`: mesma resposta para conta existente inativa.
3. `core/serializers.py::CoreTokenRefreshSerializer` em `SIMPLE_JWT['TOKEN_REFRESH_SERIALIZER']`: busca `core.User`;
   ausente ou inativo → 401 `no_active_account`; senão gera access (com `email`/`is_admin` atuais) e roda o refresh,
   como o original.
4. `get_user`: nem admin nem o próprio → 404 `User not found` (igual a id inexistente: não confirma que o id existe).

Provas (`core/tests/test_account_access.py`): token de usuário desativado → 401 em `users/me/`; login inativo → 403;
google_login inativo → 403 (mock do `verify_oauth2_token`); refresh de usuário ativo → 200 com access que autentica;
refresh de inativo → 401; refresh de id sem `auth.User` → não 500; `GET /users/<outro>/` → 404, o próprio → 200,
admin → 200. Fora do escopo: revogação por `token_version` (SEC-05.3), tirar `SessionAuthentication` (SEC-05.4).

Feito (2026-10-30, sem commit, aguardando OK do dono):
- `core/authentication.py::CustomJWTAuthentication.get_user`, `core/views.py::login`/`google_login`/`get_user`,
  `core/serializers.py::CoreTokenRefreshSerializer`, `SIMPLE_JWT['TOKEN_REFRESH_SERIALIZER']` em `settings.py`.
- `python manage.py test core.tests.test_account_access`: 11 OK. O teste do Google injeta `google.oauth2` e
  `google.auth.transport` em `sys.modules`: o `google-auth` está no `requirements.txt` mas não no Python local.
- Mutações (cada uma derruba só o teste dela): `is_active` da autenticação, do `login` e do `google_login`; checagem de
  dono do `get_user` (2 testes); `is_active` do refresh. Tirar o `TOKEN_REFRESH_SERIALIZER` → os 3 testes de refresh
  dão ERROR (`DoesNotExist` do `auth.User`, o 500 de produção).
- Suíte `core.tests`: 239 testes OK.
- Aceite em produção depois do deploy: `GET /api/users/<id de outro>/` com token comum → 404; `POST /api/auth/refresh/`
  com o refresh de um login → 200 (antes: 500).
- No ar (2026-10-30): backend `220b784`, deploy Railway `bc43fec3` SUCCESS. Aceite com a credencial do
  `local.properties` (script Python com `urllib`, sem imprimir e-mail nem token): login 200; refresh 200 e o access
  novo autentica em `users/me/` (200); `GET /users/<o próprio id>/` 200; dois ids de outros → 404. **O 404 não prova
  a checagem de dono:** essa conta tem `is_admin=True`, e admin lê qualquer id; os ids testados não existem.
  Aceite do 404 com conta comum (OK do dono, 2026-10-30): criada `sec061-accept-1793335474@example.invalid` (id 4,
  `is_admin=False`, senha aleatória) por `POST /api/users/` → 201; `GET /users/<id do admin, existente>/` → 404
  `{'error': 'User not found'}`, idêntico ao de `GET /users/99999999/`; o próprio → 200. Conta apagada no fim pelo
  `DELETE /users/4/delete/` → 200; login depois → 401. **SEC-05.1, SEC-05.2 e SEC-06.1 concluídos.**
- **Achado crítico (2026-10-30):** a credencial do `local.properties`, que o build injeta no `BuildConfig` de **todo
  APK** (`app/build.gradle.kts:34`, `AppGraph.kt:104`), é de uma conta **admin** em produção (`is_admin=True` na
  resposta do login). Quem extrai o APK vira admin do iawrapper: lista usuários, mexe em provedores, bindings e
  features. Agrava o SEC-02.1 (Fase 0) e o SEC-01. Correção imediata possível sem código: o app usar uma conta de
  serviço **comum** (sem `is_admin`) e o admin ganhar senha nova. Decisão do dono.
  **Decisão do dono (2026-10-30):** a credencial admin no APK é só para os testes do círculo. Em produção o app usa a
  conta do próprio cliente (SEC-01): login pelo Google, que cria a conta se não existir; logou uma vez, fica logado
  até sair. Consequências registradas:
  - Nenhum APK com a credencial admin pode sair do círculo de teste; a trava de build do SEC-08 (falhar o release com
    credencial no `BuildConfig`) é o que garante isso. Trocar a senha do admin antes de distribuir.
  - O DoS do SEC-07.8 some em produção (cada cliente tem a própria conta, e o login Google não passa pelo limite de
    senha). O SEC-07.8 só vale enquanto houver conta compartilhada.
  - Pré-requisitos de backend para esse fluxo: SEC-07.1 (o `google_login` liga por e-mail sem `email_verified`:
    quem cadastra antes pelo `POST /api/users/` com o e-mail da vítima continua com a senha da conta que a vítima
    passa a usar pelo Google); "fica logado" = guardar o refresh e regravá-lo a cada renovação
    (`ROTATE_REFRESH_TOKENS=True`), validade de 7 dias (`REFRESH_TOKEN_LIFETIME_DAYS`); o refresh funciona desde o
    SEC-05.2 (`220b784`).

Fora do escopo desta task (registrar, não fazer): o vazamento de existência de e-mail pelo tempo de resposta; o app
guardar a senha em texto na config; o `change_password` (`core/views.py:229`, não aberto) provavelmente confere a
senha atual sem limite próprio (exige token válido) — abrir antes de afirmar.

##### SEC-07.8 — sessão longa no aparelho (login uma vez só): análise inicial (2026-10-29, nada editado)

Intenção do dono: o cliente faz login uma vez no aparelho e não precisa logar de novo, a não ser que desinstale o app
ou faça logout de propósito. Consequência: login legítimo é raro, então os limites da SEC-07.7 podem ser apertados.

O que existe hoje (aberto nesta sessão):
- `settings.py::SIMPLE_JWT` (l. 131-136): access 60 min, refresh **7 dias** (env `REFRESH_TOKEN_LIFETIME_DAYS`),
  `ROTATE_REFRESH_TOKENS=True` (cada refresh devolve um refresh novo com prazo renovado → sessão "deslizante": quem abre
  o app ao menos uma vez a cada 7 dias fica logado), `BLACKLIST_AFTER_ROTATION=False` (o refresh antigo continua
  valendo até expirar).
- `core/urls.py:23`: `auth/refresh/` → `TokenRefreshView` (existe).
- **O app não usa isso**: `IawrapperBackend.kt::resolveAuthHeader` guarda `email:senha`, guarda o access só em
  memória (`cachedToken`) e faz login de novo a cada processo novo ou 401. Nunca chama `/api/auth/refresh/`.
- **Logout não revoga nada (defeito):** `core/views.py::logout` chama `RefreshToken(...).blacklist()`. No
  simplejwt, `BlacklistMixin.blacklist` só é definido se `rest_framework_simplejwt.token_blacklist` está no
  `INSTALLED_APPS` (`rest_framework_simplejwt/tokens.py:265,282`), e o `INSTALLED_APPS` (`settings.py:67-78`) **não
  tem** esse app → `AttributeError` → cai no `except Exception` → **400** com o texto do erro, e o refresh continua
  válido até expirar. Não testado em produção; lido no código.

O que fazer (ordem sugerida, cada um com prova):
1. Backend: pôr `rest_framework_simplejwt.token_blacklist` no `INSTALLED_APPS` (+ `migrate`, cria as tabelas) e
   `BLACKLIST_AFTER_ROTATION=True`. Prova: teste "logout → 200 e o mesmo refresh no `/api/auth/refresh/` → 401";
   teste "refresh usado uma vez → o antigo não renova de novo".
2. Backend: `REFRESH_TOKEN_LIFETIME_DAYS` maior (ex.: 90, decisão do dono) — com rotação, é o prazo de inatividade
   máxima, não o da sessão.
3. App: guardar o **refresh token** (armazenamento cifrado do Android, ex. `EncryptedSharedPreferences`/Keystore) no
   lugar da senha; com access vencido (401) → `/api/auth/refresh/`; só volta à tela de login se o refresh for
   recusado. Logout no app → `POST /api/auth/logout/` + apagar o token local. Prova: teste instrumentado matando o
   processo e gerando de novo sem novo login.
4. Com o item 3 no ar, o motivo para o limite da SEC-07.7 ser frouxo (senha salva errada no app gerando falhas a cada
   geração) deixa de existir: dá para baixar para ~5 falhas/15 min por e-mail e ~5 logins/min por IP.

Atenção: há outra sessão implementando a SEC-07.7 direto na `main` do `ia_wrapper` (sem branch; mudanças sem commit
em `core/views.py`, `core/models.py`, `settings.py`, `core/login_lockout.py`, migração `0014_login_failure.py`).
A SEC-07.8 mexe no `settings.py` e no `views.py` também: começar só depois que a SEC-07.7 for commitada.

**Passagem de bastão SEC-07.8 (2026-10-29):**
- Pré-condição: `git status` limpo no `ia_wrapper` e a SEC-07.7 commitada. Se ainda houver mudanças da SEC-07.7
  sem commit, **parar e avisar o dono**; não commitar trabalho de outra sessão.
- Decisão pendente do dono, perguntar no início: prazo de inatividade do refresh (sugestão 90 dias) e se os limites
  da SEC-07.7 baixam já (item 4) ou só depois de o app novo estar com os usuários.
- Backend (itens 1-2): branch nova no `ia_wrapper` a partir da `main`. Antes de editar, abrir
  `rest_framework_simplejwt/token_blacklist/` (migrações, `apps.py`) e a `TokenRefreshView`/`TokenRefreshSerializer`
  da versão instalada, para confirmar como a rotação grava o token antigo na blacklist. Conferir também se o
  `core.authentication.CustomJWTAuthentication` valida o access contra alguma coisa além da assinatura (o access não
  passa pela blacklist; só o refresh).
- App (item 3), neste repositório: `IawrapperBackend.kt` **ainda não está no git** (`??` no `git status` desta
  árvore, junto com muitas outras mudanças sem commit de sessões anteriores) — não reverter nem commitar o que não for
  desta task. Antes de editar, abrir `resolveAuthHeader` (l. 208-247), quem chama `auth()` e de onde vem o
  `email:senha` (config/tela), e quem trata `AiError.Remote` na UI.
- Commit, push (deploy automático na `main` do backend) e requisições a produção: **só com OK do dono**. Achado novo (2026-10-29): toda
instalação do app usa a mesma conta de serviço, com `email:senha` no `BuildConfig` (`AppGraph.kt:104`): quem extrai o
APK gasta os créditos dessa conta, e nenhum limite por conta distingue um usuário do outro. Pede item próprio.

**SEC-07.8 — sessão de implementação (2026-10-29): parada na pré-condição, nada editado em código.**
- Pré-condição **falhou**: `git status` no `ia_wrapper` (`main` = `7ee4410`) mostra a SEC-07.7 ainda sem commit
  (`M core/models.py`, `M core/views.py`, `M ia_wrapper/settings.py`, `?? core/login_lockout.py`,
  `?? core/migrations/0014_login_failure.py`, `?? core/tests/test_login_lockout.py`). Backend não tocado.
- Biblioteca conferida (`djangorestframework-simplejwt==5.5.1`, igual ao `requirements.txt`):
  `serializers.py::TokenRefreshSerializer.validate` (l. 111-145) — com `ROTATE` + `BLACKLIST_AFTER_ROTATION` chama
  `refresh.blacklist()` (se o app de blacklist não está instalado, engole o `AttributeError` em silêncio) e depois
  `set_jti/set_exp/set_iat/outstand`. `tokens.py::BlacklistMixin` (l. 265+): `verify` só checa a blacklist e
  `blacklist()` só existe com `token_blacklist` no `INSTALLED_APPS`; `blacklist()` faz `get_or_create` do
  `OutstandingToken`, então refresh emitido **antes** de instalar o app também pode ser revogado. Migrações do app vão
  até `0013`. Confirma o defeito do logout descrito acima.
- `core/authentication.py::CustomJWTAuthentication` só sobrescreve `get_user` (busca por `pk`): o access não passa por
  blacklist nenhuma — logout revoga o refresh, o access vale até o fim dos 60 min.
- **Achado que muda o item 3 (app):** o app **não tem login de cliente**. Não há tela de login/logout (grep por
  `login|logout|senha` em `app/src/main` e `feature/`: só um comentário). `AppGraph.kt::secrets` usa
  `BuiltInSecretStore` (l. 302-309), que dá **precedência** ao `BuildConfig.IAWRAPPER_CREDENTIAL` sobre o que estiver
  salvo; `ImageGenScreen.kt:64` documenta que "o usuário não digita" a credencial. Logo "guardar o refresh no lugar da
  senha" não tira a senha do aparelho (ela está no APK) e não existe "voltar à tela de login" nem "logout no app".
  Feito como escrito, o item 3 só economiza um `POST /api/auth/login/` por processo da conta de serviço.
  A intenção do dono ("cliente loga uma vez") pressupõe conta por cliente, que depende do item novo da conta de
  serviço (acima) — é esse item que vem antes.
- Itens 1-2 (backend: blacklist + `BLACKLIST_AFTER_ROTATION` + prazo maior) continuam válidos sozinhos e corrigem o
  logout; esperam o commit da SEC-07.7. Item 4 (baixar limites) não pode vir antes de existir login por cliente: hoje
  o único login é o da conta de serviço, isenta do bloqueio por `LOGIN_LOCKOUT_EXEMPT_EMAILS`.
- **Decisões do dono (2026-10-29):** refresh com **90 dias** de inatividade máxima; **item 3 (app) adiado** até
  existir conta por cliente (item próprio da conta de serviço). Item 4 adiado junto. Escopo da SEC-07.8 agora = itens
  1-2, só backend.
- Próximo passo exato (quando a SEC-07.7 estiver commitada, `git status` limpo no `ia_wrapper`):
  1. branch `sec-07.8-refresh-blacklist` a partir da `main`;
  2. `ia_wrapper/settings.py`: `'rest_framework_simplejwt.token_blacklist'` no `INSTALLED_APPS`;
     `SIMPLE_JWT['BLACKLIST_AFTER_ROTATION'] = True`; padrão de `REFRESH_TOKEN_LIFETIME_DAYS` = `90`
     (conferir se o Railway sobrescreve essa env);
  3. `python manage.py migrate` local (migrações `token_blacklist` 0001-0013; não geram migração no `core`);
  4. `core/tests/test_refresh_session.py`: login → refresh → 200 com refresh novo; refresh antigo de novo → 401;
     logout com refresh → 200 e esse refresh em `/api/auth/refresh/` → 401; logout sem refresh → 200.
     Mutação: tirar `BLACKLIST_AFTER_ROTATION` derruba o 2º teste; tirar o app do `INSTALLED_APPS` derruba o 3º
     (logout volta a 400);
  5. `python manage.py test core.tests` inteiro; commit, push e aceite em produção só com OK do dono.
     No deploy, o `migrate` cria as tabelas; refresh emitido antes continua válido até expirar (7 dias), sem
     derrubar ninguém.

**SEC-07.8 — 2ª sessão de implementação (2026-10-30): parada de novo, nada editado em código. O plano acima está
errado em dois pontos; vale o plano corrigido abaixo.**
- Início: `ia_wrapper` limpo, `main` = `origin/main` = `c0f00a9` (SEC-07.7 commitada). Linha de base
  `python manage.py test core.tests` → **239 OK** (SQLite local: o `.env` não tem `DATABASE_URL` e `USE_SQLITE`
  vale `True` por padrão). Atenção: essa contagem pode já incluir parte da outra sessão (próximo item).
- **Pré-condição falhou durante a sessão:** outra sessão começou a implementar SEC-05.1/05.2/06.1 direto na `main`
  do `ia_wrapper`, sem commit: `M core/authentication.py`, `M core/serializers.py`, `M core/views.py`,
  `M ia_wrapper/settings.py`, `?? core/tests/test_account_access.py`. São os arquivos da SEC-07.8. Nada criado
  nem editado no `ia_wrapper`, branch não criada. As provas abaixo rodaram com settings e testes **no scratchpad**
  (`PYTHONPATH=<scratch> python manage.py test probe_test --settings=probe_settings`, com `probe_settings` = settings
  do projeto + `token_blacklist` + `BLACKLIST_AFTER_ROTATION=True`).
- **Erro 1 do plano: instalar `token_blacklist` quebra o login.** O `settings.py` não define `AUTH_USER_MODEL`, e o
  `core.User` (`core/models.py:21`) é `models.Model` comum. Então `get_user_model()` é o `auth.User` e
  `OutstandingToken.user` (`token_blacklist/models.py:8`) é FK para `auth.User`. `BlacklistMixin.for_user`
  (`tokens.py:335-352`, só existe com o app instalado) faz `OutstandingToken.objects.create(user=<core.User>)`.
  Prova: com `probe_settings`, `POST /api/auth/login/` com senha certa →
  `ValueError: Cannot assign "<User: a@example.com>": "OutstandingToken.user" must be a "User" instance.`
  (sem o app: 200). `BlacklistMixin.blacklist()` e `outstand()` (`tokens.py:282-332`) procuram o `user_id` no
  `auth.User`. Não quebram (`DoesNotExist` → `user=None`), mas ligariam o token a um superusuário do Django admin
  que tenha o mesmo id.
- **Erro 2 do plano: `BLACKLIST_AFTER_ROTATION=True` sozinho não faz nada.** O refresh em uso é o
  `core.serializers.CoreTokenRefreshSerializer` (`SIMPLE_JWT['TOKEN_REFRESH_SERIALIZER']`), que vem da SEC-05.2 da
  outra sessão, **sem commit**. O `validate` dele procura no `core.User`, confere `is_active` (inativo → 401,
  provado) e, com `ROTATE`, chama só `set_jti/set_exp/set_iat`: **nunca chama `blacklist()`**. A mutação "tirar a
  flag derruba o 2º teste" do plano anterior não derrubaria nada.
- Confirmado sem mudança: `RefreshToken.__mro__` = `RefreshToken, BlacklistMixin, Generic, Token, object`, e
  `super(BlacklistMixin, RefreshToken).for_user` = `Token.for_user`. `core/views.py::logout` exige access válido
  (`IsAuthenticated`) e cai em 400 em qualquer exceção. Logout repetido com o mesmo refresh → `TokenError`
  ("Token is blacklisted") → 400: aceitável, fica como está. `RefreshToken` é usado só em `core/views.py` (login,
  google_login, logout). Nenhum teste usa `RefreshToken`.
- Fora do escopo (registrar, não fazer): o `logout` revoga qualquer refresh recebido, sem conferir se é do
  `request.user`. Quem tem o refresh de outro já pode usá-lo, então o risco é baixo.
- **Próximo passo exato (corrigido)**, quando a SEC-05/06 da outra sessão estiver commitada e o `git status` do
  `ia_wrapper` limpo (se não estiver: parar e avisar o dono de novo):
  1. branch `sec-07.8-refresh-blacklist` a partir da `main`; abrir de novo `core/serializers.py::CoreTokenRefreshSerializer`
     e `core/views.py` (login/google_login/logout) na versão commitada;
  2. `ia_wrapper/settings.py`: `'rest_framework_simplejwt.token_blacklist'` no `INSTALLED_APPS`;
     `BLACKLIST_AFTER_ROTATION=True`; padrão de `REFRESH_TOKEN_LIFETIME_DAYS` = `90` (conferir se o Railway
     sobrescreve essa env: `railway variables`, só leitura);
  3. novo `core/tokens.py::CoreRefreshToken(RefreshToken)`, que nunca liga token a `auth.User`:
     `for_user` = `super(BlacklistMixin, cls).for_user(user)` (pula o `OutstandingToken` na emissão; o
     `blacklist()` cria o registro quando precisa); `blacklist()` = mesma lógica da lib com `user=None`
     (`OutstandingToken.get_or_create(jti=…, defaults={user: None, created_at: self.current_time, token: str(self),
     expires_at: datetime_from_epoch(self['exp'])})` + `BlacklistedToken.get_or_create(token=…)`);
  4. `core/views.py`: login, google_login e logout usam `CoreRefreshToken`; `CoreTokenRefreshSerializer`:
     `token_class = CoreRefreshToken` e, com `ROTATE_REFRESH_TOKENS and BLACKLIST_AFTER_ROTATION`,
     `refresh.blacklist()` **antes** do `set_jti()`. Refresh na blacklist é recusado no `token_class(...)` →
     `TokenError` → a view devolve 401;
  5. `migrate` local (token_blacklist 0001-0013; `makemigrations --check` sem mudança no `core`);
  6. `core/tests/test_refresh_session.py`: (a) login → 200 com o app instalado; (b) refresh → 200 com refresh novo;
     o antigo de novo → 401; (c) logout com refresh → 200 e esse refresh em `/api/auth/refresh/` → 401;
     (d) logout sem refresh → 200; (e) `OutstandingToken.user` fica `None`, mesmo com um `auth.User` de mesmo id.
     Mutações: login com o `RefreshToken` da lib → (a) cai (500/`ValueError`); tirar o `blacklist()` do serializer
     → (b) cai; tirar o app do `INSTALLED_APPS` → (c) cai (logout volta a 400);
  7. `python manage.py test core.tests` inteiro (≥ 239 + novos); commit, push e aceite em produção só com OK do dono.

**SEC-07.8 — 3ª sessão (2026-10-30): pré-condição ok, implementação em andamento.**
- Estado inicial: `ia_wrapper` limpo, `main` = `220b784` (SEC-05.1/05.2/06.1 commitada **só local**: `main` 1 à
  frente de `origin/main` = `c0f00a9`). Branch `sec-07.8-refresh-blacklist` criada a partir de `220b784`; o push
  dela leva junto o `220b784`.
- Reaberto na versão commitada, sem mudança desde a 2ª sessão: `CoreTokenRefreshSerializer.validate`
  (`core/serializers.py:99-116`) faz rotação só com `set_jti/set_exp/set_iat`; `views.py` usa
  `RefreshToken.for_user` no login (l.153) e no google_login (l.218), e `RefreshToken(...).blacklist()` no logout
  (l.250-251, `except Exception` → 400). Biblioteca instalada `djangorestframework-simplejwt` 5.5.1 (= `requirements.txt`):
  `BlacklistMixin.verify` chama `check_blacklist()` só com o app no `INSTALLED_APPS` (decidido no import);
  `TokenViewBase.post` converte `TokenError` em `InvalidToken` (401).
- Railway (`railway variables --service iawrappernew --kv`, filtrado por `LIFETIME|ROTATE|BLACKLIST`): 28
  variáveis, **nenhuma** dessas. O padrão de 90 dias do código vale em produção.
- **Implementado, commit `d19e073`** na branch `sec-07.8-refresh-blacklist` (sem push), passos 1-6 do plano
  corrigido, sem desvio: `settings.py` (app + `BLACKLIST_AFTER_ROTATION=True` + padrão 90), `core/tokens.py::CoreRefreshToken`
  (`for_user` via `super(BlacklistMixin, cls)`; `blacklist()` com `user=None`; `OutstandingToken.user` é
  `null=True, on_delete=SET_NULL`, conferido na lib), `views.py` (login, google_login, logout) e
  `CoreTokenRefreshSerializer` (`token_class` + `blacklist()` antes do `set_jti()`).
- Provas: `migrate` local aplica `token_blacklist` 0001-0013; `makemigrations --check --dry-run` → "No changes
  detected". `python manage.py test core.tests.test_refresh_session` → 5 OK (testes (a)-(e) do plano).
  Mutações (cada uma restaurada depois): login com `RefreshToken` da lib → 5 ERROR, com
  `ValueError: Cannot assign "<User: owner@example.com>": "OutstandingToken.user" must be a "User" instance.`;
  sem `refresh.blacklist()` no serializer → FAIL em (b) e (e); app fora do `INSTALLED_APPS` → (c) FAIL (logout 400)
  e (b)/(e) ERROR. `python manage.py test core.tests` → **244 OK** (239 + 5).
- Deploy: a migração roda sozinha (`Dockerfile` CMD e `Procfile` release fazem `migrate --noinput`).
- Efeito para quem já está logado: refresh emitido antes do deploy continua válido (não tem `OutstandingToken`, e
  o `blacklist()` cria o registro quando ele é usado). A primeira renovação já o põe na blacklist.
- **No ar (2026-10-30, OK do dono):** fast-forward da branch na `main`, `git push origin main` (`220b784..d19e073`,
  levou junto a SEC-05.1/05.2/06.1); deploy Railway `c3216220` SUCCESS. Aceite em produção
  (`https://iawrappernew-production.up.railway.app`, conta real com a credencial do `local.properties`; o
  `iawrapper.url` de lá aponta para servidor local, não para produção): login → 200; refresh → 200 com refresh novo;
  o mesmo refresh de novo → **401 `token_not_valid`**; logout com o refresh novo → 200; esse refresh →
  **401 `token_not_valid`**. **SEC-07.8 (refresh/blacklist) concluído.** Pendente fora do escopo: o `logout` não
  confere se o refresh é do `request.user` (risco baixo, registrado acima).
- **Achado fora do escopo (2026-10-30): o SPA `ia_wrapper_frontend` quebra com a rotação + blacklist.**
  `src/services/api.ts:46-52` (interceptor de 401) grava só `data.access` e mantém o refresh antigo no
  `localStorage`; o 2º refresh usa um token já na blacklist → 401 → `window.location.href = '/login'`. **Latente,
  não está no ar:** o Railway builda `ia_wrapper/Dockerfile` (sem frontend; o `Dockerfile` com o estágio do SPA fica
  em `d:\projects\iawrapper\`, fora do repositório), e `GET /` e `GET /login` em produção → 404. Correção, quando o
  SPA for usado: gravar também `data.refresh` quando vier.

##### SEC-05.3 (resto) + SEC-05.4 — troca de senha/e-mail derruba sessões; sem `SessionAuthentication` (análise, 2026-10-30)

Escolha do dono (2026-10-30) depois da SEC-07.8. `ia_wrapper` na `main` = `origin/main` = `d19e073`, limpo.

Símbolos abertos:
- `core/views.py::change_password` (l.264-321): confere a senha antiga, `set_password` + `save()`, devolve só
  mensagem. `change_user_profile` (l.324-389): confere a senha, troca `email` e/ou `name`, `save()`. Nenhum dos dois
  mexe em token. Fora das views, só `UserCreateSerializer` (`serializers.py:38`, cadastro) e `create_admin.py`
  gravam senha; `email` só muda em `change_user_profile`.
- `core/models.py::User`: sem campo de versão de token; última migração `0014_login_failure`.
- `core/authentication.py::CustomJWTAuthentication.get_user`: busca o `core.User` por `user_id` e confere
  `is_active`; nada mais. `CoreTokenRefreshSerializer.validate` (`serializers.py`) busca o usuário e confere
  `is_active`. Emissão de token: só `CoreRefreshToken.for_user` (login l.153, google_login l.218).
- simplejwt 5.5.1 `RefreshToken.access_token` (`tokens.py:393-410`) copia todos os claims do refresh para o access,
  menos `token_type/exp/jti/iat`: um claim posto no `for_user` chega aos dois.
- `SessionAuthentication` (`settings.py:97`): nenhum código ou teste depende dela (grep por `force_login`,
  `client.login(`, `SessionAuthentication`). O SPA usa `Authorization: Bearer` (`api.ts:34`). O Django admin
  usa o próprio middleware de sessão, não a autenticação do DRF.

Hipóteses descartadas:
- Revogar pela blacklist (pôr todos os refresh do usuário nela): o `CoreRefreshToken.for_user` não grava
  `OutstandingToken` (SEC-07.8), então não dá para listar os tokens de um usuário; e o access continuaria valendo
  até 60 min. `token_version` derruba access e refresh na hora.

Desenho:
1. `User.token_version = PositiveIntegerField(default=0)` + migração `0015`.
2. `CoreRefreshToken.for_user` grava o claim `token_version` (chega ao access pelo `access_token`).
3. `CustomJWTAuthentication.get_user` e `CoreTokenRefreshSerializer.validate`: claim (ausente = 0, tokens de antes
   do deploy) ≠ `user.token_version` → 401. Token antigo sem o claim vale até a primeira troca de senha/e-mail.
4. `change_password` e `change_user_profile` (só quando o e-mail muda de fato) somam 1 em `token_version` e
   devolvem `access` + `refresh` novos: as outras sessões caem, a atual continua (o SPA hoje ignora esses campos e
   cai no login no próximo 401, aceitável).
5. `settings.py`: tirar `SessionAuthentication` do `DEFAULT_AUTHENTICATION_CLASSES`.

Provas (`core/tests/test_token_version.py`): (a) troca de senha → access antigo em `/api/users/me/` → 401 e refresh
antigo → 401; os tokens devolvidos funcionam; (b) troca de e-mail → idem; (c) troca só do nome → tokens antigos
seguem 200; (d) token sem o claim (emitido à mão) → 200 com `token_version=0`; (e) com sessão do Django admin
(`auth.User` de mesmo id, `force_login`) e sem Bearer, `/api/users/me/` → 401. Mutações: tirar a checagem do
`get_user` → (a) access cai; tirar a do serializer → (a) refresh cai; não somar no `change_user_profile` → (b) cai;
`SessionAuthentication` de volta → (e) cai. Suíte inteira ≥ 244.

**Implementado (2026-10-30), commit `7082a78`** na branch `sec-05.3-token-version` (a partir de `d19e073`, sem
push). Desenho seguido sem desvio; o helper `views.py::_session_tokens` emite o par novo com os claims do login.
- Provas: `core.tests.test_token_version` → 5 OK. Mutações (restauradas): sem checagem no `get_user` → FAIL em
  (a), (b) e (d); sem checagem no serializer → FAIL em (a) e (b); sem somar no `change_user_profile` → FAIL em (b);
  `SessionAuthentication` de volta → FAIL em (e). `makemigrations --check` → sem mudanças; `migrate` aplica `0015`.
  `python manage.py test core.tests` → **249 OK** (244 + 5).
- Teste existente alterado: `test_users.py::test_change_password_success` refazia o login com o Bearer antigo
  (`client.credentials`) e passou a receber 401. O DRF autentica até em view `AllowAny`, então um Bearer revogado
  no `/api/auth/login/` dá 401. Era o mesmo antes com access vencido. O teste agora limpa as credenciais antes do
  novo login. O app Android não manda `Authorization` no login (`IawrapperBackend.kt:225-228`, conexão própria).
- **Em produção (2026-10-30, com OK do dono):** `git merge --ff-only sec-05.3-token-version` na `main` e
  `git push origin main` (`d19e073..7082a78`). Deploy `b78e1556` do `iawrappernew` → `SUCCESS`
  (`railway deployment list --service iawrappernew`).
- **Aceite em produção** (`https://iawrappernew-production.up.railway.app`, conta descartável; a conta de serviço do
  APK não foi tocada): script fora do repo, em Python/urllib, sem imprimir tokens nem senhas. Resultado **10/10 OK**:
  - `POST /api/users/` `sec053-accept-1793376787@example.invalid` → 201 (id 5);
  - login → 200; `users/me/` com o access → 200;
  - `auth/change-password/` → 200, com `access` + `refresh` na resposta;
  - access antigo em `users/me/` → **401**; refresh antigo em `auth/refresh/` → **401**;
  - access novo → 200; refresh novo → 200;
  - `DELETE /api/users/5/delete/` → 200; login depois → 401.
  - Resíduo: esse último login falho pode ter gravado uma linha em `login_failures` para o e-mail descartável
    (bloqueio temporário, sem conta). Não foi conferido no banco.
- Não testado em produção: a troca de e-mail (coberta pela prova (b) da suíte) e a ausência de
  `SessionAuthentication` (prova (e); a produção não tem uma sessão do admin com o mesmo id para testar sem risco).
- **SEC-05.3 e SEC-05.4 fechadas.** A SEC-13.2 (abaixo) entra sobre esta: a migração dela é a `0016` e o claim
  `app` se soma ao `token_version` no `for_user`.

##### SEC-13.2 — cadastro por app (desenho, 2026-10-30, nada editado)

Sessão própria pedida em "A confirmar". `ia_wrapper` na `main` = `d19e073`, limpo. A SEC-05.3 acima (desenhada, sem
código) mexe nos mesmos pontos (`for_user`, `get_user`, refresh): quem entrar segundo ajusta a migração (`0015`/`0016`)
e soma o seu claim ao do outro.

**Decisões do dono (2026-10-30):**
- Cadastro ligado a um app: outro app = outro cadastro, mesmo com o mesmo e-mail (Google ou senha). O custo em créditos
  por feature segue global.
- A única conta de hub (válida em todos os apps) é a `admin@test.com`.
- O SPA `ia_wrapper_frontend` vira **console do hub**: só contas de hub entram e não há cadastro público.

**Dados de produção** (Postgres do Railway, só leitura; a receita está em "Acesso ao Postgres de produção" abaixo):
- `select count(*), count(*) filter (where app_client_id is not null), count(*) filter (where is_admin) from users` →
  **2, 0, 1**. São eles:
  - id 1, `admin@test.com`, admin, 70 créditos;
  - id 3, `teste-a600ce6f@example.com`, não admin, 32 créditos (usuário descartável da verificação da Fase 1, usado
    pelo app).
- `select lower(email), count(*) from users group by 1 having count(*) > 1` → vazio: a restrição nova cabe sem
  limpeza.
- `app_clients` vazia. `tasks` 40, nenhuma com `app_client_id`. `login_failures` 2 linhas.
- O serviço `iawrappernew` tem `DATABASE_URL` (`railway variables --service iawrappernew --json`), o que fecha o
  SEC-04.6: a produção roda em Postgres.

**Símbolos abertos:**
- `core/models.py`:
  - `User.email` (l.22) tem `unique=True` global e diferencia maiúsculas.
  - `User.app_client` (l.33) é FK com `on_delete=SET_NULL` e nunca é gravado. Apagar um `AppClient` transformaria os
    usuários dele em contas de hub.
  - `AppClient.api_key` (l.9) é `unique`, não nula, em texto puro, e nada a lê.
  - `Task.app_client` (l.238) nunca é gravado.
  - `LoginFailure.email` (l.476) é `unique`.
- `core/serializers.py`:
  - `UserCreateSerializer` (ModelSerializer) herda o `UniqueValidator` do `unique=True` do campo. Sem o `unique`, o
    e-mail repetido vira `IntegrityError` (500), a não ser que a checagem seja reescrita.
  - `ChangeEmailAndNameSerializer.validate_new_email` (l.59-70) checa `User.objects.filter(email=...)` no banco inteiro.
  - `CoreTokenRefreshSerializer.validate` (l.103) busca o usuário por id e só confere `is_active`.
- `core/views.py`:
  - `login` (l.97-162) chama o lockout pelo e-mail antes de buscar a conta e faz `User.objects.get(email=email)`.
  - `google_login` (l.166-232) faz `get_or_create(email=email)` com um único `GOOGLE_OAUTH_CLIENT_ID`.
  - `create_user` (l.15) é aberto.
- `core/authentication.py::CustomJWTAuthentication.get_user`: busca por `user_id` e confere `is_active`; não olha
  nenhum claim de app.
- `core/login_lockout.py`: chave = e-mail normalizado. `_exempt` usa `LOGIN_LOCKOUT_EXEMPT_EMAILS`, uma lista só de
  e-mails.
- `core/revenuecat_views.py:59`: busca o usuário por e-mail, o que fica ambíguo; o SEC-03.2 já previa usar o id.
- Clientes do login:
  - o SPA (`api.ts:49` refresh, `:74` login, página `/register`);
  - o app ([IawrapperBackend.kt:225](../../ai/remote-http/src/main/kotlin/com/productphoto/ai/remotehttp/image/IawrapperBackend.kt#L225));
  - o E2E ([IawrapperEndToEndInstrumentedTest.kt:189](../../app/src/androidTest/kotlin/com/productphoto/app/IawrapperEndToEndInstrumentedTest.kt#L189)).
- simplejwt 5.5.1 `backends.py::TokenBackend` e PyJWT 2.13 `api_jwt.py::_validate_aud`, lidos do site-packages:
  - `decode` passa `verify_aud = self.audience is not None`. Sem `AUDIENCE` no `SIMPLE_JWT`, nenhum `aud` é
    conferido.
  - `encode` (l.134-135) sobrescreve o `aud` do payload quando `AUDIENCE` está configurado.
  - Conclusão: o app vai num claim próprio (`app`), conferido pelo nosso código.

**Hipóteses descartadas:**
- *Usar `aud` para o app*: a lib não confere o `aud` sem `AUDIENCE` e o sobrescreve com `AUDIENCE`. Além disso, `aud`
  é o destinatário (o hub), não o cliente.
- *Identidade global com uma carteira por app*: contraria a decisão do dono. Com cadastros separados, a exclusão de
  conta também fica por app, como a Play exige.
- *`unique (lower(email), app_client)` sozinho*: no Postgres dois NULLs não colidem, então seriam possíveis duas contas
  de hub com o mesmo e-mail. É preciso uma segunda restrição condicional para `app_client IS NULL`.
- *Exigir Play Integrity neste passo*: hoje o `app_id` só separa dados; declarar outro app não dá nada de graça. O Play
  Integrity tem de entrar **antes dos créditos de cortesia por app**, que serão o alvo de abuso.
- *Hipótese a confirmar, não usada no desenho*: no Credential Manager, o `azp` do ID token do Google seria o client
  Android (pacote + SHA-1) e poderia amarrar o app antes do Play Integrity.

**Desenho:**
1. **Modelo** (migração `0015` ou `0016`):
   - `User.email` perde o `unique=True` e ganha duas restrições:
     - `UniqueConstraint(Lower('email'), 'app_client')`;
     - `UniqueConstraint(Lower('email'), condition=Q(app_client__isnull=True))`.
   - `User.app_client` passa a `PROTECT`.
   - `AppClient.api_key` passa a `null=True`. Ela vira hash + prefixo só quando existir um cliente servidor↔servidor.
   - `AppClient.hub_only = BooleanField(default=False)`.
   - `LoginFailure` ganha FK `app_client` e `unique (app_client, email)`; as 2 linhas atuais são apagadas (bloqueios
     temporários).
2. **Dados** (na mesma migração):
   - cria os `AppClient` `product-photo` e `hub-console` (`hub_only=True`);
   - usuários com `is_admin=True` ficam com `app_client` NULL, como contas de hub (hoje só o id 1);
   - os demais vão para `product-photo` (hoje o id 3).
3. **Identificação do app:** o header `X-App-Id: <slug>` é obrigatório em `POST users/`, `auth/login/` e
   `auth/google/`. Sem o header: 400 `app_id_required`. Slug desconhecido ou inativo: 403. Um helper resolve o app nos
   três pontos.
4. **Busca da conta:** conta do app com aquele e-mail (`email__iexact`); se não houver, a conta de hub com o mesmo
   e-mail.
   - Em app `hub_only`, só conta de hub; cadastro e criação pelo Google → 403.
   - Cadastro num app com e-mail de conta de hub → o mesmo 400 de "já em uso".
   - Google: busca do mesmo jeito e cria no app pedido. Numa corrida de criação, o `IntegrityError` faz buscar de
     novo.
   - E-mail gravado em minúsculas.
5. **Token:** `for_user` grava o claim `app` (slug) com o app pelo qual a pessoa entrou. `get_user` e o refresh
   recusam com 401 nestes casos:
   - token sem `app`: os tokens de antes do deploy caem, e o SPA e o app logam de novo;
   - app inativo: é o kill-switch por app do SEC-13.4;
   - `user.app_client` diferente de NULL e diferente do app do token.
   
   As views leem o app em `request.auth['app']`, não em `user.app_client`.
6. **Lockout:**
   - a chave passa a ser `(app, e-mail)`;
   - a isenção vira uma lista `slug:email` (ex.: `product-photo:admin@test.com`);
   - a conta de hub ganha N tentativas por app, o que é aceitável.
7. **Resto:**
   - `validate_new_email` checa só no app da conta (hub: só entre contas de hub; app: no app e entre contas de hub);
   - `POST tasks/` grava `Task.app_client` a partir do token;
   - `list_users` devolve o slug do app;
   - o webhook usa o id (SEC-03.2).
8. **Clientes:**
   - o app envia `X-App-Id: product-photo` (valor no `BuildConfig`), no `IawrapperBackend` e no E2E;
   - o SPA envia `X-App-Id: hub-console` no login e perde a página `/register`.

**Tasks e provas** (`core/tests/test_app_accounts.py`; a suíte inteira tem de continuar verde):
1. Modelo + migração:
   - o mesmo e-mail em dois apps cria duas contas;
   - `A@x` e `a@x` no mesmo app → `IntegrityError`;
   - duas contas de hub com o mesmo e-mail → `IntegrityError`;
   - a migração de dados num banco com 1 admin e 1 comum leva cada um ao lugar certo;
   - `makemigrations --check` limpo.
2. Header:
   - sem header → 400;
   - slug inexistente → 403;
   - app inativo → 403.
3. Cadastro, login e Google:
   - login no app B com a conta do app A → 401;
   - a conta de hub entra em `product-photo` e em `hub-console`;
   - a conta do app → 401 no `hub-console`;
   - cadastro no `hub-console` → 403;
   - cadastro com e-mail de conta de hub → 400;
   - Google com o mesmo e-mail em dois apps → duas contas, e `created=true` na segunda (`verify_oauth2_token`
     mockado).
4. Token:
   - token sem `app` → 401 em `users/me/` e no refresh;
   - app desativado → 401 com token válido;
   - token de conta de app com o `app` de outro app (emitido à mão) → 401.
5. Lockout: falhas em `(A, e)` não bloqueiam `(B, e)`; `slug:email` isenta só naquele app.
6. Resto: troca de e-mail para um e-mail usado em outro app → 200, e no mesmo app → 400; a task criada grava o
   `app_client` do token.
7. App:
   - teste em `IawrapperBackendTest` conferindo o header no `/api/auth/login/`;
   - E2E no moto `ZY32LMNN9B` gerando com `X-App-Id`.

   SPA: o login do console com `admin@test.com`.

**Mutações:**
- tirar o filtro de app do `login` → (3) cai;
- tirar a checagem de app do `get_user` → (4) cai;
- voltar a chave do lockout para só e-mail → (5) cai.

**Fora deste passo:**
- Play Integrity (antes dos créditos de cortesia);
- catálogo de features por app;
- papéis do SEC-13.3;
- orçamento em USD por app;
- audiences do Google por app (só se um app ficar noutro projeto do GCP).

**Implementação das tasks 1–6 (2026-10-30) — registro antes da primeira edição:**
- Branch `sec-13.2-app-accounts` no `ia_wrapper`, criado **em cima de `sec-05.3-token-version` (`7082a78`)**, que
  ainda não foi mergeado na `main`. A migração é a `0016` (depende da `0015_user_token_version`) e o claim `app` soma
  com o `token_version`. Mergear o SEC-05.3 antes deste.
- Suíte base: `python manage.py test core.tests` (não `core`: o `core/tests.py` colide com o pacote `core/tests/`) →
  **249 testes, OK**, em SQLite local.
- Símbolos abertos além do desenho:
  - `core/tokens.py::CoreRefreshToken.for_user` grava `token_version`; o `access_token` da lib copia os claims do
    refresh, então o `app` gravado no refresh chega ao access.
  - `core/views.py::_session_tokens` (troca de senha/e-mail) emite tokens novos: precisa do app do token atual.
  - `core/services/task_service.py::TaskService.create_task` cria a `Task` dentro de `@transaction.atomic`; o único
    chamador é `task_views.task_list_create`.
  - `force_authenticate` nos testes deixa `request.auth = None`: quem lê o app do token tem de aceitar `None`.
  - Os testes existentes logam por `/api/auth/login/` sem header e criam usuários sem `app_client` (contas de hub
    pelo desenho): basta mandar `X-App-Id: product-photo`. Há `TransactionTestCase` na suíte, que apaga os
    `AppClient` criados pela migração: os testes novos fazem `get_or_create` dos apps.
- Decisões de implementação:
  - Na `0016`, primeiro apagar `login_failures` (sem FK, não gera trigger), depois as operações de esquema, e só no
    fim o `RunPython` de dados. No Postgres, ALTER TABLE depois de UPDATE em coluna FK na mesma transação dá
    `pending trigger events`; com os dados por último, nada vem depois.
  - `LOGIN_LOCKOUT_EXEMPT_EMAILS` vira `LOGIN_LOCKOUT_EXEMPT_ACCOUNTS` (`slug:email`). **No deploy, trocar a
    variável no Railway**; o nome antigo deixa de ser lido.
  - O webhook RevenueCat fica fora: a rota está desligada (SEC-03.1) e a troca para o id é do SEC-03.2.
- Tasks (arquivo → prova em `core/tests/test_app_accounts.py`):
  1. `models.py` + `0016` → contas por app, `IntegrityError` em caixa/hub, migração de dados, `makemigrations
     --check`;
  2. `core/app_clients.py` (helper do header) + `views.create_user/login/google_login` → 400/403/403;
  3. `app_clients.find_account` nas três views → as seis provas da task 3;
  4. `tokens.py` (claim `app`, `token_app_matches`) + `authentication.get_user` + `CoreTokenRefreshSerializer` → 401;
  5. `login_lockout.py` com chave `(app, e-mail)` → isolamento e isenção por app;
  6. `validate_new_email`, `TaskService.create_task(app_client=)`, `UserSerializer.app` → e-mail e task.

**Resultado das tasks 1–6 (2026-10-30, commit `01caca9` no branch `sec-13.2-app-accounts`, sem push):**
- Arquivos: `core/models.py`, `core/migrations/0016_app_accounts.py`, `core/app_clients.py` (novo: header,
  `find_account`, `email_in_use`, `request_app`), `core/tokens.py` (`APP_CLAIM`, `token_app_matches`,
  `for_user(user, app)`), `core/authentication.py`, `core/serializers.py`, `core/views.py`, `core/login_lockout.py`,
  `core/services/task_service.py`, `core/task_views.py`, `ia_wrapper/settings.py`.
- Provas: `python manage.py test core.tests.test_app_accounts` → 26 testes, OK. Suíte inteira
  `python manage.py test core.tests` → **275, OK**. Os testes antigos só ganharam `X-App-Id: product-photo` no
  `APIClient`, a isenção nova no `test_login_lockout` e o app no `for_user` do `test_token_version`.
  `makemigrations --check` limpo (também dentro da suíte).
- Mutações (arquivo restaurado depois de cada uma): login com `User.objects.filter(email__iexact=...)` → 2 falhas em
  `AccountLookupTests`; `get_user` sem `token_app_matches` → 3 falhas em `AppTokenTests`; lockout só por e-mail → 2
  falhas em `AppLockoutTests`.
- Também feito: e-mail em minúsculas no cadastro, no Google e na troca; `list_users` e o login devolvem `app` (slug,
  `null` = hub); o refresh rotacionado mantém o claim `app`.
- **Não provado:** a `0016` no Postgres. Rodou só em SQLite (não há Postgres local). A ordem anti `pending trigger
  events` é por leitura; testar num Postgres descartável antes do deploy.
- **Antes do deploy (bloqueante):**
  - o backend recusa login sem `X-App-Id` (400): o app e o SPA atuais param de logar. Subir junto com a task 7 (app e
    SPA mandando o header) ou com o APK novo já publicado;
  - no Railway, criar `LOGIN_LOCKOUT_EXEMPT_ACCOUNTS=product-photo:<e-mail da conta de serviço>`; o
    `LOGIN_LOCKOUT_EXEMPT_EMAILS` deixa de ser lido;
  - mergear o `sec-05.3-token-version` antes deste branch.
- Fica para depois: task 7 (app, E2E, SPA); webhook por id (SEC-03.2, rota desligada).

**Task 7 (2026-10-30) — registro antes da primeira edição:**
- Estado do git no `ia_wrapper`: o `01caca9` está na **`main` local** (1 à frente de `origin/main`), não no branch
  `sec-13.2-app-accounts`, que aponta para `7082a78`. A `origin/main` já é `7082a78` (SEC-05.3 empurrado). O
  `01caca9` segue sem push.
- Símbolos abertos:
  - `IawrapperBackend.resolveAuthHeader` (l.208-247): o login é um `HttpURLConnection` próprio, fora do `Http`; só
    ele precisa do header. As demais chamadas usam o Bearer e o servidor lê o app do claim. Num 401 com
    `cachedToken`, o `dispatchAndAwait` loga de novo: os tokens antigos, sem `app`, se renovam sozinhos após o deploy.
  - `IawrapperOptions` não tem app. Quem constrói o backend: `IawrapperImageFactory.create` (opções vindas de
    `options(settings)`) e o `AppGraph` (`relighter` e `adFormatExpander`, l.153 e l.165, sem opções).
  - `ImageGenScreen.kt::cloudImageChain` monta as settings da cadeia a partir do `BuildConfig`. O
    `useCloudServer` regrava a cadeia quando ela muda, então a chave nova entra sozinha no `provider_config.json` já
    gravado.
  - `FakeHttpServer` grava os headers em minúsculas (`x-app-id`).
  - E2E `obtainJwtToken`: sem o header, o servidor novo dá 400 e o teste cai em `email:senha`, que também passa
    pelo login do backend.
  - SPA `ia_wrapper_frontend` (`main`, limpo):
    - `api.ts` com a instância `api` (login l.74, cadastro l.76) e o refresh por `axios.post` cru (l.49), que não
      precisa do header;
    - o cadastro aparece em `App.tsx:41` (rota), `pages/auth/Register.tsx`, `Navbar.tsx:121` e `Login.tsx:65`
      ("Sign up"), em `AuthContext.register` e no tipo `RegisterCredentials`;
    - não há login Google no SPA, nem teste: a prova é `npm run build` (`tsc -b`) e `npm run lint`.
- **Achado fora do desenho:** `settings.py::CORS_ALLOW_HEADERS` (l.278) é uma lista fechada, sem `x-app-id`. Em
  produção o SPA é servido na mesma origem (`WHITENOISE_ROOT = frontend_dist`), então não há preflight. No dev
  (`localhost:5173` → `:8000`) o preflight barraria o login do console. Entra `'x-app-id'` na lista, com teste.
- O que fazer:
  1. `IawrapperOptions.appId` (nulo = sem header) e `IawrapperBackend.APP_HEADER`. O login manda o header →
     teste no `IawrapperBackendTest` conferindo `x-app-id` no `/api/auth/login/`.
  2. `IawrapperImageFactory.APP_ID` lido em `options(settings)`, e `BuildConfig.IAWRAPPER_APP_ID` (padrão
     `product-photo`, `-Piawrapper.app_id`) em `cloudImageChain` e no `AppGraph` → `ImageGenConfigTest` e
     `ImageFactoriesTest`.
  3. E2E: `obtainJwtToken` com o header → `connectedDebugAndroidTest` só do
     `generateProductPhotoRemotelyViaIawrapper` no `ZY32LMNN9B`, se o aparelho estiver conectado. Antes do deploy a
     produção ignora o header, então isso só prova que nada quebrou. A prova real é rodar de novo depois do deploy.
  4. SPA: `X-App-Id: hub-console` na instância `api`; tirar o cadastro (rota, página, links, `register`, tipo) →
     `npm run build` e `npm run lint`.
  5. Backend: `'x-app-id'` em `CORS_ALLOW_HEADERS` → teste de preflight em `test_app_accounts.py`; suíte inteira.
  6. Login do console com `admin@test.com` contra o backend local (SQLite descartável, branch com a `0016`):
     `hub-console` → 200, sem header → 400.

**Resultado da task 7 (2026-10-30, nada commitado nos três repositórios):**
- App (`product_photo_offline`):
  - `IawrapperOptions.appId` e `IawrapperBackend.APP_HEADER`: o login manda `X-App-Id` quando há app;
  - `IawrapperImageFactory.APP_ID` (`appId`) é lido em `options(settings)`;
  - `BuildConfig.IAWRAPPER_APP_ID` (padrão `product-photo`, `-Piawrapper.app_id` / `IAWRAPPER_APP_ID` /
    `local.properties`) vai para `cloudImageChain` e para os dois `IawrapperBackend` do `AppGraph`;
  - E2E: `obtainJwtToken` manda o header.
  - Atenção: `IawrapperBackend.kt`, `IawrapperBackendTest.kt` e o E2E ainda estão **untracked** neste repositório
    (a integração com o iawrapper nunca foi commitada). Um commit da task 7 leva esses arquivos inteiros.
- Provas do app:
  - `gradlew :ai:remote-http:testDebugUnitTest :app:testDebugUnitTest` → 57 testes, 0 falhas. Teste novo
    `login sends the X-App-Id of the options and no header without one`, mais `iawrapper app id comes from the
    settings` e `APP_ID` no `cloud chain is a fixed iawrapper entry`.
  - Mutação: tirar a linha do `setRequestProperty(APP_HEADER, …)` → 1 falha em `IawrapperBackendTest` (arquivo
    restaurado).
  - E2E `generateProductPhotoRemotelyViaIawrapper` no `ZY32LMNN9B` contra a produção → 1/1 OK, 10,7 s, PNG de 210 KB.
    A produção ainda não tem a `0016` e ignora o header: isso só prova que nada quebrou. **Rodar de novo depois do
    deploy.**
- SPA (`ia_wrapper_frontend`):
  - `X-App-Id: hub-console` fixo na instância `api` de `api.ts`;
  - cadastro removido: rota `/register`, `pages/auth/Register.tsx` (`git rm`), botão no `Navbar`, "Sign up" no
    `Login`, `AuthContext.register`, `auth.register`, `RegisterCredentials`;
  - `npm run build` → OK, e `git grep -i register -- src` → vazio;
  - `eslint` nos 6 arquivos tocados → 2 erros que **já existiam** (`AuthContext.tsx` exporta `useAuth` junto do
    provider; `catch (err: any)` no `Login`).
- Backend (`ia_wrapper`, em cima do `01caca9` na `main` local):
  - `'x-app-id'` em `CORS_ALLOW_HEADERS`;
  - teste `AppHeaderTests.test_cors_preflight_allows_the_header`. Mutação (tirar da lista) → o teste cai;
  - `python manage.py test core.tests` → **276, OK**.
- Login do console com `admin@test.com`: backend local, `runserver` com settings descartáveis no scratchpad (SQLite
  fora do repo, `migrate` + `createcachetable`), requisições com `Origin: http://localhost:5173`:
  - preflight → 200, `x-app-id` liberado;
  - `hub-console` → 200, e o claim `app` do token é `hub-console`;
  - sem header → 400 `app_id_required`;
  - conta do `product-photo` no `hub-console` → 401;
  - cadastro no `hub-console` → 403 `registration_closed`.
  
  Não testado num navegador de verdade: o header do SPA é uma constante na instância `axios`, coberta só pelo build.
- Pegadinha de banco local: o throttle (SEC-07.6) usa `DatabaseCache`, então um banco novo precisa de
  `createcachetable`. Sem ela, todo login dá 500 `no such table: django_cache`. O deploy já roda o comando
  (`ia_wrapper/Dockerfile` CMD e `Procfile`).
- **Deploy, na ordem:**
  1. commitar o app e gerar o APK com o header;
  2. commitar o SPA. O `Dockerfile` da raiz compila o frontend num estágio próprio e copia para `frontend_dist`,
     então o código novo entra na mesma imagem do backend;
  3. acertar o branch do `ia_wrapper` (o `01caca9` está na `main` local);
  4. testar a `0016` num Postgres descartável;
  5. criar `LOGIN_LOCKOUT_EXEMPT_ACCOUNTS` no Railway;
  6. deploy do backend;
  7. rodar o E2E de novo no moto.

**Deploy da SEC-13.2 (2026-10-30) — registro antes de executar (corrige a ordem acima):**
- Railway (`railway status` e `railway deployment list --service <s> --json` em `D:\projects\iawrapper`): são **dois
  serviços**, cada um com deploy automático no push da `main` do seu repositório no GitHub:
  - `iawrappernew` ← `luistiagos/iawrappernew` (= `ia_wrapper/`), `configFile: /railway.json` → `ia_wrapper/Dockerfile`,
    cujo CMD roda `migrate`, `createcachetable` e `seed_features`. Último deploy: `7082a78`, SUCCESS;
  - `iawrappernew_frontend` ← `luistiagos/iawrappernew_frontend` (= `ia_wrapper_frontend/`). Último deploy: `0df998e`.
  - O `Dockerfile` da raiz de `D:\projects\iawrapper` (que não é repositório git) **não é usado** pelo Railway. A
    premissa do passo 2 ("o SPA entra na mesma imagem do backend") está errada.
- Consequência: o SPA roda em outra origem (`VITE_API_URL` = `https://iawrappernew-production.up.railway.app/api`;
  `CORS_ALLOWED_ORIGINS` = a origem do frontend). O preflight do `x-app-id` vale **em produção**, não só no dev; o
  `'x-app-id'` no `CORS_ALLOW_HEADERS` da task 7 é obrigatório. Ordem: push do backend, esperar o deploy SUCCESS, e
  só então push do SPA (SPA novo com backend velho: preflight barra o login; o contrário dá 400 até o SPA subir).
- Lockout: no Railway `LOGIN_LOCKOUT_EXEMPT_EMAILS` está **vazia** (decisão do dono de 2026-10-29: não isentar
  agora) e a credencial do APK é o `admin@test.com`, conta admin. Criar `LOGIN_LOCKOUT_EXEMPT_ACCOUNTS` agora tiraria
  um admin do bloqueio de força bruta. **Passo 5 não executado**: a variável nova fica vazia, como a antiga (o
  estado atual se mantém).
- `local.properties` tem `iawrapper.url=http://127.0.0.1:8000`: o APK sai com `-Piawrapper.url=<produção>`.
- APKs antigos (sem header) recebem 400 no login depois do deploy; só o APK novo loga.
- Decisões do dono nesta sessão: app commitado por área (iawrapper+anúncios+task 7; editor/conteúdo; docs), sem os
  vazios `core/task_views.py` e `core/throttling.py`, sem `docs/backlog.md` e os PNG `e2e_motorola_*`; a `0016` testada
  numa cópia da produção (`pg_dump` só leitura) restaurada em Postgres portátil no scratchpad, apagado no fim.

**Resultado do deploy (2026-10-30):**
1. App: commits `f44681a` (iawrapper + anúncios + formatos + task 7), `68ef4c2` (editor/conteúdo), `e1f230c` (docs),
   sem push. O E2E `IawrapperEndToEndInstrumentedTest.kt` **ficou fora** e segue untracked: tem a senha do
   `admin@test.com` literal 3× (achado 1 da tabela de segurança); commitar só depois de passar a credencial por
   argumento de instrumentação. `gradlew :ai:remote-http:testDebugUnitTest :app:testDebugUnitTest :app:assembleDebug
   -Piawrapper.url=https://iawrappernew-production.up.railway.app` → 57 testes, 0 falhas; `app-debug.apk` com
   `IAWRAPPER_URL` de produção e `IAWRAPPER_APP_ID = product-photo` (conferido no `BuildConfig.java` gerado).
2. SPA: commit `6f70a4c`, push `0df998e..6f70a4c` depois do backend; Railway SUCCESS; o bundle publicado contém
   `hub-console`.
3. Backend: CORS commitado como `6eca25f` em cima do `01caca9` na `main`; `sec-13.2-app-accounts` movido para a
   `main`. `python manage.py test core.tests` → 276, OK. Push `7082a78..6eca25f`; Railway SUCCESS.
4. `0016` na cópia (PG 18.6 portátil, binários da EDB; prod é 18.6): `migrate` OK. Antes: 2 usuários (1 admin), sem
   app, 3 `login_failures`. Depois: admin com `app_client` NULL (hub), o outro `product-photo`; `app_clients` =
   `product-photo` e `hub-console` (`hub_only`); `login_failures` = 0; `uniq_hub_user_email`,
   `uniq_user_email_per_app` e `uniq_login_failure_app_email` criadas. Em produção, depois do deploy, o mesmo estado.
   Pegadinha: `pg_ctl start` com a saída capturada por pipe (`subprocess` com `capture_output`) trava no Windows;
   iniciar com `</dev/null >arquivo`.
5. `LOGIN_LOCKOUT_EXEMPT_ACCOUNTS`: não criada (ver registro acima).
6. Conferido em produção: login sem `X-App-Id` → 400; preflight da origem do console com `x-app-id` → 200 e header
   liberado; credencial do `local.properties` com `product-photo` → 200, claim `app=product-photo`; com
   `hub-console` → 200, claim `app=hub-console`; app inexistente → 403 `app_not_allowed`.
7. E2E `generateProductPhotoRemotelyViaIawrapper` no moto (`ZY32LMNN9B`), depois do deploy, contra a produção
   (`connectedDebugAndroidTest` com `-Pandroid.testInstrumentationRunnerArguments.class=...#generate...`) → 1/1 OK,
   11,7 s; task `queued` → `processing` → PNG de 215 KB, 10,4 s de ponta a ponta. Com a produção exigindo o header,
   isso prova o login do app com `X-App-Id`. **SEC-13.2 em produção.** Não testado: o login do console num
   navegador de verdade.

##### Ajustes pequenos de backend e SPA: refresh do SPA, `logout`, `UserSerializer` (passagem de bastão, 2026-10-30)

Escolha do dono (2026-10-30), item 3 da lista do que já dá para adiantar. Nada editado.

**Bloqueio:** este trabalho mexe no `core/views.py` e no `src/services/api.ts`, que a SEC-13.2 está alterando. Hoje o
`01caca9` está na `main` local, o `origin/main` está em `7082a78`, e há alterações sem commit no `ia_wrapper`
(`core/tests/test_app_accounts.py`, `ia_wrapper/settings.py`) e no SPA (7 arquivos, `Register.tsx` apagado). **Só
começar com a SEC-13.2 commitada e o `git status` limpo nos dois repositórios.** Abrir de novo cada símbolo antes de
editar, porque as linhas abaixo são de antes do fim da SEC-13.2.

Símbolos abertos (2026-10-30, árvore com a SEC-13.2 em andamento):
- `ia_wrapper_frontend/src/services/api.ts`, interceptor de resposta (l.~43-66): num 401, faz
  `axios.post(.../auth/refresh/, { refresh })` e grava só `data.access`. Com `ROTATE_REFRESH_TOKENS` +
  `BLACKLIST_AFTER_ROTATION` (`settings.py:136-138`), o refresh antigo vai para a blacklist e o 2º refresh dá 401, o
  que manda para `/login`. Esse `axios.post` cru não leva o `X-App-Id`, e o refresh não precisa dele (a SEC-13.2 só o
  exige em `users/`, `auth/login/` e `auth/google/`). Conferir isso no código final da SEC-13.2.
- `core/views.py::logout` (l.268-291): `CoreRefreshToken(refresh).blacklist()` sem conferir se `token['user_id']` é o
  `request.user.id`. Quem tem o refresh de outro usuário consegue derrubá-lo. Em erro: `except Exception` → 400
  `{'error': str(e)}`, o que vaza a mensagem da lib (SEC-06.3).
- `core/serializers.py::UserSerializer` (l.89-99): `read_only_fields = ['id', 'credits_balance', 'created_at']`;
  `email` e `is_admin` são graváveis (o `app` é `read_only`). Hoje nenhum call-site faz escrita com ele: todos os 7
  usos em `views.py` são de leitura (`UserSerializer(user)` / `.data`). O risco é latente (SEC-06.4).

Tasks e provas:
1. **SPA grava o refresh rotacionado.** `api.ts`: depois do refresh, `if (data.refresh) localStorage.setItem('refresh_token', data.refresh)`.
   Prova: o SPA não tem teste unitário (conferir se hoje há `vitest`; se não, `npm run build` + `eslint` no arquivo,
   e um teste à mão no backend local: login → apagar o access → 2 chamadas seguidas que pedem refresh → as duas
   200). Registrar se ficar só no build.
2. **`logout` só do próprio refresh.** Se `token['user_id'] != request.user.id` → 400, sem blacklist. Erro com
   mensagem fixa (`'invalid_refresh'`), sem `str(e)`. Provas novas em `core/tests/`: logout com o refresh de outro
   usuário → 400 e esse refresh continua → 200 no `auth/refresh/`; logout com o próprio → 200 e o refresh → 401;
   refresh inválido → 400 sem o texto da lib. Mutação: tirar a checagem → o 1º teste cai.
3. **`UserSerializer` só leitura.** `read_only_fields` com `email`, `is_admin` e `name` também (a troca de nome e e-mail
   é pelo `ChangeEmailAndNameSerializer`). Prova: um teste que passa `data={'is_admin': True, 'email': ...}` ao
   `UserSerializer(user, data=..., partial=True)` e, depois do `save()`, os dois continuam iguais. Mutação: tirar
   `is_admin` da lista → cai.
4. `python manage.py test core.tests` inteiro, pelo menos no número da SEC-13.2 + os novos. Commit, push e aceite em
   produção só com OK do dono. Aceite com conta descartável: logout com o refresh de outra conta descartável → 400.

Frase de abertura da sessão: *"Leia em docs/backlog/README.md a seção 'Ajustes pequenos de backend e SPA' e
implemente, se a SEC-13.2 já estiver commitada."*

##### App: catálogo remoto, TLS, `dataExtractionRules`, trava de release (SEC-08 a SEC-11, passagem de bastão, 2026-10-30)

Escolha do dono (2026-10-30), item 4 da lista do que já dá para adiantar. Nada editado.
**Estado (2026-10-30, 2ª sessão):** a árvore ainda estava suja (28 modificados, ~40 novos). O dono escolheu
**esperar a SEC-13.2 commitar o app** antes de implementar. Nada de código foi tocado.

**Bloqueio:** a árvore do `product_photo_offline` tem muitas alterações sem commit, misturando várias frentes:
`MockupLibrary.kt`, `MockupScreen.kt`, `ProductFlow*`, `Http.kt`, `IawrapperBackend.kt` (novo), `app/build.gradle.kts`
(com o `IAWRAPPER_APP_ID` da SEC-13.2), assets e editor-web. **Começar commitando o que está pendente, por assunto e
com o OK do dono, ou esperar a SEC-13.2 commitar o app** (passo 1 do "Deploy, na ordem" acima). Sem isso, os
commits desta task levam junto código alheio.

Símbolos abertos (2026-10-30):
- `feature/mockup/.../MockupLibrary.kt`:
  - `thumb(e)` (l.~197-223) e `template(e)` (l.~226-260) gravam em `File(localDir, e.thumb)` / `File(localDir, e.file)`,
    com `e.file` e `e.thumb` vindos do JSON remoto sem validação. **Um `../` grava fora da pasta: o risco é real.**
  - `resolveRemoteUrl(path, baseUrl)` (l.114-128): um `path` que começa com `http://` ou `https://` é usado como URL,
    para qualquer host. A base padrão é o HF; `parseVideoreyMockups` usa `https://fa.videorey.in/...`.
  - `downloadBytes` (companion, l.~304-310): `HttpURLConnection`, timeouts de 12 e 15 s, `instanceFollowRedirects = true`,
    `readBytes()` sem limite de tamanho. Em erro, propaga; `thumb` engole com `runCatching` e devolve o fallback;
    `template` propaga.
- `feature/product/.../SceneLibrary.kt`:
  - `parseStylesJson` (l.~113-137): o `id` é `style_<[a-z0-9_]>_<idx>`, **já sanitizado**, e o arquivo é
    `File(localDir, "${e.id}.webp")`. O `../` do SEC-11 **não vale aqui** (o backlog citava `SceneLibrary.kt:160`).
  - O `p.url` do JSON vira `remoteUrl` para qualquer host e esquema.
  - `downloadBytes` (l.~185-191): mesma cópia do da `MockupLibrary`, sem limite.
- `app/src/main/res/xml/network_security_config.xml`: só `<base-config cleartextTrafficPermitted="true" />`, porque o
  usuário configura servidores locais `http://` (Ollama, LM Studio, A1111; ARQUITETURA §18.5).
- `app/src/main/AndroidManifest.xml:14-15`: `allowBackup="false"` e `networkSecurityConfig`. **Sem
  `dataExtractionRules`**: no Android 12+, o `allowBackup=false` não cobre a transferência D2D. `targetSdk = 35`.
- `app/build.gradle.kts`:
  - `iawrapper(key, default)` (l.15-19) lê de gradle property, env `IAWRAPPER_*` e `local.properties`;
  - `IAWRAPPER_CREDENTIAL` (l.~34) entra no `BuildConfig` de todo build;
  - `release` (l.~43-47): `isMinifyEnabled = false` e `signingConfig = debug`.
- Testes existentes: `feature/mockup/src/test/.../MockupTest.kt` e `feature/product/src/test/.../MaskViewportTest.kt`.

Hipótese descartada:
- *Allowlist de cleartext só para IPs privados pelo `network_security_config`*: o `domain-config` aceita nome de
  domínio (e IP literal), não faixa CIDR, e o IP do servidor do usuário não é conhecido no build. Desenho: o
  `base-config` continua permitindo cleartext, e entra um `domain-config cleartextTrafficPermitted="false"` com
  `includeSubdomains` para `huggingface.co`, `hf.co`, `up.railway.app` e os CDNs que o catálogo usa (conferir no CSP
  do editor, commit `953eb0e`). A regra "`http://` só para localhost ou IP privado" vai para o código, onde a URL do
  usuário é aceita. **Abrir esse ponto antes** (onde a URL do servidor local é validada) e confirmar que ele existe.

Tasks e provas (cada uma, um commit):
1. **SEC-11, catálogo de mockups.** Um helper `safeChild(dir, name)`: recusa nome vazio, absoluto, com `..`, `\` ou
   `:`, e confere `canonicalPath.startsWith(dir.canonicalPath + File.separator)`. Usar nos 4 `File(dir, e.file|e.thumb)`
   da `MockupLibrary` e filtrar as entradas inválidas no parse (não quebrar o catálogo inteiro por uma). Prova em
   `MockupTest.kt`: `../x.png`, `/abs.png`, `a/../../x.png` → recusados; `sub/a.png` → aceito. Mutação: tirar a
   checagem do `canonicalPath` → `a/../../x.png` passa.
2. **SEC-11, hosts e tamanho.** Um `downloadBytes` comum aos dois (ou dois com o mesmo contrato):
   - só `https`;
   - host numa allowlist (`huggingface.co`, `cdn-lfs*.hf.co` e afins, `fa.videorey.in`). Conferir os hosts reais
     de redirect do HF antes de fechar a lista;
   - redirect seguido à mão, com o host conferido a cada salto;
   - limite de bytes (sugestão 15 MB a imagem, 2 MB o JSON), abortando a leitura;
   - `inJustDecodeBounds` para recusar acima de N MP.
   
   Provas JVM: a função pura de validação de URL (`http://` → recusado, host fora → recusado) e o leitor com limite
   sobre um `InputStream` de N+1 bytes → erro. Sem rede no teste.
3. **SEC-10, TLS.** `domain-config` acima. Prova: `assembleDebug` + instalar no moto `ZY32LMNN9B`; o catálogo carrega
   (HTTPS) e um servidor local `http://192.168.x.x` continua funcionando. Se não houver servidor local à mão,
   registrar como não testado.
4. **SEC-09, `dataExtractionRules`.** `res/xml/data_extraction_rules.xml` com `<cloud-backup>` e `<device-transfer>`
   excluindo tudo (`domain="root"`, `file`, `database`, `sharedpref`), e `android:dataExtractionRules` no manifest.
   Prova: `processReleaseManifest` + conferir o atributo no manifest mesclado. O resto do SEC-09 (cofre ilegível →
   novo login) depende do `AuthSession` (SEC-01) e fica fora.
5. **SEC-08, trava de release.** No `app/build.gradle.kts`, uma task que falha os builds `release` quando o
   `IAWRAPPER_CREDENTIAL` não está vazio, ou quando o `IAWRAPPER_URL` começa com `http://`. Fazer pela variant API
   (`androidComponents.onVariants`), não no `defaultConfig`. Prova: `assembleRelease` com a credencial no
   `local.properties` → falha com mensagem clara; `-Piawrapper.credential=` → passa. **Decisão do dono antes de
   ligar:** com a credencial no `local.properties`, o `assembleRelease` do círculo de teste deixa de funcionar. O
   círculo passa a usar o debug, ou a trava sai com uma flag de escape explícita (`-Pallow.test.credential=true`)?
   **Decidido pelo dono (2026-10-30): flag de escape.** A trava falha o release com credencial ou URL `http://`,
   exceto com `-Pallow.test.credential=true` explícito. Prova extra: credencial + a flag → passa. Keystore própria e R8 ficam de fora: a keystore é do dono, e o R8 pede regras para o ORT e o WebView (task
   própria).
6. `./gradlew :feature:mockup:test :feature:product:test :app:testDebugUnitTest :ai:remote-http:test` verde, e o
   E2E no moto se a task 2 mexer no caminho das imagens.

Frase de abertura da sessão: *"Leia em docs/backlog/README.md a seção 'App: catálogo remoto, TLS,
`dataExtractionRules`, trava de release' e implemente, depois que a árvore do app estiver commitada."*

**Implementação, análise complementar (2026-10-30, 3ª sessão, antes de editar).** Árvore do app commitada
(`f44681a`, `68ef4c2`); o que resta sem commit (`IawrapperEndToEndInstrumentedTest.kt`, `core/*.py`,
`docs/backlog.md`, PNGs) não é desta task e fica fora dos commits.
- Redirects reais (`curl -sSI`/`curl -sSL -w '%{url_effective}'`, 2026-10-30):
  - `huggingface.co/.../resolve/main/index.json` e `styles.json` → **`Location` relativo**
    (`/api/resolve-cache/...`), mesmo host. O seguidor manual tem de resolver contra a URL atual.
  - `.../resolve/main/mockups/menucard1.webp` e `styles/ice.webp` → `https://us.aws.cdn.hf.co/xet-bridge-us/...`.
  - `fa.videorey.in/aiproduct/mockup.json` e `.../menucard1.webp` → 200 sem redirect.
  - Allowlist fechada: `huggingface.co`, `hf.co` e subdomínios de ambos, `fa.videorey.in`.
- Catálogo HF: 52 mockups, `file`/`thumb` todos em `mockups/<nome>.webp`, nenhum com `http` ou `..`; maior imagem
  800×1201 (~0,96 MP). Teto de pixels: 16 MP. `styles.json`: 37 estilos, `url` todas em `huggingface.co`.
- `MockupLibrary.isDownloaded` (l.191-195) também faz `File(dir, e.file)`: são 5 pontos, não 4. O cache
  `remote_index.json` (`loadCachedRemoteIndex`) é relido sem filtro: filtrar lá também.
- Onde a URL do servidor local entra: `TextAiScreen.kt:128` (`urlOk` só confere `http://`/`https://`) e os
  `SettingField.Kind.URL` de `ImageFactories.kt`. **A regra "`http://` só para localhost/IP privado" fica fora
  desta task**: muda o que o usuário consegue configurar (nome `.local`, Tailscale `100.x`), pede decisão do dono.
  O SEC-10 aqui é só o `domain-config`.
- `local.properties` tem `iawrapper.url=http://127.0.0.1:8000` (iawrapper local via `adb reverse`; antes eu tinha
  anotado "IP privado", errado): o debug continua dependendo do `base-config` com cleartext, e o release com esse
  arquivo falha na trava (esperado, escape por `-Pallow.test.credential=true`).
- Código comum de download: `core/imaging` (as duas features já dependem dele), arquivo `RemoteFetch.kt`.

**Implementação: registro (2026-10-30, 3ª sessão).** Feito, um commit por task:
- `d7b64b8` task 2: `core/imaging::RemoteFetch` (`rejectReason`, `resolveRedirect`, `readLimited`,
  `checkPixels`, `download`, `downloadImage`, `downloadString`); os `downloadBytes`/`downloadString` da
  `MockupLibrary` e da `SceneLibrary` delegam para ele. Em erro, lança `IOException`: o `thumb` e o
  `getOrDownloadRemoteBitmap` continuam caindo no fallback cinza, o `template` propaga (igual a antes).
  Prova: `RemoteFetchTest` 4/4. Mutações: sufixo sem o `.` (`endsWith(it)`) → 1 falha; teto de leitura
  desligado → 1 falha.
- `c87dad9` task 1: `safeChild(dir, name)` e `MockupEntry.hasSafePaths()` em `MockupLibrary.kt`; os 5 pontos
  usam `safeChild`; `parseAnyMockupCatalog` e `loadCachedRemoteIndex` descartam só as entradas ruins.
  **Desvio do desenho:** o `..` não é recusado por texto, só pelo `canonicalPath` (`sub/../a.png` dentro da pasta
  passa). Assim a mutação pedida (tirar o `canonicalPath`) derruba o teste: 2 falhas. `MockupTest` 9/9.
- `79f2e0c` task 3: `domain-config` sem cleartext para `up.railway.app`, `huggingface.co`, `hf.co`, `videorey.in`.
  Prova no moto `ZY32LMNN9B` (debug instalado com `adb install -r`, sem limpar dados): tela Mockup carregou o
  catálogo do HF, e as miniaturas "Online" foram baixadas de novo (`files/content/mockups/mockups/*.webp` com
  hora 18:50, a da abertura) passando pelo redirect para `us.aws.cdn.hf.co`. **`http://` local: não testado.**
  O túnel `adb reverse tcp:8000` não chegou a um `http.server` ligado em `127.0.0.1` (nem por `nc` no aparelho,
  provavelmente porque o adb conecta em `::1`). Subir o servidor em `::` foi negado (exporia na rede), e o
  `Http.call` vira toda `IOException` em `AiError.Network` sem log, então a UI não distingue cleartext bloqueado
  de conexão recusada. Para provar: subir o iawrapper local de verdade (o que o `local.properties` aponta) e
  gerar uma imagem no debug.
- `271e424` task 4: `res/xml/data_extraction_rules.xml` (todos os domínios, `cloud-backup` e `device-transfer`)
  e `android:dataExtractionRules` no manifest. Prova: `:app:processReleaseManifest`; o manifest mesclado de
  release tem `android:dataExtractionRules="@xml/data_extraction_rules"` ao lado do `allowBackup="false"`.
- `aec9be2` task 5: task `check<Variant>IawrapperConfig` por `androidComponents.onVariants` (build type
  `release`), dependência do `pre<Variant>Build`. Provas: `assembleRelease` com o `local.properties` → falha
  ("IAWRAPPER_CREDENTIAL preenchido; IAWRAPPER_URL em http://"); `-Piawrapper.credential=` sozinho → falha pela
  URL; credencial vazia + URL https → passa; `:app:preDebugBuild` → passa; credencial + `-Pallow.test.credential=true`
  → `assembleRelease` BUILD SUCCESSFUL com aviso no log.
- Task 6: `./gradlew :feature:mockup:test :feature:product:test :app:testDebugUnitTest :ai:remote-http:test
  :core:imaging:testDebugUnitTest` → BUILD SUCCESSFUL, 0 falhas. E2E do relight/ADS no moto não rodado: a task 2
  mexe só no catálogo (mockups e estilos), não no caminho das imagens do iawrapper.

Fora desta task (registrar quando for pegar): regra "`http://` só para localhost/IP privado" em
`TextAiScreen.kt:128` e nos `SettingField.Kind.URL` (decisão do dono); `Http.call` sem limite de tamanho
(achado "Baixo" da tabela); keystore própria e R8 (SEC-08); cofre ilegível → novo login (SEC-09).

##### Acesso ao Postgres de produção (só leitura)
- Rodar a partir de `D:\projects\iawrapper`: o vínculo do Railway CLI é guardado por caminho, e o mesmo diretório com
  `d:\` minúsculo dá "No linked project".
- `railway variables --service Postgres --json` → `DATABASE_PUBLIC_URL`. Nunca imprimir a URL.
- Conectar com `psycopg` 3 e `conn.read_only = True`, consultas com `LIMIT`.
- Instalar o driver: `python -m pip install --user --use-deprecated=legacy-certs "psycopg[binary]==3.2.10"`. Sem a
  flag, o pip 26.2 do Python 3.14 entra em recursão no `truststore`.
- O driver fica no site-packages do usuário: o script roda com `python -E`, não `-I`.

- **Prioridade**: Fase 0 hoje (dono); Fase 1 antes de qualquer usuário novo com crédito; o restante antes de
  distribuir fora do círculo de teste. O SEC-13 entra antes do segundo app no hub.

---

## 4. Próximos Passos Recomendados para Desenvolvimento

1. **Etapa 1 (P0)**: Configurar o workflow de **IC-Light** no backend ComfyUI/Vast.ai e expor a feature `product-relight` no `iawrapper`.
2. **Etapa 2 (P0)**: Implementar a ação de **Outpainting 9:16** no editor Android, permitindo expandir a arte quadrada para Stories.
3. **Etapa 3 (P1)**: Adicionar o pacote de **Badges de Conversão SVG** na pasta de assets/presets do editor Fabric.js.
4. **Etapa 4 (P1)**: Criar o fluxo de **Geração em Lote A/B** na interface Kotlin do app.
