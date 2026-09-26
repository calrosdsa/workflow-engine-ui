// Key screens against the fake backend: each must render its data, pass the
// accessibility check, and match its screenshot, once per theme (the dark
// and light projects). Update the images with `npm run e2e:mock:update`.
import type { Page } from '@playwright/test'
import { expect, test } from './fake-backend'
import { expectAccessible } from '../support/ui'
import { APP_ID, EXECUTION_ID, FIXED_NOW, FORM_ID, installWorld, signedOut } from './world'

async function open(page: Page, path: string) {
  // Fixed wall clock for relative dates; timers keep running (toasts, React Query).
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto(path)
}

async function check(page: Page, name: string) {
  await page.waitForLoadState('networkidle')
  await expectAccessible(page, name)
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true })
}

test('sign-in page', async ({ page, backend }) => {
  signedOut(backend)
  await open(page, '/login')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await check(page, 'login')
})

test.describe('signed in', () => {
  test.beforeEach(({ backend }) => installWorld(backend))

  test('applications', async ({ page }) => {
    await open(page, '/')
    await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()
    await expect(page.getByText('Service Desk').first()).toBeVisible()
    await check(page, 'applications')
  })

  test('team', async ({ page }) => {
    await open(page, '/team')
    await expect(page.getByRole('heading', { name: 'Users and Access' })).toBeVisible()
    await expect(page.getByRole('table').getByText('omar@acme.test').first()).toBeVisible()
    await check(page, 'team')
  })

  test('forms list', async ({ page }) => {
    await open(page, `/applications/${APP_ID}/forms`)
    await expect(page.getByText('Tickets', { exact: true }).first()).toBeVisible()
    await check(page, 'forms')
  })

  test('form builder', async ({ page }) => {
    await open(page, `/applications/${APP_ID}/forms/${FORM_ID}`)
    await expect(page.getByPlaceholder('Form name')).toHaveValue('Tickets')
    await check(page, 'form-builder')
  })

  test('records', async ({ page }) => {
    await open(page, `/applications/${APP_ID}/forms/${FORM_ID}/records`)
    await expect(page.getByRole('cell', { name: 'Printer jammed on floor 2' })).toBeVisible()
    await check(page, 'records')
  })

  test('workflows', async ({ page }) => {
    await open(page, `/applications/${APP_ID}/workflows`)
    await expect(page.getByText('Notify dispatcher')).toBeVisible()
    await check(page, 'workflows')
  })

  test('execution', async ({ page }) => {
    await open(page, `/applications/${APP_ID}/executions/${EXECUTION_ID}`)
    await expect(page.getByText('COMPLETED', { exact: true }).first()).toBeVisible()
    await check(page, 'execution')
  })
})
