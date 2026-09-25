// The published app, as its end user: records created and edited through a
// Search menu, and a menu on a form the role has no access to.
//
// Serial: both tests publish, and publishing ships the whole app.
import { test, expect } from '@playwright/test'
import {
  apiAs, changeRolePermissions, createSearchMenu, createTicketForm, deleteForm, deleteMenu, getRecord,
  publish, type Api, type Form, type Menu,
} from './support/api'
import { runName, storageState, tenant } from './support/env'
import { expectAccessible, pinEnglish } from './support/ui'

const RUNTIME_ROLE = 'QA Runtime User' // created by e2e/seed

test.describe.configure({ mode: 'serial' })
test.use({ storageState: storageState('runtime') })

let admin: Api
const cleanup: Array<() => Promise<void>> = []

test.beforeAll(async () => {
  admin = await apiAs('admin')
})

test.afterAll(async () => {
  // Reverse order: role grants, then menus, then forms (a menu on a deleted
  // form fails every later publish of the app).
  for (const undo of cleanup.reverse()) await undo()
  // Take the deleted menus out of the running app. An app left with no menus
  // cannot be published (422); the stale snapshot then only lists menus whose
  // forms are gone, and the next run's publish replaces it.
  const res = await admin.post('application/publish')
  if (!res.ok() && res.status() !== 422) throw new Error(`cleanup publish: HTTP ${res.status()} ${await res.text()}`)
  await admin.dispose()
})

async function publishedForm(label: string, grants: Array<'view' | 'create' | 'edit'>): Promise<{ form: Form; menu: Menu }> {
  const form = await createTicketForm(admin, runName(label))
  cleanup.push(() => deleteForm(admin, form.id))
  const menu = await createSearchMenu(admin, form.name, form.id)
  cleanup.push(() => deleteMenu(admin, menu.id))
  const perms = grants.map((a) => `forms:${form.id}:${a}`)
  if (perms.length) {
    await changeRolePermissions(admin, RUNTIME_ROLE, perms)
    cleanup.push(() => changeRolePermissions(admin, RUNTIME_ROLE, [], perms))
  }
  await publish(admin)
  return { form, menu }
}

test.beforeEach(async ({ page }) => pinEnglish(page))

test('creates and edits a record through a published menu', async ({ page }) => {
  const { form, menu } = await publishedForm('tickets', ['view', 'create', 'edit'])
  const { clientId, appId } = tenant()

  await page.goto(`/${clientId}/${appId}/${menu.slug}`)
  await expectAccessible(page, 'a Search menu')
  await page.getByRole('button', { name: /^Create / }).or(page.getByRole('link', { name: /^Create / })).first().click()
  await page.getByLabel(/^Title/).fill('printer jammed')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  // Saving opens the new record's page.
  await expect(page).toHaveURL(new RegExp(`/forms/${form.id}/[0-9a-f-]{36}([?]|$)`))
  const recordId = new URL(page.url()).pathname.split('/').pop()!
  expect((await getRecord(admin, form.id, recordId)).title).toBe('printer jammed')
  await expectAccessible(page, 'a record page')

  // Fields are edited in place, one at a time.
  await page.getByRole('button', { name: 'printer jammed' }).click()
  const editor = page.locator('div').filter({ has: page.getByTitle('Save') }).last()
  await editor.getByRole('textbox').fill('printer fixed')
  await editor.getByTitle('Save').click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await expect.poll(async () => (await getRecord(admin, form.id, recordId)).title).toBe('printer fixed')
})

test('is refused a menu whose form the role cannot view', async ({ page }) => {
  const { menu } = await publishedForm('secret', [])
  const { clientId, appId } = tenant()

  await page.goto(`/${clientId}/${appId}/${menu.slug}`)
  await expect(page.getByRole('heading', { name: "You don't have access to this section" })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Create / })).toHaveCount(0)
})
