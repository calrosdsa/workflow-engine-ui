// Vite config for the Ladle component workbench ONLY — deliberately separate
// from the app's own root vite.config.ts, which Ladle would otherwise read
// by default. The root config carries app-specific machinery (a CSP-nonce
// plugin, a dev-only middleware that routes some paths to a second
// `runtime.html` entry point) that has no purpose inside an isolated
// per-component story viewer and, in the CSP plugin's case, risks silently
// breaking Ladle's own injected scripts/styles if its policy is strict.
// This file supplies just what stories actually need: React JSX, Tailwind
// v4 (a Vite plugin here, not a PostCSS pass — see src/index.css's own
// "@import tailwindcss" line), and the `@/*` -> `src/*` path alias
// (tsconfig.app.json's `paths`) that nearly every component under
// src/components/ui and src/features imports through.
//
// Ladle adds @vitejs/plugin-react + vite-tsconfig-paths itself by default,
// but ONLY when it falls back to its own defaults — supplying any custom
// vite.config.{js|mjs|ts} switches Ladle over to using exactly what's
// listed here instead, per Ladle's own docs. Both are re-declared
// explicitly below rather than assumed, so this file's plugin list is the
// complete, self-contained truth for what the workbench runs on.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
})
