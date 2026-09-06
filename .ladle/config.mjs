/**
 * Ladle component workbench config. Full reference: https://ladle.dev/docs/config
 *
 * `stories` is left at Ladle's own default (`src/**\/*.stories.{js,jsx,ts,tsx,mdx}`)
 * — every story file in this repo should follow that convention, colocated
 * next to the component it documents (see button.stories.tsx).
 */
export default {
  // Points Ladle at a dedicated Vite config instead of the app's own root
  // vite.config.ts — see .ladle/vite.config.ts's own comment for why.
  viteConfig: process.cwd() + "/.ladle/vite.config.ts",
};
