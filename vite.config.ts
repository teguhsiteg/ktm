import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000
        },
        registerType: 'autoUpdate',
        includeAssets: ['logo-uii.png'],
        manifest: {
          name: "Pengambilan KTM UII",
          short_name: "KTM UII",
          description: "Sistem Manajemen Pengambilan KTM UII",
          theme_color: "#005BAC",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/logo-uii.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "/logo-uii.png",
              sizes: "512x512",
              type: "image/png"
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
