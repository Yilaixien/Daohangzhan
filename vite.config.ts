import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/@supabase/supabase-js')) return 'supabase'
          if (id.includes('node_modules/chart.js')) return 'chart'
          if (id.includes('node_modules/vuedraggable')) return 'vuedraggable'
        },
      },
    },
  },
})