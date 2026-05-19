import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const standalone = process.env.STANDALONE === '1'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(standalone ? [viteSingleFile()] : []),
  ],
  base: process.env.VITE_BASE_PATH || './',
  build: {
    outDir: standalone ? '../site-standalone' : '../site',
    emptyOutDir: true,
    ...(standalone
      ? {
          cssCodeSplit: false,
          assetsInlineLimit: 100000000,
        }
      : {}),
  },
})
