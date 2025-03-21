import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-assets',
      closeBundle: () => {
        const outDir = path.resolve(__dirname, 'dist');

        // Copy manifest.json
        const manifestSrc = path.resolve(__dirname, 'src/manifest.json');
        const manifestDest = path.resolve(outDir, 'manifest.json');
        fs.copyFileSync(manifestSrc, manifestDest);
        console.log('✅ Manifest copied');

        // Copy icons folder
        const iconsSrcDir = path.resolve(__dirname, 'src/assets/icons');
        const iconsDestDir = path.resolve(outDir, 'icons');
        if (!fs.existsSync(iconsDestDir)) {
          fs.mkdirSync(iconsDestDir, { recursive: true });
        }
        fs.readdirSync(iconsSrcDir).forEach((file) => {
          fs.copyFileSync(
            path.resolve(iconsSrcDir, file),
            path.resolve(iconsDestDir, file),
          );
        });
        console.log('✅ Icons copied');

        // Move and rename HTML entry points
        const htmlMoves = [
          ['src/options/index.html', 'options.html'],
          ['src/popup/index.html', 'popup.html'],
        ];

        htmlMoves.forEach(([from, to]) => {
          const fromPath = path.resolve(outDir, from);
          const toPath = path.resolve(outDir, to);
          if (fs.existsSync(fromPath)) {
            fs.renameSync(fromPath, toPath);
            console.log(`✅ Moved ${from} → ${to}`);
          } else {
            console.error(`❌ Could not find ${fromPath}`);
          }
        });

        // Remove leftover src directory in dist
        const leftoverDir = path.resolve(outDir, 'src');
        if (fs.existsSync(leftoverDir)) {
          fs.rmSync(leftoverDir, { recursive: true });
          console.log('✅ Removed leftover src directory');
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'src/popup/index.html'),
        options: path.resolve(__dirname, 'src/options/index.html'),
        background: path.resolve(__dirname, 'src/background/index.ts'),
        content: path.resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          ['background', 'content'].includes(chunk.name)
            ? '[name].js'
            : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        dir: 'dist',
      },
    },
    emptyOutDir: true,
  },
});
