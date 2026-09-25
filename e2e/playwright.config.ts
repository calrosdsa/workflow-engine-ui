import { defineConfig, devices } from '@playwright/test'

// Browser suite against a deployed environment (staging in CI, or a local
// stack). Every setting comes from the environment; see e2e/README.md.
//
// Traces are off unless E2E_TRACE=true: they record request headers,
// session cookies included, and the public repository's artifacts are
// downloadable by anyone. e2e.yml turns them on for private callers only.
const trace = process.env.E2E_TRACE === 'true' ? 'on-first-retry' : 'off'

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A test that passes only on retry is reported as flaky, not hidden.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    // Tenants can override display text, so tests select by role and label
    // in the platform's own English strings.
    locale: 'en-US',
    trace,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      // Signs each QA account in once and saves its session for the tests.
      // Never traced or screenshotted: it types the passwords.
      name: 'setup',
      testMatch: /auth\.setup\.ts$/,
      use: { trace: 'off', screenshot: 'off' },
    },
    {
      name: 'sweep',
      testMatch: /sweep\.setup\.ts$/,
      dependencies: ['setup'],
    },
    {
      name: 'chromium',
      testMatch: /\.e2e\.ts$/,
      dependencies: ['sweep'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
