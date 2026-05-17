import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: "./", // relative paths
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@context": resolve(__dirname, "./src/context"),
      "@components": resolve(__dirname, "./src/components"),
      "@screens": resolve(__dirname, "./src/screens"),
      "@hooks": resolve(__dirname, "./src/hooks"),
      "@firebase": resolve(__dirname, "./src/firebase"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  define: {
    "process.env": {},
  },
});
