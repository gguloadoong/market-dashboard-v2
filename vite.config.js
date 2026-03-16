import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
