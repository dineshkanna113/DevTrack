/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type UserConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
  // A production build without VITE_API_URL silently points the app at
  // http://localhost:8000, which breaks for every visitor. Fail the build instead.
  if (command === "build" && mode === "production") {
    const env = loadEnv(mode, root, "VITE_");
    if (!env.VITE_API_URL) {
      throw new Error(
        "VITE_API_URL is not set. Set it to the deployed API URL " +
          "(e.g. in Vercel: Settings → Environment Variables) and rebuild.",
      );
    }
  }
  return config;
});

const config = {
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(root, "src") } },
  build: {
    rollupOptions: {
      output: {
        // Split vendors so app deploys don't bust the cache for rarely-changing libraries
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return "charts";
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "react";
          return "vendor";
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
} satisfies UserConfig;
