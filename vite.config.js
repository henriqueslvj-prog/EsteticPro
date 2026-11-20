import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // não publica o código-fonte original
    minify: 'esbuild',
  },
  esbuild: {
    drop: ['debugger'],
    legalComments: 'none',
  },
})
