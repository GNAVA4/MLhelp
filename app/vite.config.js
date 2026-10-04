import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base:'./' — относительные пути к ассетам (как в Life OS): сборка открывается с любого пути хостинга.
// Отсюда и hash-маршруты (#/t/1.3) вместо history-роутинга.
export default defineConfig({
  plugins: [
    react(),
    // PWA (ADR 010): весь контент в precache (~21 МБ, по сети ~5 МБ сжатыми) — после первого открытия курс работает офлайн целиком.
    // registerType 'prompt': новая версия не перезагружает страницу посреди теста, а показывает плашку «Обновить» (ui/UpdateBanner.jsx).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Applied ML — курс',
        short_name: 'Applied ML',
        description: 'Теория, тесты и интервальное повторение по прикладному ML',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1120',
        theme_color: '#0b1120',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,json,svg,png,woff,woff2}'],
        // data/questions.json ~5 МБ — больше лимита workbox по умолчанию (2 МБ)
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // /__/ — служебные адреса Firebase Hosting (auth), content/ — страницы тем в iframe (свои файлы из precache)
        navigateFallbackDenylist: [/^\/__\//, /\/content\//],
      },
    }),
  ],
  base: './',
  // файлы бандла — в static/, чтобы не смешиваться с public/assets (katex, mathjax, bridge.js без хешей в именах)
  // firebase — отдельным чанком: грузится лениво (lib/sync.js), только если на устройстве входили
  build: { assetsDir: 'static', chunkSizeWarningLimit: 1000, rollupOptions: { output: { manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'] } } } },
});
