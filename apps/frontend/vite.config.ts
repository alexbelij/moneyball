/**
 * vite.config | v1.1.0 | 2026-06-13
 * T16: manualChunks for Phaser vendor isolation + React vendor chunk.
 * Lite mode never downloads the phaser chunk thanks to React.lazy in App.tsx.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 3000 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Phaser in its own chunk — only loaded when full room mode is active
          if (id.includes('node_modules/phaser')) {
            return 'vendor-phaser'
          }
          // React + React DOM in a shared vendor chunk
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react'
          }
          // Sui/wallet SDK
          if (id.includes('node_modules/@mysten')) {
            return 'vendor-sui'
          }
        },
      },
    },
  },
})
