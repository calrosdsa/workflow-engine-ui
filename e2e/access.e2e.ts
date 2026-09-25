// Where each QA role can go, and where it is turned away.
import { test, expect } from '@playwright/test'
import { credentials, storageState, tenant } from './support/env'
import { expectAccessible, pinEnglish } from './support/ui'

test.beforeEach(async ({ page }) => pinEnglish(page))

test.describe('Super Admin', () => {
  test.use({ storageState: storageState('admin') })

  test('sees every QA account on the Team page', async ({ page }) => {
    await page.goto('/team')
    await expect(page.getByRole('heading', { name: 'Users and Access' })).toBeVisible()
    // A user with no name shows the email in the Name column too, hence first().
    const users = page.getByRole('table')
    await expect(users.getByText(credentials('builder').email, { exact: true }).first()).toBeVisible()
    await expect(users.getByText(credentials('runtime').email, { exact: true }).first()).toBeVisible()
    await expectAccessible(page, 'the Team page')
  })
})

test.describe('builder', () => {
  test.use({ storageState: storageState('builder') })

  test('opens the app in the designer', async ({ page }) => {
    await page.goto(`/applications/${tenant().appId}/forms`)
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Workflows' })).toBeVisible()
    await expect(page.getByText("You can't open this app's design tools")).toHaveCount(0)
    await expectAccessible(page, 'the forms list')
  })

  test('cannot open the Team page', async ({ page }) => {
    await page.goto('/team')
    await expect(page).not.toHaveURL(/\/team$/)
    await expect(page.getByRole('heading', { name: 'Users and Access' })).toHaveCount(0)
  })
})

test.describe('runtime user', () => {
  test.use({ storageState: storageState('runtime') })

  test('is sent to the running app, not the designer', async ({ page }) => {
    const { clientId, appId } = tenant()
    await page.goto(`/applications/${appId}/design`)
    await expect(page).toHaveURL(new RegExp(`/${clientId}/${appId}(/|$)`))
    // The running app, whatever it shows (its menus, or "not published yet"
    // on a fresh QA app): none of the designer's controls.
    await expect(page.getByRole('button', { name: 'Publish application' })).toHaveCount(0)
    await expect(page.locator('body')).not.toBeEmpty()
    await expectAccessible(page, 'the running app')
  })
})
