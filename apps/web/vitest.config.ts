import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./app/vitest.setup.ts"],
    globals: true,
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_KEY: "test-anon-key",
      VITE_MAPBOX_TOKEN: "test-mapbox-token",
    },
  },
});
