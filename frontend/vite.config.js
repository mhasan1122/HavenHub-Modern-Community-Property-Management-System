
// // vite.config.js
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

// export default defineConfig({
//   plugins: [react()],
//   optimizeDeps: {
//     include: ['@tanstack/react-table'],
//   },
// });

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react({
      // Disable React error overlay in development to allow ErrorBoundary to catch errors
      overlay: false,
    })
  ],
  resolve: {
   alias: {
      'Components': fileURLToPath(new URL('./src/Components', import.meta.url)),
      'utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      'pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ["@tanstack/react-table"],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false
      }
    }
  },
});





