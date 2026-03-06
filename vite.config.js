import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/dashboard",
  base: "/dashboard/",
  plugins: [
    react({
      jsxImportSource: "react",
    }),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api/dashboard": {
        target: "http://localhost:3000",
        changeOrigin: true,
        // Required for SSE streaming — disable response buffering
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
              proxyRes.headers["cache-control"] = "no-cache";
              proxyRes.headers["x-accel-buffering"] = "no";
            }
          });
        },
      },
      "/v1": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
});
