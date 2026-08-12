import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Italovers',
        short_name: 'Italovers',
        description: 'Roteiro e lugares salvos da viagem, cruzados com o GPS',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A1420',
        theme_color: '#0A1420',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // webp esta aqui pelas fotos dos lugares em public/places/. Sem isso o
        // service worker nao as precacheia e elas nao abrem sem sinal.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        runtimeCaching: [
          {
            // Tiles do OSM. Ganho barato: os tiles que voce acabou de ver
            // sobrevivem um pouco offline. Mapa offline de verdade e fora de escopo.
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  /**
   * Dois projetos em vez de environmentMatchGlobs, que foi removido no Vitest
   * 4. O antigo ja nao fazia nada aqui: o render.test.jsx so rodava em jsdom
   * por causa do docblock `@vitest-environment` na linha 1 dele, e um teste de
   * render novo sem esse comentario teria rodado em node e estourado com
   * "document is not defined". Agora o glob decide de verdade.
   *
   * A divisao importa: logica pura em node roda mais rapido e nao deixa um
   * teste de haversine depender por acidente de alguma API de DOM.
   */
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'logica', environment: 'node', include: ['src/**/*.test.js'] },
      },
      {
        extends: true,
        test: { name: 'render', environment: 'jsdom', include: ['src/**/*.test.jsx'] },
      },
    ],
  },
})
