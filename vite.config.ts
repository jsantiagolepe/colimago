/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Solo se usa en `tauri dev` para desarrollar dentro de un dispositivo remoto.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Que Vite no borre los errores de Rust en la terminal de `tauri dev`.
  clearScreen: false,
  server: {
    // Tauri espera el servidor de desarrollo en este puerto exacto
    // (devUrl en src-tauri/tauri.conf.json). No usar 3001 ni 5173: esos
    // los usa el inicio de sesión con Google.
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    // WKWebView de macOS 13+.
    target: 'safari16',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
