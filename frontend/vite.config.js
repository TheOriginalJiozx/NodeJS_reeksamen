import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  define: {
    "import.meta.env.VITE_BACKEND_ORIGIN": JSON.stringify(process.env.BACKEND_ORIGIN),
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.BACKEND_ORIGIN,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
