import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { terminalLogger } from './vite-plugin-terminal-logger.js'

export default defineConfig({
  plugins: [react(), terminalLogger()],
  server: {
    port: 8000,
    host: true,
    strictPort: false,
    allowedHosts: [
      'tynisha-thermophosphorescent-vennie.ngrok-free.dev',
      'undated-giveaway-womankind.ngrok-free.dev',
      '.ngrok-free.dev',
      '.ngrok.app',
      '.ngrok.io',
      'localhost'
    ],
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path, // Не переписываем путь, оставляем /api
      }
    }
  },
  // Настройка логирования Vite
  // 'info' - показывает все (включая HMR)
  // 'warn' - только предупреждения и ошибки
  // 'error' - только ошибки
  // 'silent' - ничего не показывает
  logLevel: process.env.VITE_LOG_LEVEL || 'info', // Меняйте на 'warn' чтобы скрыть HMR логи
})
