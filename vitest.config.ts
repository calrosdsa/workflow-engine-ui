import { defineConfig } from 'vitest/config'
import path from 'path'

// Separate from vite.config.ts (which defines the two-entry-point build and
// the runtime dev-server fallback middleware — neither applies to tests) so
// test runs don't depend on that file's app-serving concerns.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
  },
})
