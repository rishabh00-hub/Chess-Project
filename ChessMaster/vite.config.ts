import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: path.resolve(__dirname, "./client"),
  envDir: "../",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  server: {
    port: 5000,
    host: '0.0.0.0',
    strictPort: true,
    hmr: {
      host: '0.0.0.0',
      protocol: 'ws'
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
        // fix for Codespaces cookies: rewrite domain so browser accepts Set-Cookie
        cookieDomainRewrite: {"*": ""},
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('Proxying request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('Received response:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  build: {
    outDir: "../dist",
    target: "esnext",
  }
});
