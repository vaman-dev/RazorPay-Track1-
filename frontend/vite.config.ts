import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/chat": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/trace": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/pay": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
