// Removes test data an earlier run left behind (a crash, or a cancelled job).
// Only qa-* items older than two hours: a run from the other repository may
// be using younger ones right now. Menus go first, since a menu on a deleted
// form fails every later publish of the app.
import { test as setup } from '@playwright/test'
import { apiAs, changeRolePermissions, deleteForm, deleteMenu, deleteWorkflow, listForms, listMenus, listWorkflows } from './support/api'

// E2E_SWEEP_AGE_MS overrides it, for exercising the sweep itself.
const STALE_MS = Number(process.env.E2E_SWEEP_AGE_MS ?? 2 * 60 * 60 * 1000)

// Exactly what runName() makes (qa-<run id or localXXXX>-<attempt>-...), so a
// form someone named "QA Tickets" is never touched.
const RUN_NAME = /^qa-(\d+|local[0-9a-z]+)-\d+-/

function stale(item: { name?: string; created_at?: string }) {
  if (!item.name || !RUN_NAME.test(item.name) || !item.created_at) return false
  return Date.now() - Date.parse(item.created_at) > STALE_MS
}

setup('sweep stale test data', async () => {
  const api = await apiAs('admin')
  try {
    for (const m of (await listMenus(api)).filter(stale)) await deleteMenu(api, m.id)
    for (const w of (await listWorkflows(api)).filter(stale)) await deleteWorkflow(api, w.id)
    for (const f of (await listForms(api)).filter(stale)) await deleteForm(api, f.id)
    // Per-form grants a killed run never took back, now pointing at forms
    // that are gone: changing a role with no additions prunes them.
    for (const role of ['QA Builder', 'QA Runtime User']) await changeRolePermissions(api, role, [])
  } finally {
    await api.dispose()
  }
})
