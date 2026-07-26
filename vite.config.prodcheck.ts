// Config TEMPORAL de validación: igual que vite.config.ts pero el proxy apunta
// al backend de PRODUCCIÓN vía su IP LAN (192.168.1.98), saltando el DNS roto
// por hairpin NAT del router. Solo lecturas. Uso:
//   npx vite --config vite.config.prodcheck.ts --mode prodcheck --port 8090
// (.env.prodcheck deja VITE_API_URL vacío para que axios use rutas relativas
//  y todo pase por este proxy.)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const prodBackend = {
  target: "https://192.168.1.98",
  changeOrigin: false,
  secure: false, // el cert es para el dominio, no la IP — validación local solamente
  headers: { host: "atakback.revolution505.com" },
};

export default defineConfig({
  server: {
    host: true,
    port: 8090,
    proxy: {
      "/api": prodBackend,
      "/auth": prodBackend,
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
