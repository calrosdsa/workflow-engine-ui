// The builder's form work: the form builder saves, and records added from the
// designer land in the form. Each test brings its own form over the API.
import { test, expect } from '@playwright/test'
import { apiAs, changeRolePermissions, createTicketForm, deleteForm, getForm, listRecords, type Api, type Form } from './support/api'
import { runName, storageState, tenant } from './support/env'
import { expectAccessible, pinEnglish } from './support/ui'

test.use({ storageState: storageState('builder') })

const BUILDER_ROLE = 'QA Builder' // created by e2e/seed

let api: Api
let form: Form

test.beforeEach(async ({ page }) => {
  await pinEnglish(page)
  api = await apiAs('builder')
  form = await createTicketForm(api, runName('form'))
})

test.afterEach(async () => {
  await deleteForm(api, form.id)
  await api.dispose()
})

test('renames a form in the form builder', async ({ page }) => {
  await page.goto(`/applications/${tenant().appId}/forms/${form.id}`)
  await expect(page.getByRole('button', { name: /^title field$/i }).or(page.getByLabel('title field'))).toBeVisible()
  await expectAccessible(page, 'the form builder')

  const renamed = `${form.name}-renamed`
  const name = page.getByPlaceholder('Form name')
  await name.fill(renamed)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Form saved')).toBeVisible()

  expect((await getForm(api, form.id)).name).toBe(renamed)
})

// The builder role can design forms but holds no record permissions; like any
// role, it gets them per form, from a Super Admin. Only this test changes the
// role: the tests in this file run in parallel, and a role change replaces
// the whole permission list, so two of them would undo each other's grants.
test('adds a record from the records page', async ({ page }) => {
  const admin = await apiAs('admin')
  const perms = [`forms:${form.id}:view`, `forms:${form.id}:create`]
  await changeRolePermissions(admin, BUILDER_ROLE, perms)
  try {
    await page.goto(`/applications/${tenant().appId}/forms/${form.id}/records`)
    await page.getByRole('button', { name: 'New Record' }).click()
    await page.getByLabel(/^Title/).fill('first ticket')
    await page.getByRole('button', { name: 'Save Record' }).click()

    await expect(page.getByRole('cell', { name: 'first ticket' }).or(page.getByText('first ticket'))).toBeVisible()
    await expectAccessible(page, 'the records page')
    await expect.poll(async () => (await listRecords(api, form.id)).map((r) => r.title)).toEqual(['first ticket'])
  } finally {
    await changeRolePermissions(admin, BUILDER_ROLE, [], perms)
    await admin.dispose()
  }
})
