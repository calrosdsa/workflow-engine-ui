// Signs each QA account in through the real login page once, and saves its
// session for the tests (and for the API helper). Not traced: it types the
// passwords.
import { test as setup, expect, type Page } from '@playwright/test'
import { credentials, ROLES, storageState } from './support/env'
import { pinEnglish } from './support/ui'

async function signInOutcome(page: Page) {
  if (!new URL(page.url()).pathname.startsWith('/login')) return 'signed-in'
  if (await page.getByText(/two-step verification/i).first().isVisible()) return 'mfa'
  if (await page.getByText(/invalid credentials/i).isVisible()) return 'rejected'
  return 'waiting'
}

for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const { email, password } = credentials(role)
    await pinEnglish(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    let outcome = 'waiting'
    await expect.poll(async () => (outcome = await signInOutcome(page)), { timeout: 30_000 }).not.toBe('waiting')
    if (outcome === 'mfa') {
      throw new Error(`${email} was asked for two-step verification. The QA tenant must not require it (Team > Security), or the account must not have enrolled.`)
    }
    if (outcome === 'rejected') throw new Error(`${email} was refused: wrong QA_${role.toUpperCase()}_PASSWORD, or the account does not exist (run e2e/seed/seed-qa-users.mjs)`)

    await page.waitForLoadState('networkidle')
    await page.context().storageState({ path: storageState(role) })
  })
}
