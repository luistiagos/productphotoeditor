# AGENTS.md — Pocket Studio (`product_photo_offline`)

Guia operacional para agentes de código (Antigravity, Claude Code, Codex) trabalhando neste repositório.

---

## 1. Visão Geral & Identidade

- **App:** Pocket Studio (`com.productphoto.offline`, Android `minSdk 28`, `compileSdk 35`, Kotlin + Jetpack Compose + WebView Fabric.js 7.4.0).
- **Propósito:** Estúdio offline-first de foto de produto, remoção de fundo, upscaling HD (Real-ESRGAN), mockups 3D e editor comercial de anúncios.
- **Restrição Legal:** 100% escrito do zero; nunca copiar código, prompts, fontes ou assets do app analisado em `C:\projects\sandbox\product_photo_apk\`.

---

## 2. Mapa de Módulos e Arquivos-Chave

| Módulo / Pasta | Responsabilidade | Arquivos principais |
|---|---|---|
| `:app` | Navegação Compose, DI manual, telas principais e atalhos | [`MainActivity.kt`](app/src/main/kotlin/com/productphoto/app/MainActivity.kt), [`AppGraph.kt`](app/src/main/kotlin/com/productphoto/app/AppGraph.kt), [`Navigator.kt`](app/src/main/kotlin/com/productphoto/app/Navigator.kt), [`HomeScreen.kt`](app/src/main/kotlin/com/productphoto/app/HomeScreen.kt), [`QuickToolsScreens.kt`](app/src/main/kotlin/com/productphoto/app/QuickToolsScreens.kt), [`SettingsScreen.kt`](app/src/main/kotlin/com/productphoto/app/SettingsScreen.kt), [`ThemeSelector.kt`](app/src/main/kotlin/com/productphoto/app/ThemeSelector.kt), [`BrandKitScreen.kt`](app/src/main/kotlin/com/productphoto/app/BrandKitScreen.kt), [`ImageGenScreen.kt`](app/src/main/kotlin/com/productphoto/app/ImageGenScreen.kt) |
| `:core:ui` | Design System, 6 paletas verificadas WCAG 2.1, `FormatPicker` | [`Theme.kt`](core/ui/src/main/kotlin/com/productphoto/ui/Theme.kt), [`ThemeContrastTest.kt`](core/ui/src/test/kotlin/com/productphoto/ui/ThemeContrastTest.kt), [`MediaFormats.kt`](core/ui/src/main/kotlin/com/productphoto/ui/MediaFormats.kt), [`FormatPicker.kt`](core/ui/src/main/kotlin/com/productphoto/ui/FormatPicker.kt) |
| `:core:ai-api` | Contratos de IA plugáveis e cadeias de fallback | `BackgroundRemover`, `Upscaler`, `Inpainter`, `ImageGenerator`, `TextGenerator`, `Vectorizer`, `ProductRelighter`, `AdFormatExpander` |
| `:core:imaging` | Processamento local de imagem (`cutout`, `upscaleTiled`, sombras, harmonização) | [`LocalSceneComposer.kt`](core/imaging/src/main/kotlin/com/productphoto/imaging/LocalSceneComposer.kt), [`Tiles.kt`](core/imaging/src/main/kotlin/com/productphoto/imaging/Tiles.kt) |
| `:ai:*` | Implementações ML Kit, ONNX (`u2netp`, `Real-ESRGAN`, `MI-GAN`), LiteRT-LM, VTracer JNI, HTTP | `:ai:mlkit`, `:ai:onnx`, `:ai:litertlm`, `:ai:vtracer`, `:ai:remote-http` |
| `:feature:product` | Fluxo completo de Foto de Produto com IA (`ResultStep` em abas, Relighting, Outpaint) | [`ProductFlowScreen.kt`](feature/product/src/main/kotlin/com/productphoto/feature/product/ProductFlowScreen.kt), [`ProductFlowViewModel.kt`](feature/product/src/main/kotlin/com/productphoto/feature/product/ProductFlowViewModel.kt) |
| `:feature:mockup` | Galeria categorizada e aplicação em mockups 2.5D/3D | [`MockupScreen.kt`](feature/mockup/src/main/kotlin/com/productphoto/feature/mockup/MockupScreen.kt) |
| `:editor` & `editor-web/` | Editor de anúncios em Fabric.js servido offline em WebView + ponte Kotlin↔JS | [`EditorSession.kt`](editor/src/main/kotlin/com/productphoto/editor/EditorSession.kt), [`EditorExports.kt`](editor/src/main/kotlin/com/productphoto/editor/EditorExports.kt), `editor-web/src/main.ts`, `editor-web/src/styles.css`, `editor-web/src/icons.ts` |
| `app/src/main/assets/showcase/` | Imagens profissionais ilustrativas de Home, Templates e aba Marca | `tmpl_*.jpg`, `ad_*.jpg`, `tool_*.jpg` |

---

## 3. UI, Paletas de Cores & Regras de Design

1. **6 Paletas Profissionais WCAG (`StudioThemeStyle` em `Theme.kt`):**
   - `VIOLET_STUDIO` (Dark padrão), `GRAPHITE_PRO` (OLED neutro calibrado), `NOIR_GOLD` (Dark luxo champagne), `DEEP_OCEAN` (Dark cyber/tech), `CRIMSON_STUDIO` (Dark editorial coral/âmbar) e `DAYLIGHT_GALLERY` (Light editorial).
   - **Persistência:** `SharedPreferences("studio_prefs")` em `AppGraph.themeStyle`, acessível pelo ícone de Paleta na Home e em `SettingsScreen`.
   - **Regra obrigatória:** nunca hardcodar `Color(0xFF1E222E)` ou `Color.White` sobre superfícies do app sem usar `MaterialTheme.colorScheme.*` (ou cálculo de `luminance()` para cards customizados de Brand Kit). Qualquer mudança em `Theme.kt` deve passar no `ThemeContrastTest`.
2. **Navegação da `HomeScreen`:**
   - **4 abas:** `Início` (`StudioTab`), `Templates` (`TemplatesTab`), `Projetos` (`ProjectsTab`), `Marca` (`BrandTab`).
   - **`StudioTab`:** carrossel horizontal **Ferramentas em Destaque** (*Foto de Produto com IA*, *Remover Fundo IA*, *Upscaler Real-ESRGAN*) + **Ferramentas Rápidas** (*Foto de Produto IA*, *Remover Fundo*, *Upscaler HD*, *Novo design*, *Gerar imagem*, *Mockup 3D*, *Templates Prontos*) + *Projetos Recentes*.
   - **Compatibilidade E2E:** o driver `tools/e2e/cdp.mjs::launchEditor()` busca o texto exato `"Novo design"` via `uiautomator` na Home. **Manter `"Novo design"` visível e clicável na Home.**

---

## 4. Comandos de Build, Testes e Aparelho

- **JDK:** `D:\DevCaches\jdk-17` (usar `JAVA_HOME` se necessário).
- **WebView (`editor-web/`):** qualquer edição em `editor-web/` exige `npm run build` em `editor-web/` para regenerar o bundle versionado em `editor/src/main/assets/editor/` (`index.html` + `assets/index-<hash>.*`), seguido de `npm test` (`vitest`).
- **Build & Testes Unitários:**
  ```powershell
  .\gradlew.bat --no-daemon :core:ui:testDebugUnitTest :app:assembleDebug testDebugUnitTest
  ```
- **Nota Windows (Kotlin Daemon):** se ocorrer lock em `source-to-classes.tab` / `lookups.tab` entre builds no Windows, rodar `.\gradlew.bat --stop`, encerrar processos `java` órfãos se necessário e usar `--no-daemon`.
- **ADB / Aparelho Físico (Moto G86 5G):**
  - Serial wireless padrão: `adb-ZY32LMNN9B-6mRvcH._adb-tls-connect._tcp`.
  - Após `adb start-server`, aguardar ~2–3 s para descoberta mDNS antes de rodar comandos `adb`.
  - **Capturas de tela no PowerShell 5.1:** sempre envolver com `cmd /c "adb exec-out screencap -p > print.png"` (redirecionamento direto no PowerShell corrompe o PNG em UTF-16LE).
  - Nunca rodar `pm clear` ou desinstalar o pacote `com.productphoto.offline` no aparelho físico sem autorização; instalar com `adb install -r -d`.

---

## 5. Documentos de Referência

- **Manual do Pipeline / Runtime:** [`.claude/skills/pipeline-correcao-bugs/projeto.md`](.claude/skills/pipeline-correcao-bugs/projeto.md)
- **Arquitetura Completa:** [`ARQUITETURA.md`](ARQUITETURA.md)
- **Handoff Contínuo de Sessões:** [`HANDOFF_APP_OFFLINE.md`](HANDOFF_APP_OFFLINE.md)
- **Plano de Interface & UX:** [`docs/PLANO_INTERFACE_UX.md`](docs/PLANO_INTERFACE_UX.md)
