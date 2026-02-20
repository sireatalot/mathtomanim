import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // Ignore Python files and Manim output so page doesn't reload on generation
      ignored: ['**/*.py', '**/media/**', '**/__pycache__/**'],
    },
  },
})
