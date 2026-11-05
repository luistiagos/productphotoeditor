# Editor: escolher um SVG na galeria falha com erro técnico

- **Onde:** editor → "Imagem → Escolher da galeria…" e "🔄 Substituir → Escolher da galeria…" (ponte `pickImage`).
- **Como reproduzir (emulador `pp_api34`, 2026-11-05):** o seletor de fotos do Android lista os SVG de
  `Download/ProductPhoto/teste_fase4_*.svg` (MIME `image/svg+xml`, exportações do próprio app) como "Photo taken on …";
  tocar num deles → toast `Erro: Failed to create image decoder with message 'unimplemented'Input contained an error.`
- **Esperado:** ou o SVG entra (o editor já importa SVG por `addSvgString`), ou uma mensagem clara ("SVG não é suportado
  aqui; use Adesivos/Vetorizar").
- **Não investigado:** o lado Kotlin de `pickImage` (`EditorSession`/`EditorHandlers`) não foi aberto; a causa provável é
  o `ImageDecoder` não decodificar SVG. Achado durante o E2E da TASK-11 (`docs/tasks/retest/11-…md` §5.6).
