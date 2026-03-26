import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages는 /market-dashboard-v2/ 경로에서 서빙 — Vercel은 / 유지
  base: process.env.GITHUB_PAGES === 'true' ? '/market-dashboard-v2/' : '/',
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
        // navigateFallback: null — navigation 요청은 항상 네트워크에서 서빙
        // SW가 HTML을 인터셉트하면 blank page 위험이 있으므로 비활성화
        navigateFallback: null,
        // JS/CSS/폰트/아이콘만 precache (HTML 제외 — 항상 최신 서버 버전 사용)
        globPatterns: ['**/*.{js,css,woff2,png}'],
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
  test: {
    environment: 'node',
    globals: true,
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // 차트 라이브러리를 별도 청크로 분리 (코드 스플리팅)
        manualChunks(id) {
          if (id.includes('lightweight-charts') || id.includes('recharts')) return 'charts';
          if (id.includes('react-dom') || id.includes('react/')) return 'react';
          if (id.includes('@tanstack/react-query')) return 'query';
        },
      },
    },
  },
})
