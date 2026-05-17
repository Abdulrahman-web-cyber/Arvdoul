// vite.config.js (Arvdoul-level)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@context": path.resolve(__dirname, "src/context"),
        "@components": path.resolve(__dirname, "src/components"),
        "@screens": path.resolve(__dirname, "src/screens"),
        "@layouts": path.resolve(__dirname, "src/layouts"),
        "@lib": path.resolve(__dirname, "src/lib"),
        "@assets": path.resolve(__dirname, "src/assets"),
        "@styles": path.resolve(__dirname, "src/styles"),
      },
      extensions: [".js", ".jsx", ".ts", ".tsx", ".json"]
    },
    server: {
      port: 5173,
      strictPort: false,
      open: false,
      fs: {
        allow: [path.resolve(__dirname)]
      }
    },
    build: {
      sourcemap: isDev ? "inline" : false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom", "firebase"]
          }
        }
      }
    },
    define: {
      // useful for analytics or feature-flags checks
      __ARVDOUL_DEV__: isDev
    },
    envPrefix: ["VITE_", "ARV_"]
  };
});