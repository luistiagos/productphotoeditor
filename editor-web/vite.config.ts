import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// O build vai direto para os assets do módulo :editor (ARQUITETURA §7), servido por
// https://appassets.androidplatform.net/assets/editor/index.html — caminhos relativos.
export default defineConfig({
  base: './',
  resolve: {
    // fabric/extensions importa "westures" (gestos), que não é dependência declarada nem usada aqui
    alias: { westures: fileURLToPath(new URL('./src/stubs/westures.ts', import.meta.url)) },
  },
  build: {
    outDir: '../editor/src/main/assets/editor',
    emptyOutDir: true,
    target: 'chrome100',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
