import type { Config } from "tailwindcss";

/**
 * Only the standalone playground (`npm run dev`) uses this config.
 *
 * A host application compiles the arcade's classes with its own Tailwind — see
 * the "Tailwind" section of README.md. The package deliberately ships no CSS of
 * its own, so there is one Tailwind build per page rather than two.
 */
export default {
  content: ["./src/**/*.{ts,tsx}", "./dev/**/*.{ts,tsx,html}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
