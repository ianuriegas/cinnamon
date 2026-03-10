import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function redirectDashboardToSlash() {
  const handler = (req, res, next) => {
    const path = req.url?.split("?")[0];
    if (path === "/dashboard") {
      const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      res.writeHead(301, { Location: `/dashboard/${qs}` });
      res.end();
      return;
    }
    next();
  };
  return {
    name: "redirect-dashboard-slash",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.stack.unshift({ route: "", handle: handler });
    },
  };
}

export default defineConfig({
  root: "src/dashboard",
  base: "/dashboard/",
  plugins: [
    redirectDashboardToSlash(),
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
      "/api/admin": "http://localhost:3000",
      "/auth": "http://localhost:3000",
      "/v1": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
});
