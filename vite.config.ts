import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // 部署到 GitHub Pages 子路径（https://<user>.github.io/<repo>/）
  // 必须设置 base，否则构建产物里的 JS/CSS 路径会从根域开始查找导致 404
  base: '/SqueezePic/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  optimizeDeps: {
    // @jsquash/* 在运行时通过 import.meta.url 动态加载 .wasm 文件
    // 不能被 esbuild 预构建成单文件，否则 WASM 路径会丢失
    exclude: ['@jsquash/jpeg', '@jsquash/png', '@jsquash/webp'],
  },
  build: {
    target: 'esnext',
    // 把 .wasm 资源放在 assets/ 下，保留 import.meta.url 可解析
    assetsInlineLimit: 0,
  },
});
