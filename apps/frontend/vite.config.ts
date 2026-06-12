/**
 * vite.config | v1.2.0 | 2026-06-13
 * T20: DEPLOY_MODE env flag for production-hardened build (terser, no sourcemaps).
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
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'vendor-phaser'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react'
          if (id.includes('node_modules/@mysten')) return 'vendor-sui'
        },
      },
    },
  },
})
