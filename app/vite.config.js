import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base:'./' — относительные пути к ассетам (как в Life OS): сборка открывается с любого пути хостинга.
// Отсюда и hash-маршруты (#/t/1.3) вместо history-роутинга.
export default defineConfig({
  plugins: [react()],
  base: './',
  // файлы бандла — в static/, чтобы не смешиваться с public/assets (katex, mathjax, bridge.js без хешей в именах)
  build: { assetsDir: 'static' },
});
