/**
 * vite.config | v1.3.0 | 2026-06-13
 * T16: manualChunks for Phaser vendor isolation + React/Sui vendor chunks.
 * Lite mode never downloads the phaser chunk thanks to React.lazy in App.tsx.
 * T20: DEPLOY_MODE env flag for production-hardened build (terser, no sourcemaps).
 * T22: editor.html as second input (dev-only, excluded from build:deploy).
 * Regular `build` stays readable; `build:deploy` enables full minification.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const isDeploy = process.env.DEPLOY_MODE === '1'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 3000 },
  build: {
    sourcemap: isDeploy ? false : true,
    minify: isDeploy ? 'terser' : 'esbuild',
    ...(isDeploy && {
      terserOptions: {
        mangle: { toplevel: true },
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 2,
        },
      },
    }),
    rollupOptions: {
      input: isDeploy
        ? { main: path.resolve(__dirname, 'index.html') }
        : {
            main: path.resolve(__dirname, 'index.html'),
            editor: path.resolve(__dirname, 'editor.html'),
          },
      output: {
        manualChunks(id) {
          // Phaser in its own chunk — only loaded when full room mode is active
          if (id.includes('node_modules/phaser')) return 'vendor-phaser'
          // React + React DOM in a shared vendor chunk
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react'
          // Sui/wallet SDK
          if (id.includes('node_modules/@mysten')) return 'vendor-sui'
        },
      },
    },
  },
})
