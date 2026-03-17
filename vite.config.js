import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: '마켓레이더',
        short_name: '마켓레이더',
        description: '국장·미장·코인 실시간 급등 종목 모니터링',
        theme_color: '#863bff',
        background_color: '#F8F9FA',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 정적 에셋만 캐시 (API 호출은 캐시 안 함 — 실시간 데이터 필수)
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            // 구글 폰트 캐시
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  build: {
    // CDS 포함 번들 크기 경고 임계값 상향 (CDS 자체가 대형 라이브러리)
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // CDS와 차트 라이브러리를 별도 청크로 분리 (코드 스플리팅)
        manualChunks(id) {
          if (id.includes('@coinbase/cds-web')) return 'cds';
          if (id.includes('lightweight-charts') || id.includes('recharts')) return 'charts';
          if (id.includes('react-dom') || id.includes('react/')) return 'react';
          if (id.includes('@tanstack/react-query')) return 'query';
        },
      },
    },
  },
})
