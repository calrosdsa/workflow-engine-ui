import { defineConfig, devices } from '@playwright/test'

// The mocked browser suite: the production build, served by `vite preview`,
// against e2e/mock/fake-backend.ts instead of a server. Runs on every pull
// request (ci.yml's browser job). See e2e/README.md.
//
// Screenshots are compared only inside the pinned Playwright image
// (E2E_SNAPSHOTS=1, set by that job and by `npm run e2e:mock:update`): the
// UI uses system fonts, so a baseline from another OS would never match.
// Elsewhere the tests still run, minus the pixel comparisons.
const PORT = 4798
const snapshots = process.env.E2E_SNAPSHOTS === '1'

export default defineConfig({
  testDir: '.',
  testMatch: /\.mock\.ts$/,
  outputDir: '../../test-results/mock',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFileName}/{arg}{ext}',
  ignoreSnapshots: !snapshots,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report-mock' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'UTC',
    // Fake data only, so traces are safe to keep, public repository or not.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // The type check runs as its own CI step; this only bundles.
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    cwd: '../..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'dark', use: { colorScheme: 'dark' } },
    { name: 'light', use: { colorScheme: 'light' } },
  ],
})
