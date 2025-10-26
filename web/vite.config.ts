import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/ppengo-ts/",
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    //open: "/ppengo-ts/",
    proxy: {
      "/ppengo/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../nginx/prod/ppengo-ts",
    emptyOutDir: true,
    minify: false,
    cssMinify: false,
    //sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/js/[name]-[hash].js",
        chunkFileNames: "assets/js/[name]-[hash].js",
        //inlineDynamicImports: true,
        //manualChunks: undefined,
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "";
          if (name.endsWith(".css")) {
            return "assets/css/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});
