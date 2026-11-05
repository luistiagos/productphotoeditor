# Backlog de Funcionalidades do Produto

O documento detalhado de backlog e roadmap para **Criação de Anúncios e IA Remota** foi organizado na pasta [`docs/backlog/`](file:///c:/projects/sandbox/product_photo_offline/docs/backlog/README.md):

👉 **[Acessar Backlog Completo: Criação de Anúncios e IA Remota](file:///c:/projects/sandbox/product_photo_offline/docs/backlog/README.md)**

### Resumo dos Épicos:
- [x] **ADS-01 (P0)**: Harmonização Visual & Relighting Remoto (IC-Light) — *(Concluído)*
- [x] **ADS-02 (P0)**: Expansão Generativa Multiformato (Outpainting 1:1 $\to$ 9:16 / 16:9) — *(Concluído)*
- [ ] **ADS-03 (P1)**: Geração em Lote para Testes A/B (1 clique $\to$ 5 cenários)
- [x] **ADS-04 (P1)**: Badges e Selos de Conversão no Canvas (Garantia, Frete Grátis, 5 Estrelas) — *(Concluído)*
- [ ] **ADS-05 (P1)**: Copiloto de Copywriting & Auto-Prompt (Vision LLM)
- [ ] **ADS-06 (P2)**: Modo Catálogo Mercado Livre / Amazon (Fundo Branco Puro + Sombra)
- [ ] **ADS-07 (P2)**: Infográficos de Benefícios ("Raio-X" do Produto)
- [ ] **ADS-08 (P2)**: Interação Humana (Mão segurando / Modelo vestindo)
- [ ] **ADS-09 (P3)**: Motion Ads (Micro-vídeos MP4 de 3 a 5s para Reels/TikTok)
- [ ] **SEC-01 (P1)**: Tirar a credencial do APK — contas individuais no `iawrapper` (Google + e-mail/senha)
- [ ] **SEC-02 (P0)**: Conta admin e credenciais de teste — senha nova, tirar o admin, E2E sem literal
- [ ] **SEC-03 (P0)**: Webhook RevenueCat — tirar a rota agora; requisitos anotados para a feature futura
- [ ] **SEC-04 (P0)**: Segredos e configuração de produção — rotacionar `SECRET_KEY` e chaves; defaults seguros
- [ ] **SEC-05 (P1)**: Sessão e tokens — `is_active`, refresh com `core.User`, revogação por `token_version`
- [ ] **SEC-06 (P1)**: Autorização e vazamento de dados — `users/<id>`, `config_json`, erros internos
- [ ] **SEC-07 (P1)**: Contas — verificação de e-mail, reset, Google `email_verified`, limites de login (`NUM_PROXIES`)
- [ ] **SEC-08 (P1)**: Release do app — keystore própria, R8 e trava contra credencial/HTTP no build
- [ ] **SEC-09 (P1)**: Cofre local resiliente + `dataExtractionRules`
- [ ] **SEC-10 (P1)**: TLS no app — HTTP só para servidor local
- [ ] **SEC-11 (P1)**: Catálogo remoto — caminho (`../`), hosts, tamanho e integridade
- [ ] **SEC-12 (P1)**: Privacidade, retenção de mídia, moderação e Data Safety
- [ ] **SEC-13 (P1)**: Hub multi-app — isolamento por app, papéis, orçamento, Play Integrity
- [ ] **SEC-14 (P1)**: Administração — Django admin, cascatas, `seed_features`, auditoria
- [ ] **SEC-15 (P0)**: Execução, custo e abuso — `workflow_json` do usuário, limites, `sync`, cancel/estorno
- [ ] **SEC-16 (P2)**: Repositório, build e dependências
- [ ] **SEC-17 (P1)**: Worker 3D Trellis — autenticação e exposição
