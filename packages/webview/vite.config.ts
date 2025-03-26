import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

// If you're using ES modules in Node:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // Tell Vite "the directory that contains index.html is ./src"
  root: path.resolve(__dirname, 'src'),
  // If you also have a public folder, point publicDir
  publicDir: path.resolve(__dirname, 'public'),

  plugins: [react()],

  build: {
    // The 'dist' folder ends up at "packages/webview/dist"
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      // If needed, you can also explicitly set the 'input' file
      // input: path.resolve(__dirname, 'src/index.html'),
    },
  },

  server: {
    port: 3000,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
