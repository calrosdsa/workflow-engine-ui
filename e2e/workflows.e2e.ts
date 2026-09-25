// Running a workflow from the designer and seeing it finish.
import { test, expect } from '@playwright/test'
import { apiAs, createNoopWorkflow, deleteWorkflow, expectExecutionCompletes, listExecutions, type Api, type Workflow } from './support/api'
import { runName, storageState, tenant } from './support/env'
import { expectAccessible, pinEnglish } from './support/ui'

test.use({ storageState: storageState('builder') })

let api: Api
let workflow: Workflow

test.beforeEach(async ({ page }) => {
  await pinEnglish(page)
  api = await apiAs('builder')
  workflow = await createNoopWorkflow(api, runName('wf'))
})

test.afterEach(async () => {
  // A run still in flight would be cut short by deleting its definition.
  for (const run of await listExecutions(api, workflow.id)) {
    const id = run.execution_id ?? run.id
    if (id) await expectExecutionCompletes(api, id).catch(() => {})
  }
  await deleteWorkflow(api, workflow.id)
  await api.dispose()
})

test('runs a workflow and shows it completed', async ({ page }) => {
  await page.goto(`/applications/${tenant().appId}/workflows`)
  // Each workflow is a card, not a table row: the innermost element holding
  // both its name and a Run button.
  const row = page.locator('div')
    .filter({ has: page.getByText(workflow.name) })
    .filter({ has: page.getByRole('button', { name: 'Run' }) })
    .last()
  await expect(row).toBeVisible()
  await expectAccessible(page, 'the workflows list')

  await row.getByRole('button', { name: 'Run' }).click()
  await page.getByRole('link', { name: 'track it here' }).click()

  await expect(page).toHaveURL(/\/executions\/[0-9a-f-]{36}(\?|$)/)
  const executionId = new URL(page.url()).pathname.split('/').pop()!
  // The badge shows the raw status; a run passes through PENDING and RUNNING.
  await expect(page.getByText('COMPLETED', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expectExecutionCompletes(api, executionId)
  await expectAccessible(page, 'the execution page')
})
