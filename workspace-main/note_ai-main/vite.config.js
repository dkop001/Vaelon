import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Tauri expects a fixed port, fail if not available
  server: {
    port: 5173,
    strictPort: true,
  },
  
  // Env variables starting with TAURI_ are exposed
  envPrefix: ['VITE_', 'TAURI_'],
  
  build: {
    target: 'es2022',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    // Externalize Tauri plugins (only available at runtime in desktop mode)
    rollupOptions: {
      external: [
        '@tauri-apps/plugin-sql',
        '@tauri-apps/plugin-shell',
        '@tauri-apps/plugin-fs',
        '@tauri-apps/api/core',
      ],
    },
  },
})
