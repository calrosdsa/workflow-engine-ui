// Removes test data an earlier run left behind (a crash, or a cancelled job).
// Only qa-* items older than two hours: a run from the other repository may
// be using younger ones right now. Menus go first, since a menu on a deleted
// form fails every later publish of the app.
import { test as setup } from '@playwright/test'
import { apiAs, deleteForm, deleteMenu, deleteWorkflow, listForms, listMenus, listWorkflows } from './support/api'

const STALE_MS = 2 * 60 * 60 * 1000

function stale(item: { name?: string; slug?: string; created_at?: string }) {
  const label = item.name ?? item.slug ?? ''
  if (!/^qa[-_]/i.test(label) || !item.created_at) return false
  return Date.now() - Date.parse(item.created_at) > STALE_MS
}

setup('sweep stale test data', async () => {
  const api = await apiAs('admin')
  try {
    for (const m of (await listMenus(api)).filter(stale)) await deleteMenu(api, m.id)
    for (const w of (await listWorkflows(api)).filter(stale)) await deleteWorkflow(api, w.id)
    for (const f of (await listForms(api)).filter(stale)) await deleteForm(api, f.id)
  } finally {
    await api.dispose()
  }
})
