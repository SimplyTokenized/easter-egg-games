import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Everything the host app already has stays external. Bundling any of it would
 * give the arcade a second copy of React (hooks would throw) and would defeat
 * the host's own deduplication for the rest.
 */
const EXTERNAL = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@radix-ui/react-dialog",
  "lucide-react",
  "clsx",
  "tailwind-merge",
  "canvas-confetti",
];

const isExternal = (id: string) =>
  EXTERNAL.includes(id) || EXTERNAL.some((name) => id.startsWith(`${name}/`));

export default defineConfig(({ command }) => {
  // `vite dev` serves the standalone playground in dev/ — the arcade running on
  // its own, with no host app around it.
  if (command === "serve") {
    return {
      root: path.resolve(here, "dev"),
      plugins: [react()],
      resolve: { alias: { "@easter-egg": path.resolve(here, "src") } },
      // Root is dev/, but Tailwind and PostCSS are configured at the package
      // root so they can see src/ as well.
      css: { postcss: here },
      server: { port: 5180, open: true },
    };
  }

  return {
    plugins: [react()],
    resolve: { alias: { "@easter-egg": path.resolve(here, "src") } },
    build: {
      target: "es2020",
      outDir: "dist",
      emptyOutDir: true,
      minify: false,
      sourcemap: true,
      lib: {
        entry: path.resolve(here, "src/index.ts"),
        formats: ["es"],
      },
      rollupOptions: {
        external: isExternal,
        output: {
          // One output file per source module. The host bundler then sees the
          // same `import()` boundaries we wrote, so the games still land in
          // their own chunks instead of being flattened into one blob.
          preserveModules: true,
          preserveModulesRoot: path.resolve(here, "src"),
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
        },
      },
    },
  };
});
