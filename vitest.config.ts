import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@easter-egg": path.resolve(here, "src") } },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
