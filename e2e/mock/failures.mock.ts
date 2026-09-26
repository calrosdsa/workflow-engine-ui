// What the UI does when the server says no: responses a real backend won't
// produce on demand, so the staging suite never sees them.
import { expect, reply, test } from './fake-backend'
import { expectAccessible } from '../support/ui'
import { APP_ID, FORM_ID, installWorld, me, signedOut } from './world'

test.describe('sign-in', () => {
  test.beforeEach(({ backend }) => signedOut(backend))

  test('a wrong password says so and stays on the page', async ({ page, backend }) => {
    backend.on('POST', '/auth/signin/credential', () => reply(401, { error: 'invalid credentials' }))
    await page.goto('/login')
    await page.getByLabel('Email').fill('dana@acme.test')
    await page.getByLabel('Password').fill('not-the-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByText('Invalid credentials. Please try again.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('an account with two-step verification is asked for a code', async ({ page, backend }) => {
    backend.on('POST', '/auth/signin/credential', () => ({ mfa_required: true, mfa_token: 'mfa-token', purpose: 'verify', methods: ['totp'] }))
    await page.goto('/login')
    await page.getByLabel('Email').fill('dana@acme.test')
    await page.getByLabel('Password').fill('correct-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByText('Two-step verification').first()).toBeVisible()
    await expect(page.getByLabel('Code')).toBeVisible()
    await expectAccessible(page, 'the two-step challenge')
  })
})

test.describe('signed in', () => {
  test.beforeEach(({ backend }) => installWorld(backend))

  test('a session that expires mid-use goes back to sign-in', async ({ page, backend }) => {
    await page.goto(`/applications/${APP_ID}/forms`)
    await expect(page.getByText('Tickets', { exact: true }).first()).toBeVisible()
    // The session is gone server-side: every call now answers 401.
    backend.on('GET', '/auth/me', () => reply(401, { error: 'unauthorized' }))
    backend.on('GET', '/workflows', () => reply(401, { error: 'unauthorized' }))
    backend.on('GET', '/forms', () => reply(401, { error: 'unauthorized' }))
    await page.getByRole('navigation').getByRole('button', { name: 'Workflows' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('a role without design access is told why', async ({ page, backend }) => {
    const designer = { ...me, memberships: [{ ...me.memberships[0], role: 'Viewer', permissions: ['application:design'] }] }
    installWorld(backend, designer)
    backend.on('GET', '/application', () => reply(403, { error: 'forbidden' }))
    await page.goto(`/applications/${APP_ID}/forms`)
    await expect(page.getByRole('alert').getByText("You can't open this app's design tools")).toBeVisible()
    await expectAccessible(page, 'the no-design-access message')
  })

  test("a server error shows the request id to quote", async ({ page, backend }) => {
    backend.on('POST', '/forms/:id/records', () =>
      reply(500, { error: 'internal server error' }, { 'X-Request-Id': '4bf92f3577b34da6a3ce929d0e0e4736' }))
    await page.goto(`/applications/${APP_ID}/forms/${FORM_ID}/records`)
    await page.getByRole('button', { name: 'New Record' }).click()
    await page.getByLabel(/^Title/).fill('Broken lift')
    await page.getByRole('button', { name: 'Save Record' }).click()
    await expect(page.getByText(/4bf92f3577b34da6a3ce929d0e0e4736/).first()).toBeVisible()
  })

  test('a publish the server rejects lists what to fix', async ({ page, backend }) => {
    backend.on('POST', '/application/publish', () =>
      reply(422, { error: 'validation failed', issues: [{ level: 'error', path: 'menus', message: 'the app has no menus' }] }))
    await page.goto(`/applications/${APP_ID}/forms`)
    await page.getByRole('button', { name: 'Publish application' }).click()
    await page.getByRole('button', { name: /^Launch version/ }).click()
    await expect(page.getByText('the app has no menus')).toBeVisible()
  })

  test('an app with no forms shows how to start', async ({ page, backend }) => {
    backend.on('GET', '/forms', () => [])
    await page.goto(`/applications/${APP_ID}/forms`)
    await expect(page.getByRole('button', { name: 'Create your first form' })).toBeVisible()
    await expectAccessible(page, 'the empty forms list')
  })
})

test.describe('records page', () => {
  test.beforeEach(({ backend }) => installWorld(backend))

  test('asks before deleting a record, and Cancel keeps it', async ({ page, backend }) => {
    backend.on('DELETE', '/forms/:id/records/:rid', () => reply(204))
    const deletes = () => backend.requests.filter((r) => r.method === 'DELETE')
    await page.goto(`/applications/${APP_ID}/forms/${FORM_ID}/records`)
    await expect(page.getByRole('cell', { name: 'Printer jammed on floor 2' })).toBeVisible()

    await page.getByRole('button', { name: 'Delete record' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Delete this record?' })
    await expect(dialog).toBeVisible()
    await expectAccessible(page, 'the delete confirmation')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    expect(deletes()).toEqual([])

    await page.getByRole('button', { name: 'Delete record' }).first().click()
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(dialog).toBeHidden()
    expect(deletes().map((r) => r.path)).toEqual([`/forms/${FORM_ID}/records/a1b2c3d4-0000-4000-8000-000000000001`])
  })
})
