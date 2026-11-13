import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // strictPort: the API only allows this exact origin (CORS_ORIGIN), so never drift to another port
  server: { port: 5173, strictPort: true },
});
