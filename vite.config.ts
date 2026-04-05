import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'public/icons', dest: '.' },
        { src: 'public/popup.html', dest: '.' },
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        popup: resolve(__dirname, 'src/popup/index.tsx'),
      },
      output: [
        // popup как IIFE (для Chrome extension popup)
        {
          entryFileNames: 'popup.js',
          format: 'iife',
          name: 'ShadowEditorPopup',
        },
        // background и content как ESM
        {
          entryFileNames: '[name].js',
          format: 'es',
        },
      ],
    },
  },
  publicDir: 'public',
});