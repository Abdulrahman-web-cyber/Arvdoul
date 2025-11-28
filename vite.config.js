import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: {
    alias: {
      "@context": "/src/context",
      "@components": "/src/components",
      "@screens": "/src/screens",
      "@hooks": "/src/hooks",
      "@lib": "/src/lib",
    },
  },
  plugins: [react()],
  optimizeDeps: {
    include: [
      "firebase/app",
      "firebase/auth",
      "firebase/firestore",
      "firebase/storage",
    ],
  },
});
