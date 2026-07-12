import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "My Records",
        short_name: "My Records",
        description: "LP盤コレクション — Cover Flow",
        theme_color: "#b8b8be",
        background_color: "#b8b8be",
        display: "standalone",          // ← フルスクリーンで起動（ブラウザUI非表示）
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        // オフライン対応：ビルドしたファイルをすべてキャッシュ
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      }
    })
  ]
});
