import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    allowedHosts: true,
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/src_formal_backup/**',
        '**/.codex_work/**',
        '**/.codex_spreadsheet_work/**'
      ]
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: ['@ant-design/icons', 'antd', 'axios', 'echarts', 'echarts-for-react', 'xlsx']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
          charts: ['echarts', 'echarts-for-react'],
          xlsx: ['xlsx']
        }
      }
    }
  }
})
