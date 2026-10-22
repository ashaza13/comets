/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  plugins: [react(), glsl()],
  server: {
    // spec.json is imported from ../backend so both sides share one vocabulary.
    fs: { allow: ['..'] },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'node',
  },
})
