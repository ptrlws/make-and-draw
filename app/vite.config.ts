import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built app also works when served from a sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
})
