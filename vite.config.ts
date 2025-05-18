import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import path from "path"

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    }
  },
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/js/app.js",
        chunkFileNames: "assets/js/chunk-[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "assets/css/app.css"
          }
          return "assets/[name][extname]"
        }
      }
    }
  }
})